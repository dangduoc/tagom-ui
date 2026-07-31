import { Injectable, inject, signal } from '@angular/core';

import { ScaleService } from '../../scale/scale.service';
import { Phase } from './models';

/** Below this the scale is considered empty — never lock a 0.00 kg reading. */
const MIN_WEIGHT_KG = 0.05;
/** How far the reading may drift while holding before we call it unsettled again. */
const HOLD_TOLERANCE_KG = 0.03;
/** How long the reading must stay put before it locks (the handoff's ~2s hold). */
const HOLD_MS = 2000;
/** State-machine tick. Also paces the hold progress bar. */
const TICK_MS = 100;

/**
 * Turns the live scale stream into the weigh screen's three phases.
 *
 * A single interval drives the machine and calls `lock` from the timer body —
 * deliberately *not* from inside another state update (handoff §8.2).
 */
@Injectable({ providedIn: 'root' })
export class WeighService {
  private readonly scale = inject(ScaleService);

  readonly phase = signal<Phase>('idle');
  /** Live weight in kg, as last read from the scale. */
  readonly live = signal(0);
  /** 0–100, how far through the stability hold we are. */
  readonly holdPct = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;
  private holdSince = 0;
  private anchor = 0;
  private onLock: ((weight: number) => void) | null = null;

  /** Begin (or restart) a weighing. `onLock` fires once, with the final weight. */
  start(onLock: (weight: number) => void): void {
    this.stop();
    this.onLock = onLock;
    this.phase.set('settling');
    this.live.set(0);
    this.holdPct.set(0);
    this.holdSince = 0;
    this.anchor = 0;
    this.timer = setInterval(this.tick, TICK_MS);
  }

  /** Stops the machine. Safe to call repeatedly; always call when leaving weigh. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.onLock = null;
  }

  /** Leaves the locked readout on screen but stops watching the scale. */
  reset(): void {
    this.stop();
    this.phase.set('idle');
    this.live.set(0);
    this.holdPct.set(0);
  }

  private tick = (): void => {
    const reading = this.scale.reading();
    if (!reading) {
      // No frames from the scale (disconnected or stale) — fall back to settling
      // rather than locking whatever number was last on screen.
      this.unsettle();
      return;
    }

    const weight = reading.weight;
    this.live.set(weight);

    const heavyEnough = weight >= MIN_WEIGHT_KG;
    const nearAnchor = Math.abs(weight - this.anchor) <= HOLD_TOLERANCE_KG;

    if (!reading.stable || !heavyEnough) {
      this.unsettle();
      return;
    }

    if (this.holdSince === 0 || !nearAnchor) {
      // First stable frame, or the load changed — (re)start the hold from here.
      this.anchor = weight;
      this.holdSince = Date.now();
      this.phase.set('stable');
      this.holdPct.set(0);
      return;
    }

    const elapsed = Date.now() - this.holdSince;
    this.phase.set('stable');
    this.holdPct.set(Math.min(100, Math.round((elapsed / HOLD_MS) * 100)));

    if (elapsed >= HOLD_MS) this.lock(weight);
  };

  private unsettle(): void {
    this.holdSince = 0;
    this.anchor = 0;
    this.holdPct.set(0);
    if (this.phase() !== 'locked') this.phase.set('settling');
  }

  private lock(weight: number): void {
    const handler = this.onLock;
    this.stop();
    const final = Math.round(weight * 100) / 100;
    this.live.set(final);
    this.holdPct.set(100);
    this.phase.set('locked');
    handler?.(final);
  }
}
