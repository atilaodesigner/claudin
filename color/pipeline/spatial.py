"""Nodes espaciais (power windows com tracking, separacao de sujeito, vinheta,
degrade de ceu, halation e grao). Aplicados depois da LUT do take, em display."""
import json, cv2, numpy as np
import shots

FACES = np.load('faces.npy')          # por frame: cx, cy, w, h, score (relativos)
SEG = np.load('segmask.npy', mmap_mode='r')  # por frame: 180x320 uint8
GW, GH = 480, 270                     # resolucao do mapa de ganho

# ---- config por categoria (stops) ----
CFG = {
    'INT':      dict(vig=0.45, face=0.22, subj=0.0,  bg=-0.18, sky=0.0,  hal=0.10),
    'EXT_DAY':  dict(vig=0.30, face=0.40, subj=0.12, bg=0.0,   sky=0.35, hal=0.0),
    'EXT_FLAT': dict(vig=0.30, face=0.0,  subj=0.0,  bg=0.0,   sky=0.0,  hal=0.0),
    'NIGHT':    dict(vig=0.40, face=0.18, subj=0.08, bg=-0.10, sky=0.0,  hal=0.14),
    'FIRE_FLAT':dict(vig=0.40, face=0.0,  subj=0.0,  bg=0.0,   sky=0.0,  hal=0.22),
    'AI':       dict(vig=0.20, face=0.0,  subj=0.0,  bg=0.0,   sky=0.0,  hal=0.06),
    'AI_NIGHT': dict(vig=0.25, face=0.0,  subj=0.0,  bg=0.0,   sky=0.0,  hal=0.14),
    'AI_FIRE':  dict(vig=0.25, face=0.0,  subj=0.0,  bg=0.0,   sky=0.0,  hal=0.22),
    'SUNSET':   dict(vig=0.25, face=0.0,  subj=0.0,  bg=0.0,   sky=0.0,  hal=0.16),
    'LAMP':     dict(vig=0.20, face=0.0,  subj=0.0,  bg=0.0,   sky=0.0,  hal=0.25),
    'FLASH':    dict(vig=0.35, face=0.0,  subj=0.0,  bg=0.0,   sky=0.20, hal=0.06),
    'BW':       dict(vig=0.30, face=0.12, subj=0.0,  bg=0.0,   sky=0.0,  hal=0.0),
    'FX':       dict(vig=0.0,  face=0.0,  subj=0.0,  bg=0.0,   sky=0.0,  hal=0.0),
}
# ajustes por take
SHOT = {
    8:  dict(sky=0.25, face=0.0, subj=0.0),       # silhueta proposital
    17: dict(sky=0.0),                            # plano girando: sem degrade fixo
    32: dict(sky=0.25),
    40: dict(face=0.0, subj=0.0),
    44: dict(face=0.0, subj=0.0, sky=0.30),       # drone do barco
    45: dict(face=0.0, subj=0.0, sky=0.30),
    37: dict(sky=0.0, face=0.0, subj=0.0),        # tenis no tapete
    10: dict(face=0.0, bg=0.0), 6: dict(face=0.0, bg=0.0),
    2: dict(face=0.0, bg=0.0), 5: dict(face=0.0, bg=0.0), 7: dict(face=0.0, bg=0.0),
    19: dict(face=0.0, bg=0.0), 22: dict(face=0.0, bg=0.0), 35: dict(face=0.0, bg=0.0),
    21: dict(face=0.0, bg=0.0),
    36: dict(hal=0.20),
}


def cfg(k):
    c = dict(CFG[shots.CAT[k]]); c.update(SHOT.get(k, {}))
    return c


def _ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


_yy, _xx = np.mgrid[0:GH, 0:GW].astype(np.float32)
_xx = (_xx + 0.5) / GW; _yy = (_yy + 0.5) / GH


# ---------- tracks por take (suavizados) ----------
_TRACK = {}
def face_track(k):
    if k in _TRACK: return _TRACK[k]
    a, e = shots.SEGS[k]
    f = FACES[a:e].copy()
    ok = np.isfinite(f[:, 0]) & (f[:, 2] > 0.035) & (f[:, 2] < 0.6)
    n = e - a
    w = ok.astype(np.float32)
    tr = np.full((n, 4), np.nan, np.float32)
    if ok.sum() >= max(3, 0.15 * n):
        idx = np.where(ok)[0]
        for j in range(4):
            tr[:, j] = np.interp(np.arange(n), idx, f[idx, j])
        # buracos longos (> 12 frames) viram peso 0; fade de 5 frames
        gap = np.ones(n, np.float32)
        for t in range(n):
            d = np.min(np.abs(idx - t))
            gap[t] = np.clip(1 - (d - 6) / 6, 0, 1)
        w = gap
        # suavizacao temporal (gauss sigma 2.5)
        kern = cv2.getGaussianKernel(15, 2.5).ravel()
        for j in range(4):
            pad = np.pad(tr[:, j], 7, mode='edge')
            tr[:, j] = np.convolve(pad, kern, 'valid')
        pad = np.pad(w, 7, mode='edge'); w = np.convolve(pad, kern, 'valid')
    else:
        w = np.zeros(n, np.float32)
    presence = float(ok.mean())
    _TRACK[k] = (tr, w, presence)
    return _TRACK[k]


