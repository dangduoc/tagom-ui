import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CameraService } from './camera.service';

/** A getUserMedia stub plus the track bookkeeping the service relies on. */
function fakeStream(): MediaStream {
  const track = { readyState: 'live', stop: vi.fn(), addEventListener: vi.fn() };
  return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
}

function domError(name: string): DOMException {
  return new DOMException('nope', name);
}

describe('CameraService', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let service: CameraService;

  beforeEach(() => {
    getUserMedia = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia },
      // Permissions API present but uninformative, the common Chrome case
      // before the user has answered the prompt.
      permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
    });
    TestBed.configureTestingModule({});
    service = TestBed.inject(CameraService);
  });

  it('opens the device once and reuses the stream', async () => {
    getUserMedia.mockResolvedValue(fakeStream());

    const first = await service.acquire();
    const second = await service.acquire();

    expect(first).toBe(second);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('shares a single getUserMedia between concurrent callers', async () => {
    getUserMedia.mockResolvedValue(fakeStream());

    const [a, b] = await Promise.all([service.acquire(), service.acquire()]);

    expect(a).toBe(b);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  // The bug: with no camera attached, every re-entry to the identify screen
  // fired another getUserMedia, so dismissing the error card re-prompted.
  it('never asks again once the camera is missing', async () => {
    getUserMedia.mockRejectedValue(domError('NotFoundError'));

    expect(await service.acquire()).toBeNull();
    expect(service.fault()).toBe('missing');
    expect(service.blocked()).toBe(true);

    expect(await service.acquire()).toBeNull();
    expect(await service.acquire()).toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('never asks again once permission was refused', async () => {
    getUserMedia.mockRejectedValue(domError('NotAllowedError'));

    expect(await service.acquire()).toBeNull();
    expect(service.fault()).toBe('denied');

    await service.acquire();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('retry() is the one path that asks again', async () => {
    getUserMedia.mockRejectedValueOnce(domError('NotAllowedError'));
    await service.acquire();
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    getUserMedia.mockResolvedValue(fakeStream());
    service.retry();
    expect(service.blocked()).toBe(false);

    expect(await service.acquire()).not.toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('retries a busy device, but gives up rather than prompting forever', async () => {
    getUserMedia.mockRejectedValue(domError('NotReadableError'));

    await service.acquire();
    await service.acquire();
    await service.acquire();
    expect(service.fault()).toBe('busy');
    expect(service.blocked()).toBe(true);

    await service.acquire();
    expect(getUserMedia).toHaveBeenCalledTimes(3);
  });

  it('reports an insecure origin without calling getUserMedia', async () => {
    vi.stubGlobal('navigator', { mediaDevices: undefined });

    expect(await service.acquire()).toBeNull();
    expect(service.fault()).toBe('insecure');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('skips the prompt when permission already stands denied', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'denied' }) },
    });

    expect(await service.acquire()).toBeNull();
    expect(service.fault()).toBe('denied');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  // Releasing is deferred so the identify -> register hop reuses the stream
  // instead of triggering a second permission prompt.
  it('keeps the device through a release/acquire hop', async () => {
    const stream = fakeStream();
    getUserMedia.mockResolvedValue(stream);

    await service.acquire();
    service.release();
    const again = await service.acquire();

    expect(again).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stream.getTracks()[0].stop).not.toHaveBeenCalled();
  });

  it('releaseNow() really stops the tracks', async () => {
    const stream = fakeStream();
    getUserMedia.mockResolvedValue(stream);

    await service.acquire();
    service.releaseNow();

    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
    expect(service.live()).toBe(false);
  });
});
