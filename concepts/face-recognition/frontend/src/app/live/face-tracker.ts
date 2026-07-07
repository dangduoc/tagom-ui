/** IoU-based face tracking across frames, so recognition is not re-run per frame. */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TrackState = 'pending' | 'known' | 'unknown';

export interface FaceTrack {
  id: number;
  box: Box;
  lastSeen: number;
  state: TrackState;
  label: string | null;
  similarity: number | null;
  lastRecognizedAt: number | null;
  inFlight: boolean;
}

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  const union = a.width * a.height + b.width * b.height - inter;
  return inter / union;
}

const IOU_MIN = 0.25;
const TRACK_EXPIRY_MS = 600;

export class FaceTracker {
  private nextId = 1;
  private readonly tracks = new Map<number, FaceTrack>();

  /** Match this frame's detections to existing tracks; returns the live tracks. */
  update(boxes: Box[], now: number): FaceTrack[] {
    const unmatched = new Set(this.tracks.keys());
    const current: FaceTrack[] = [];

    for (const box of boxes) {
      let bestId: number | null = null;
      let bestIou = IOU_MIN;
      for (const id of unmatched) {
        const score = iou(box, this.tracks.get(id)!.box);
        if (score > bestIou) {
          bestIou = score;
          bestId = id;
        }
      }

      if (bestId !== null) {
        const track = this.tracks.get(bestId)!;
        track.box = box;
        track.lastSeen = now;
        unmatched.delete(bestId);
        current.push(track);
      } else {
        const track: FaceTrack = {
          id: this.nextId++,
          box,
          lastSeen: now,
          state: 'pending',
          label: null,
          similarity: null,
          lastRecognizedAt: null,
          inFlight: false,
        };
        this.tracks.set(track.id, track);
        current.push(track);
      }
    }

    for (const [id, track] of this.tracks) {
      if (now - track.lastSeen > TRACK_EXPIRY_MS) this.tracks.delete(id);
    }

    return current;
  }

  clear(): void {
    this.tracks.clear();
  }
}
