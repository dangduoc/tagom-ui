/** Shared camera plumbing for the identify and register screens. */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Padding around a detected box when cropping for /api/recognize. MediaPipe
 *  boxes are tight and the server-side SCRFD detector fails when the face fills
 *  the whole crop — so pad generously. Keep in sync with the backend fallback. */
export const CROP_PADDING = 0.75;

// Opening and releasing the device lives in CameraService — it has to be shared
// so that moving between the identify and register screens doesn't re-prompt.

export function largestBox(boxes: Box[]): Box | null {
  let best: Box | null = null;
  for (const b of boxes) {
    if (!best || b.width * b.height > best.width * best.height) best = b;
  }
  return best;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
}

/** Full current frame as a JPEG — used for the register screen's 5 shots. */
export function captureFrame(video: HTMLVideoElement, quality = 0.9): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return toJpeg(canvas, quality);
}

/** Padded crop around a detected face, as a JPEG. Null when the crop is too small. */
export function cropFace(
  video: HTMLVideoElement,
  box: Box,
  canvas: HTMLCanvasElement,
  quality = 0.85,
): Promise<Blob> | null {
  const padX = box.width * CROP_PADDING;
  const padY = box.height * CROP_PADDING;
  const sx = Math.max(0, box.x - padX);
  const sy = Math.max(0, box.y - padY);
  const sw = Math.min(video.videoWidth - sx, box.width + 2 * padX);
  const sh = Math.min(video.videoHeight - sy, box.height + 2 * padY);
  if (sw < 32 || sh < 32) return null;

  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return toJpeg(canvas, quality);
}
