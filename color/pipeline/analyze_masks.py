import cv2, numpy as np, mediapipe as mp
fd = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.45)
fd0 = mp.solutions.face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5)
sg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
cap = cv2.VideoCapture('proxy.mp4')
faces = []; segs = []
i = 0
while True:
    ok, f = cap.read()
    if not ok: break
    rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
    best = None
    for det in (fd0, fd):
        r = det.process(rgb)
        if r.detections:
            d = max(r.detections, key=lambda d: d.location_data.relative_bounding_box.width)
            bb = d.location_data.relative_bounding_box
            cand = (bb.xmin + bb.width / 2, bb.ymin + bb.height / 2, bb.width, bb.height, d.score[0])
            if best is None or cand[2] > best[2]: best = cand
    faces.append(best if best else (np.nan,) * 5)
    m = sg.process(rgb).segmentation_mask
    segs.append((cv2.resize(m, (320, 180), interpolation=cv2.INTER_AREA) * 255).astype(np.uint8))
    i += 1
np.save('faces.npy', np.array(faces, np.float32))
np.save('segmask.npy', np.stack(segs))
print(i, np.isfinite(np.array(faces)[:, 0]).sum())
