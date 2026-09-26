import cv2, numpy as np, json
cap=cv2.VideoCapture('proxy.mp4')
prev=None; scores=[]; stats=[]
while True:
    ok,f=cap.read()
    if not ok: break
    small=cv2.resize(f,(160,90),interpolation=cv2.INTER_AREA)
    hsv=cv2.cvtColor(small,cv2.COLOR_BGR2HSV)
    h=cv2.calcHist([hsv],[0,1,2],None,[16,8,8],[0,180,0,256,0,256]); h=cv2.normalize(h,h).flatten()
    g=cv2.cvtColor(small,cv2.COLOR_BGR2GRAY).astype(np.float32)
    if prev is None: scores.append((0,0))
    else:
        hd=cv2.compareHist(prev[0],h,cv2.HISTCMP_BHATTACHARYYA)
        pd=np.mean(np.abs(g-prev[1]))/255
        scores.append((hd,pd))
    prev=(h,g)
    stats.append([float(g.mean())])
s=np.array(scores); np.save('scores.npy',s); np.save('luma.npy',np.array(stats))
print(len(s))