_SEGC = {}
def seg_mask(k, n):
    """mascara do sujeito suavizada no tempo (media de 7 frames) e no espaco."""
    a, e = shots.SEGS[k]
    lo, hi = max(a, n - 3), min(e, n + 4)
    m = SEG[lo:hi].astype(np.float32).mean(0) / 255
    m = cv2.resize(m, (GW, GH), interpolation=cv2.INTER_LINEAR)
    m = cv2.GaussianBlur(m, (0, 0), 6)
    return _ss(0.25, 0.75, m)


def gain_map(k, n):
    """Mapa de ganho (stops) em GWxGH para o frame n (absoluto) do take k."""
    c = cfg(k)
    a, e = shots.SEGS[k]
    st = np.zeros((GH, GW), np.float32)
    if c['vig']:
        r = np.sqrt(((_xx - 0.5) / 0.62) ** 2 + ((_yy - 0.47) / 0.60) ** 2)
        st -= c['vig'] * _ss(0.55, 1.25, r)
    if c['sky']:
        st -= c['sky'] * (1 - _ss(0.0, 0.5, _yy))
    tr, w, pres = face_track(k)
    t = n - a
    if (c['face'] or c['subj'] or c['bg']) and pres >= 0.25:
        m = seg_mask(k, n)
        if c['subj'] or c['bg']:
            st += c['subj'] * m + c['bg'] * (1 - m)
        if c['face'] and w[t] > 0.01:
            lim = 1.0 if shots.CAT[k] == 'BW' else m   # janela presa na silhueta (sem halo no ceu)
            cx, cy, fw, fh = tr[t]
            ex = fw * 1.25; ey = fh * 1.6
            d = np.sqrt(((_xx - cx) / ex) ** 2 + ((_yy - (cy + fh * 0.25)) / ey) ** 2)
            st += c['face'] * w[t] * (1 - _ss(0.35, 1.0, d)) * lim
    return st


# ---------- grao ----------
_GRAIN = {}
def grain_plate(h, w, seed):
    key = (h, w, seed)
    if key not in _GRAIN:
        rng = np.random.default_rng(seed)
        g = rng.standard_normal((h + 64, w + 64), dtype=np.float32)
        s = 0.9 * w / 3840
        if s > 0.3:
            g = cv2.GaussianBlur(g, (0, 0), s)
        g /= g.std()
        _GRAIN[key] = g
    return _GRAIN[key]


def apply(k, n, img, grain=True):
    """img: HxWx3 float32 display 0..1 (ja gradado pela LUT)."""
    H, W = img.shape[:2]
    c = cfg(k)
    st = gain_map(k, n)
    if np.abs(st).max() > 1e-4:
        g = np.exp2(st / 2.4).astype(np.float32)   # stops -> ganho em display gamma 2.4
        g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)
        img = img * g[..., None]
    if c['hal']:
        small = cv2.resize(img, (GW, GH), interpolation=cv2.INTER_AREA)
        Y = small @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        hl = _ss(0.72, 0.98, Y)
        hl = cv2.GaussianBlur(hl, (0, 0), 5)
        hal = np.stack([hl * 1.0, hl * 0.38, hl * 0.14], -1) * c['hal']
        hal = cv2.resize(hal, (W, H), interpolation=cv2.INTER_LINEAR)
        img = img + hal * (1 - img)      # screen
    img = np.clip(img, 0, 1)
    if grain and shots.CAT[k] != 'CREDITS':
        pl = grain_plate(H, W, n % 3)
        rng = np.random.default_rng(n)
        oy, ox = rng.integers(0, 64, 2)
        gr = pl[oy:oy + H, ox:ox + W]
        Y = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        amp = 0.012 * (0.35 + 2.6 * Y * (1 - Y))
        img = img + (gr * amp)[..., None]
    return np.clip(img, 0, 1)


def preview_apply(k, img, n=None):
    if n is None:
        a, e = shots.SEGS[k]; n = (a + e) // 2
    return apply(k, n, img, grain=False)
