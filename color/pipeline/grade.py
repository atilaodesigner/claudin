"""Motor de color grading do clipe "Balanço do Barco".

Arvore de nodes (equivalente Resolve), toda por pixel e portanto "assavel" em LUT:
  N1 Levels/Black balance (display)   -> tira o preto levantado e a dominante nas sombras
  N2 Gamma de meio-tom                  -> coloca a mediana no alvo da categoria
  N3 WB + exposicao (linear)            -> balanco de branco por ganho de canal
  N4 Contraste (log2, pivo 18%)         -> contraste "de camera"
  N5 LOOK: split-tone Oklab             -> sombras teal/navy, altas ambar
  N6 LOOK: hue vs hue / hue vs sat      -> pele no skin line, verdes oliva, azuis teal
  N7 LOOK: sat + gamut compress + densidade de cor
  N8 Film shoulder (roll-off de altas) + black floor
"""
import numpy as np

M_709_TO_LMS = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                         [0.2119034982, 0.6806995451, 0.1073969566],
                         [0.0883024619, 0.2817188376, 0.6299787005]], np.float32)
M_LMS_TO_OK = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                        [1.9779984951, -2.4285922050, 0.4505937099],
                        [0.0259040371, 0.7827717662, -0.8086757660]], np.float32)
M_OK_TO_LMS = np.linalg.inv(M_LMS_TO_OK).astype(np.float32)
M_LMS_TO_709 = np.linalg.inv(M_709_TO_LMS).astype(np.float32)


def to_oklab(lin):
    lms = lin @ M_709_TO_LMS.T
    lms = np.cbrt(lms)
    return lms @ M_LMS_TO_OK.T


def from_oklab(lab):
    lms = lab @ M_OK_TO_LMS.T
    lms = lms ** 3
    return lms @ M_LMS_TO_709.T


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def hue_dist(h, c):
    d = (h - c + np.pi) % (2 * np.pi) - np.pi
    return d


# ---------------- LOOK global ("Balanco do Barco") ----------------
LOOK = dict(
    sh_ab=(-0.010, -0.018),   # sombras -> teal/navy
    hi_ab=(0.006, 0.016),     # altas -> ambar
    skin_center=np.deg2rad(58), skin_width=np.deg2rad(34), skin_pull=0.45, skin_sat=0.97,
    green_center=np.deg2rad(140), green_width=np.deg2rad(40), green_shift=np.deg2rad(-22), green_sat=0.72,
    cyan_center=np.deg2rad(230), cyan_width=np.deg2rad(45), cyan_target=np.deg2rad(222), cyan_pull=0.35, cyan_sat=0.86,
    red_center=np.deg2rad(20), red_width=np.deg2rad(18), red_shift=np.deg2rad(8),
    cmax=0.19, density=0.30,
    shoulder=0.62,
    floor=(0.010, 0.014, 0.020),
)

DEFAULT = dict(black=(0, 0, 0), white=1.0, gamma=1.0, wb=(1, 1, 1), ev=0.0, contrast=1.0,
               sat=1.0, look=1.0, mono=False, split=1.0, floor=1.0, hi_warm=1.0, sh_teal=1.0)


