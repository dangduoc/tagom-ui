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

/**
 * The part of the intrinsic video frame that is actually visible on screen, in
 * intrinsic pixels.
 *
 * The feed is shown with `object-fit: cover`: the frame is scaled to fill its
 * box and the overflow is cropped, so the camera's field of view extends past
 * what the person sees (a 16:9 stream in a square box hides ~22% of the width on
 * each side). Detection must be confined to this region — otherwise a face in
 * the hidden side margin is recognised while the person believes they have
 * stepped out of frame. Falls back to the whole frame before layout/metadata.
 */
export function visibleRegion(video: HTMLVideoElement): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  if (!vw || !vh || !cw || !ch) return { left: 0, top: 0, right: vw, bottom: vh };
  // cover: scale to fill, centre, crop the overflow back into intrinsic pixels.
  const scale = Math.max(cw / vw, ch / vh);
  const cropX = (vw * scale - cw) / 2 / scale;
  const cropY = (vh * scale - ch) / 2 / scale;
  return { left: cropX, top: cropY, right: vw - cropX, bottom: vh - cropY };
}

/** Keep only faces whose centre is within the on-screen crop (see visibleRegion),
 *  so what the person sees is exactly what gets scanned. */
export function onlyVisible(video: HTMLVideoElement, boxes: Box[]): Box[] {
  const r = visibleRegion(video);
  return boxes.filter((b) => {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  });
}

// ── Choosing which face to identify ──────────────────────────────────────────
// A passer-by at the edge, or someone far across the room, should not be
// scanned: only the person standing at the kiosk is. Two tunable gates express
// that — both are fractions of the on-screen (visible) region, so they hold
// across screen sizes.

/** Face box must be at least this tall, as a fraction of the visible height —
 *  the "come close enough" gate. Roughly a face filling a fifth of the frame. */
export const MIN_FACE_HEIGHT_FRAC = 0.2;

/** The face centre must fall inside this central fraction of the visible region
 *  — the "stand in front, not at the edge" gate. ~0.6 tracks the on-screen
 *  brackets, so putting your face in them is what gets you scanned. */
export const CENTER_ZONE_FRAC = 0.6;

/**
 * The one face to try to identify: the largest that is both close enough
 * (>= MIN_FACE_HEIGHT_FRAC tall) and centred (its centre within the central
 * CENTER_ZONE_FRAC of the frame). With several faces in view this is the person
 * at the kiosk — biggest wins, but only among those who also stand centre. Null
 * when nobody qualifies, so a distant or edge face is simply ignored.
 */
export function pickTarget(video: HTMLVideoElement, boxes: Box[]): Box | null {
  const r = visibleRegion(video);
  const rw = r.right - r.left;
  const rh = r.bottom - r.top;
  if (rw <= 0 || rh <= 0) return null;

  const marginX = (rw * (1 - CENTER_ZONE_FRAC)) / 2;
  const marginY = (rh * (1 - CENTER_ZONE_FRAC)) / 2;
  const minH = rh * MIN_FACE_HEIGHT_FRAC;

  const eligible = boxes.filter((b) => {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    return (
      b.height >= minH &&
      cx >= r.left + marginX &&
      cx <= r.right - marginX &&
      cy >= r.top + marginY &&
      cy <= r.bottom - marginY
    );
  });
  return largestBox(eligible);
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
