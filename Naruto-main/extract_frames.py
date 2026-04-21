import cv2, os, json

video_path = r'd:\Game\ai\ai.btoan.com\Naruto-main\viet_nguyen_AI_full_demo.mp4'
out_dir = r'd:\Game\ai\ai.btoan.com\Naruto-main\frames'
os.makedirs(out_dir, exist_ok=True)

cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
duration = total_frames / fps if fps > 0 else 0

print(json.dumps({
    'fps': fps,
    'total_frames': total_frames,
    'width': w,
    'height': h,
    'duration_sec': round(duration, 2)
}))

# Extract frames at ~5 second intervals
interval_sec = 5
interval_frames = int(fps * interval_sec)
captured = []

for i in range(0, total_frames, interval_frames):
    cap.set(cv2.CAP_PROP_POS_FRAMES, i)
    ret, frame = cap.read()
    if ret:
        t = round(i / fps, 1)
        fname = 'frame_t{:06.1f}s.jpg'.format(t)
        out_path = os.path.join(out_dir, fname)
        cv2.imwrite(out_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        captured.append({'frame': i, 'time_sec': t, 'file': fname})

cap.release()
print('Extracted {} frames'.format(len(captured)))
for c in captured:
    print(c['file'], '@', c['time_sec'], 's')