def grade_rgb(x, P):
    """x: (...,3) float32 display-referred Rec.709 (BT.1886) 0..1."""
    p = dict(DEFAULT); p.update(P)
    L = LOOK
    x = x.astype(np.float32)
    # N1 levels / black balance
    b = np.asarray(p['black'], np.float32)
    w = np.asarray(p['white'], np.float32)
    x = (x - b) / (w - b)
    x = np.maximum(x, 0)
    # N2 gamma
    if p['gamma'] != 1.0:
        x = x ** np.float32(p['gamma'])
    # N3 linear + wb/exposure
    lin = x ** 2.4
    lin = lin * (np.asarray(p['wb'], np.float32) * np.float32(2 ** p['ev']))
    # N4 contraste log com pivo 18%
    if p['contrast'] != 1.0:
        lg = np.log2(np.maximum(lin, 1e-6) / 0.18)
        # contraste suave: menos efeito nas pontas (toe/shoulder)
        lg = lg * p['contrast']
        lin = 0.18 * np.exp2(lg)
    lin = np.maximum(lin, 0)
    # N5-N7 look em Oklab
    lab = to_oklab(lin)
    Lk, a, bb = lab[..., 0], lab[..., 1], lab[..., 2]
    k = p['look']
    if p['mono']:
        a = a * 0; bb = bb * 0
    C = np.sqrt(a * a + bb * bb)
    h = np.arctan2(bb, a)
    if not p['mono']:
        # N6 hue vs hue / hue vs sat
        # pele -> skin line
        d = hue_dist(h, L['skin_center'])
        wsk = np.exp(-(d / L['skin_width']) ** 2) * smoothstep(0.02, 0.06, C)
        h = h - d * wsk * L['skin_pull'] * k
        C = C * (1 - wsk * (1 - L['skin_sat']) * k)
        # verdes -> oliva e dessatura
        d = hue_dist(h, L['green_center'])
        wg = np.exp(-(d / L['green_width']) ** 2)
        h = h + wg * L['green_shift'] * k
        C = C * (1 - wg * (1 - L['green_sat']) * k)
        # cianos/azuis -> teal controlado
        d = hue_dist(h, L['cyan_center'])
        wc = np.exp(-(d / L['cyan_width']) ** 2)
        h = h - hue_dist(h, L['cyan_target']) * wc * L['cyan_pull'] * k
        C = C * (1 - wc * (1 - L['cyan_sat']) * k)
        # vermelhos puxam levemente pro laranja
        d = hue_dist(h, L['red_center'])
        wr = np.exp(-(d / L['red_width']) ** 2)
        h = h + wr * L['red_shift'] * k
        # N7 saturacao + gamut compress + densidade
        C = C * p['sat']
        cm = L['cmax']
        C = cm * np.tanh(C / cm)
        Lk = Lk - L['density'] * k * np.maximum(C - 0.03, 0) * (0.5 + 0.5 * Lk)
    a = C * np.cos(h); bb = C * np.sin(h)
    # N5 split tone (depois do hue pra nao ser arrastado pelos qualifiers)
    ws = 1 - smoothstep(0.12, 0.55, Lk)
    wh = smoothstep(0.55, 0.95, Lk)
    s = p['split'] * k
    a = a + s * (ws * L['sh_ab'][0] * p['sh_teal'] + wh * L['hi_ab'][0] * p['hi_warm'])
    bb = bb + s * (ws * L['sh_ab'][1] * p['sh_teal'] + wh * L['hi_ab'][1] * p['hi_warm'])
    # aplica menos split no preto absoluto (fica no floor)
    lab = np.stack([Lk, a, bb], -1)
    lin = np.maximum(from_oklab(lab), 0)
    # N8 shoulder
    t = L['shoulder']
    over = np.maximum(lin - t, 0)
    lin = np.where(lin > t, t + (1 - t) * (over / (1 - t)) / (1 + over / (1 - t)), lin)
    out = lin ** (1 / 2.4)
    f = np.asarray(L['floor'], np.float32) * p['floor']
    out = f + (1 - f) * out
    return np.clip(out, 0, 1)


def build_lut(P, n=256):
    """LUT 3D completa para entrada 8 bits: indice r<<16|g<<8|b -> uint16 RGB."""
    g = np.arange(n, dtype=np.float32) / (n - 1)
    out = np.empty((n, n, n, 3), np.uint16)
    for r in range(0, n, 32):
        R, G, B = np.meshgrid(g[r:r + 32], g, g, indexing='ij')
        x = np.stack([R, G, B], -1)
        out[r:r + 32] = np.round(grade_rgb(x, P) * 65535).astype(np.uint16)
    return out.reshape(-1, 3)


def write_cube(P, path, n=65, title='grade'):
    g = np.arange(n, dtype=np.float32) / (n - 1)
    B, G, R = np.meshgrid(g, g, g, indexing='ij')  # .cube: R varia mais rapido
    x = np.stack([R, G, B], -1).reshape(-1, 3)
    y = grade_rgb(x, P)
    with open(path, 'w') as f:
        f.write(f'TITLE "{title}"\nLUT_3D_SIZE {n}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        np.savetxt(f, y, fmt='%.5f')
