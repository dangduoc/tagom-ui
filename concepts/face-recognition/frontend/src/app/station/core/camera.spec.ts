import { describe, expect, it } from 'vitest';

import { Box, onlyVisible, visibleRegion } from './camera';

/** A video element with just the dimensions the geometry reads. */
function fakeVideo(
  videoWidth: number,
  videoHeight: number,
  clientWidth: number,
  clientHeight: number,
): HTMLVideoElement {
  return { videoWidth, videoHeight, clientWidth, clientHeight } as HTMLVideoElement;
}

function box(x: number, y: number, size = 80): Box {
  return { x, y, width: size, height: size };
}

describe('visibleRegion (object-fit: cover crop)', () => {
  it('hides the side margins of a 16:9 stream shown in a square box', () => {
    // 1280x720 filling a 520x520 box: height drives the scale, so the left and
    // right ~22% of width are cropped off screen; full height stays visible.
    const r = visibleRegion(fakeVideo(1280, 720, 520, 520));
    expect(r.left).toBeCloseTo(280, 0);
    expect(r.right).toBeCloseTo(1000, 0);
    expect(r.top).toBeCloseTo(0, 0);
    expect(r.bottom).toBeCloseTo(720, 0);
  });

  it('falls back to the whole frame before the video has laid out', () => {
    const r = visibleRegion(fakeVideo(0, 0, 0, 0));
    expect(r).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });
});

describe('onlyVisible', () => {
  const video = fakeVideo(1280, 720, 520, 520);

  it('keeps a centred face', () => {
    const centred = box(600, 320); // centre (640, 360)
    expect(onlyVisible(video, [centred])).toEqual([centred]);
  });

  it('drops a face standing in the hidden side margin', () => {
    // Visible to the camera, off the left edge of the on-screen square — the
    // exact "I stepped out but it still sees me" case.
    const sideMargin = box(60, 320); // centre x = 100, left of 280
    expect(onlyVisible(video, [sideMargin])).toEqual([]);
  });

  it('keeps the centred face and drops the margin one together', () => {
    const centred = box(600, 320);
    const sideMargin = box(60, 320);
    expect(onlyVisible(video, [sideMargin, centred])).toEqual([centred]);
  });
});
