"""Render 4K: decode -> LUT 3D do take (256^3, exata p/ 8 bits) -> nodes espaciais -> encode.
uso: python3 render.py <k_ini> <k_fim> <saida.mp4>"""
import sys, subprocess, time, numpy as np
import grade, shots, spatial

W, H = 3840, 2160
FPS_NUM, FPS_DEN = 24000, 1001
BLEND = {1226: 8, 2053: 8}   # cortes com transicao (whip/wipe): mistura as LUTs vizinhas
FF = 'ffmpeg'

k0, k1, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
a0 = shots.SEGS[k0][0]; e1 = shots.SEGS[k1 - 1][1]
nfr = e1 - a0

dec = subprocess.Popen([FF, '-v', 'error', '-threads', '2', '-ss', f'{(a0 - 0.5) * FPS_DEN / FPS_NUM:.6f}', '-i', 'src.mp4',
                        '-frames:v', str(nfr), '-an',
                        '-vf', 'scale=in_color_matrix=bt709:in_range=tv:out_range=full:flags=accurate_rnd+full_chroma_int+bicubic,format=rgb24',
                        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE, bufsize=W * H * 3 * 2)
enc = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                        '-framerate', f'{FPS_NUM}/{FPS_DEN}', '-color_range', 'pc', '-i', '-',
                        '-vf', 'scale=out_color_matrix=bt709:out_range=tv:in_range=full:flags=accurate_rnd+full_chroma_int,format=yuv420p',
                        '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-profile:v', 'high',
                        '-x264-params', 'aq-mode=3:threads=3:rc-lookahead=16',
                        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
                        out], stdin=subprocess.PIPE)

LUTS = {}
def lut(k):
    if k not in LUTS:
        for kk in list(LUTS):
            if kk < k - 1: del LUTS[kk]
        P = shots.params(k)
        LUTS[k] = None if P is None else grade.build_lut(P)
    return LUTS[k]

def seg_of(n):
    for k in range(k0, k1):
        a, e = shots.SEGS[k]
        if a <= n < e: return k

def apply_lut(L, idx, x8):
    if L is None:
        return x8.astype(np.float32) / 255
    return L[idx].astype(np.float32) * (1 / 65535)

t0 = time.time()
for n in range(a0, e1):
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        print('decode curto em', n, file=sys.stderr); break
    x8 = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    k = seg_of(n)
    idx = (x8[..., 0].astype(np.int32) << 16) | (x8[..., 1].astype(np.int32) << 8) | x8[..., 2]
    img = apply_lut(lut(k), idx, x8)
    # transicoes: mistura com o take vizinho
    a, e = shots.SEGS[k]
    for c, half in BLEND.items():
        if abs(n - c) < half and k0 <= (k - 1 if n >= c else k + 1) < k1:
            other = k - 1 if n >= c else k + 1
            wgt = 0.5 * (1 - (abs(n - c) + 0.5) / half)   # 0.5 no corte -> 0 nas bordas
            img = img * (1 - wgt) + apply_lut(lut(other), idx, x8) * wgt
    if shots.CAT[k] != 'CREDITS':
        img = spatial.apply(k, n, img)
    o = np.empty((H, W, 3), np.uint8)
    np.multiply(img, 255, out=img); img += 0.5
    np.copyto(o, img, casting='unsafe')
    enc.stdin.write(o.tobytes())
    if (n - a0) % 48 == 0:
        el = time.time() - t0
        print(f'[{k0}-{k1}] frame {n - a0}/{nfr}  {el / max(1, n - a0 + 1):.2f}s/f', file=sys.stderr, flush=True)
enc.stdin.close(); enc.wait(); dec.wait()
print(f'[{k0}-{k1}] ok {nfr} frames em {time.time() - t0:.0f}s', file=sys.stderr)
