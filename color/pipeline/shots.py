"""Decupagem de color: categoria + ajustes finos por take."""
import json, numpy as np

SEGS = json.load(open('segs.json'))
STATS = json.load(open('stats.json'))

CAT = {}
def setcat(c, ids):
    for i in ids: CAT[i] = c

setcat('AI',       [0, 38, 39, 41, 42, 59, 66, 67, 74, 77, 82])
setcat('EXT_FLAT', [1])
setcat('INT',      [2, 5, 6, 7, 10, 11, 15, 16, 19, 20, 21, 22, 25, 35, 46, 47, 48, 49, 50, 60, 61, 71, 75])
setcat('SUNSET',   [3])
setcat('LAMP',     [4])
setcat('EXT_DAY',  [8, 9, 14, 17, 18, 23, 30, 31, 32, 37, 40, 43, 44, 45, 51, 52])
setcat('FX',       [12, 13, 33, 34])
setcat('FLASH',    [24])
setcat('BW',       [26, 27, 28, 29])
setcat('FIRE_FLAT',[36, 55, 57])
setcat('NIGHT',    [54, 56, 63, 64, 68, 72, 79])
setcat('AI_NIGHT', [53, 58, 62, 65, 69, 70, 76])
setcat('AI_FIRE',  [73, 78, 80, 81, 83, 84, 85, 86, 87])
setcat('CREDITS',  [88])

# alvos por categoria: white(Y99.5 alvo), med(Y50 alvo), wb alvo dos meios (r/g, b/g) e forca,
# quanto do preto medido remover, contraste, sat, look
TARGET = {
    'INT':      dict(tw=0.84, tm=0.25, nab=(0.006, 0.020), wbs=0.8, bk=1.0, contrast=1.06, sat=1.30),
    'EXT_DAY':  dict(tw=0.90, tm=None, nab=(-0.004, -0.008), wbs=0.6, bk=1.0, contrast=1.08, sat=1.02),
    'EXT_FLAT': dict(tw=0.80, tm=0.38, nab=(-0.006, -0.010), wbs=0.6,  bk=1.0, contrast=1.05, sat=1.10),
    'NIGHT':    dict(tw=0.86, tm=None, nab=None, bk=1.0, contrast=1.05, sat=1.08),
    'FIRE_FLAT':dict(tw=0.88, tm=0.22, nab=(0.006, 0.016), wbs=0.6,  bk=1.0, contrast=1.08, sat=1.25),
    'AI':       dict(tw=None, tm=None, nab=None, bk=0.8, contrast=1.0, sat=0.92),
    'AI_NIGHT': dict(tw=None, tm=None, nab=None, bk=0.8, contrast=1.0, sat=0.92),
    'AI_FIRE':  dict(tw=None, tm=None, nab=None, bk=0.8, contrast=1.0, sat=0.95),
    'SUNSET':   dict(tw=None, tm=None, nab=None, bk=1.0, contrast=1.0, sat=1.0),
    'LAMP':     dict(tw=None, tm=None, nab=None, bk=1.0, contrast=1.0, sat=1.0),
    'FLASH':    dict(tw=0.90, tm=None, nab=None, bk=1.0, contrast=1.02, sat=0.95),
    'BW':       dict(tw=None, tm=None, nab=None, bk=0.0, contrast=1.0, sat=0.0),
    'FX':       dict(tw=None, tm=None, nab=None, bk=0.0, contrast=1.0, sat=1.0),
}

# ajustes manuais por take (sobrescrevem o automatico)
OVR = {
    20: dict(wb=(1.04, 1.0, 0.90)),                 # teto ciano / camisa azulada
    22: dict(wb=(1.0, 1.0, 1.0)),                   # janela estourada: nao mexer no balanco
    24: dict(hi_warm=1.8, sat=0.88, floor=2.2),     # flashback: memoria quente e levemente fade
    26: dict(gamma=0.92), 27: dict(gamma=0.96),
    36: dict(hi_warm=2.2, sat=1.35),                # fogo no dia: devolve o ambar da chama
    55: dict(hi_warm=2.0, sat=1.3),
    61: dict(wb=(1.16, 0.95, 0.82)), 47: dict(wb=(1.15, 0.95, 0.84)),
}


_SAMP = None
def samples(k):
    global _SAMP
    import cv2
    if _SAMP is None:
        _SAMP = json.load(open('samples.json'))
    a, e = SEGS[k]
    xs = []
    for i, f in enumerate(_SAMP):
        if a <= f < e:
            im = cv2.imread(f'samp_{i+1:04d}.png')[:, :, ::-1]
            im = cv2.resize(im, (240, 135), interpolation=cv2.INTER_AREA)
            xs.append(im.reshape(-1, 3).astype(np.float32) / 255)
    return np.concatenate(xs)


def neutral_match(k, P, nab, strength):
    import grade
    x = samples(k)
    b = np.asarray(P['black'], np.float32)
    x = np.maximum((x - b) / (P['white'] - b), 0) ** P['gamma']
    lin = x ** 2.4
    lab = grade.to_oklab(np.maximum(lin, 1e-6))
    C = np.hypot(lab[:, 1], lab[:, 2])
    m = (C < 0.05) & (lab[:, 0] > 0.3) & (lab[:, 0] < 0.92)
    if m.sum() < 200:
        m = (lab[:, 0] > 0.3) & (lab[:, 0] < 0.92)
        C_ok = np.percentile(C[m], 35); m = m & (C <= C_ok)
    if m.sum() < 50:
        return (1.0, 1.0, 1.0)
    n = lin[m].mean(0)
    Ln = grade.to_oklab(n[None])[0]
    tgt = grade.from_oklab(np.array([[Ln[0], nab[0], nab[1]]], np.float32))[0]
    gains = np.clip(tgt / n, 1e-3, None) ** strength
    gains = gains / (gains @ [0.2126, 0.7152, 0.0722])
    gains = np.clip(gains, 0.88, 1.12)
    return tuple(float(v) for v in gains)


def auto_params(k):
    s = STATS[k]; c = CAT[k]
    if c == 'CREDITS':
        return None
    T = TARGET[c]
    P = {}
    blk = np.array(s['blk'], np.float32) * T['bk']
    bY = float(blk @ [0.2126, 0.7152, 0.0722])
    w = 1.0
    if T.get('tw') and s['Y99'] < T['tw'] + 0.04:
        w = bY + (s['Y99'] - bY) / T['tw']
    elif T['bk'] > 0:
        w = 1.0
    P['black'] = tuple(float(v) for v in blk)
    P['white'] = float(w)
    g = 1.0
    if T.get('tm'):
        m = (s['Y50'] - bY) / (w - bY)
        m = min(max(m, 0.02), 0.95)
        g = float(np.clip(np.log(T['tm']) / np.log(m), 0.65, 1.5))
    P['gamma'] = g
    if T.get('nab') is not None:
        P['wb'] = neutral_match(k, P, T['nab'], T.get('wbs', 1.0))
    P['contrast'] = T['contrast']
    P['sat'] = T['sat']
    if c == 'BW':
        P['mono'] = True; P['split'] = 0.6
    if c == 'FX':
        P['look'] = 0.7
    return P


def params(k):
    P = auto_params(k)
    if P is None:
        return None
    P.update(OVR.get(k, {}))
    return P
