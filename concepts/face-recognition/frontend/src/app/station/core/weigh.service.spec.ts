import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScaleReading, ScaleService } from '../../scale/scale.service';
import { WeighService } from './weigh.service';

/** Drives WeighService off a fake scale stream to check the settling → stable →
 *  locked machine, since the real DS-166SS can't be attached in a test. */
describe('WeighService', () => {
  const reading = signal<ScaleReading | null>(null);
  let weigh: WeighService;

  const tick = (ms: number) => vi.advanceTimersByTime(ms);
  const put = (weight: number, stable: boolean) =>
    reading.set({ weight, stable, unit: 'kg' });

  beforeEach(() => {
    vi.useFakeTimers();
    reading.set(null);
    TestBed.configureTestingModule({
      providers: [{ provide: ScaleService, useValue: { reading, status: signal('connected') } }],
    });
    weigh = TestBed.inject(WeighService);
  });

  afterEach(() => {
    weigh.stop();
    vi.useRealTimers();
  });

  it('locks after the weight has held steady, and reports the final value once', () => {
    const locked = vi.fn();
    weigh.start(locked);
    expect(weigh.phase()).toBe('settling');

    // Load still moving.
    put(1.8, false);
    tick(100);
    expect(weigh.phase()).toBe('settling');
    expect(weigh.live()).toBeCloseTo(1.8, 5);

    // Scale reports steady — the hold starts.
    put(3.24, true);
    tick(100);
    expect(weigh.phase()).toBe('stable');
    expect(weigh.holdPct()).toBe(0);

    // Half way through the hold.
    tick(1000);
    expect(weigh.phase()).toBe('stable');
    expect(weigh.holdPct()).toBeGreaterThan(40);
    expect(weigh.holdPct()).toBeLessThan(60);
    expect(locked).not.toHaveBeenCalled();

    // Hold completes.
    tick(1100);
    expect(weigh.phase()).toBe('locked');
    expect(locked).toHaveBeenCalledTimes(1);
    expect(locked).toHaveBeenCalledWith(3.24);

    // The machine stops at lock — no second row from later frames.
    tick(3000);
    expect(locked).toHaveBeenCalledTimes(1);
  });

  it('never locks an effectively empty scale, even when it reports stable', () => {
    const locked = vi.fn();
    weigh.start(locked);

    put(0.01, true);
    tick(4000);

    expect(weigh.phase()).toBe('settling');
    expect(locked).not.toHaveBeenCalled();
  });

  it('restarts the hold when the load changes part-way through', () => {
    const locked = vi.fn();
    weigh.start(locked);

    put(2.0, true);
    tick(1500); // most of the way through the hold

    // Something else is added to the scale.
    put(5.0, true);
    tick(100);
    expect(weigh.holdPct()).toBe(0);
    expect(locked).not.toHaveBeenCalled();

    tick(2100);
    expect(locked).toHaveBeenCalledWith(5);
  });

  it('falls back to settling when the scale stream drops out', () => {
    const locked = vi.fn();
    weigh.start(locked);

    put(3.0, true);
    tick(1000);
    expect(weigh.phase()).toBe('stable');

    reading.set(null); // connection lost / reading went stale
    tick(200);
    expect(weigh.phase()).toBe('settling');

    tick(5000);
    expect(locked).not.toHaveBeenCalled();
  });
});
