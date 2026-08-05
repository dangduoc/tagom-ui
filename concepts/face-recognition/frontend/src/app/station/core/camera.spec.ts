import { describe, expect, it } from 'vitest';

import { Box, onlyVisible, pickTarget, visibleRegion } from './camera';

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

/** A face of a given height, centred on (cx, cy). */
function faceAt(cx: number, cy: number, size: number): Box {
  return { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
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

describe('pickTarget (close + centred, biggest wins)', () => {
  // 1280x720 in a 520x520 box: visible x∈[280,1000], y∈[0,720]; centre zone
  // (0.6) is cx∈[424,856], cy∈[144,576]; min face height is 0.2*720 = 144.
  const video = fakeVideo(1280, 720, 520, 520);

  it('picks a close, centred face', () => {
    const face = faceAt(640, 360, 200);
    expect(pickTarget(video, [face])).toEqual(face);
  });

  it('ignores a face that is too small (too far away)', () => {
    expect(pickTarget(video, [faceAt(640, 360, 100)])).toBeNull();
  });

  it('ignores a big face off to the side (not centred)', () => {
    // Visible on screen, but its centre is past the central zone.
    expect(pickTarget(video, [faceAt(950, 360, 200)])).toBeNull();
  });

  it('among three faces, takes the biggest that is also close and centred', () => {
    const target = faceAt(640, 360, 200); // close + centred
    const biggerButOffCentre = faceAt(950, 360, 260); // largest, but at the edge
    const centredButFar = faceAt(500, 300, 100); // centred, but too small
    expect(pickTarget(video, [biggerButOffCentre, centredButFar, target])).toEqual(target);
  });

  it('between two qualifying faces, takes the larger (closer) one', () => {
    const near = faceAt(760, 360, 220);
    const farther = faceAt(500, 360, 160);
    expect(pickTarget(video, [farther, near])).toEqual(near);
  });
});
