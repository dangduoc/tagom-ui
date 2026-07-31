import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiService } from '../../api.service';
import { StationService } from './station.service';

/** Covers the behaviours the handoff flags as easy to get wrong (§8). */
describe('StationService', () => {
  let station: StationService;
  let api: {
    getStats: ReturnType<typeof vi.fn>;
    getPerson: ReturnType<typeof vi.fn>;
    recordSession: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();
    api = {
      getStats: vi.fn().mockResolvedValue({
        community_total: 12480.5,
        community_base: 12480.5,
        community_goal: 15000,
      }),
      getPerson: vi.fn().mockResolvedValue(null),
      recordSession: vi
        .fn()
        .mockResolvedValue({ session_id: 1, total: 0, community_total: 12483 }),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api }],
    });
    station = TestBed.inject(StationService);
  });

  afterEach(() => {
    station.weigh.stop();
    localStorage.clear();
  });

  it('routes quick mode straight to an unsorted weigh, never the tile grid', () => {
    station.startQuick();
    station.skip();

    expect(station.screen()).toBe('weigh');
    expect(station.currentCat()).toBe('chuaphanloai');
  });

  it('keeps quick mode out of the category grid on "weigh another" too', () => {
    station.startQuick();
    station.skip();
    station.pickAgain();

    expect(station.screen()).toBe('weigh');
    expect(station.currentCat()).toBe('chuaphanloai');
  });

  it('sends sorted mode to the category picker', () => {
    station.startSorted();
    station.skip();

    expect(station.screen()).toBe('category');
  });

  it('treats anonymous as first-class: it weighs, but has no profile', () => {
    station.startSorted();
    station.skip();

    expect(station.isAnon()).toBe(true);
    expect(station.account()).toBeNull();

    station.openProfile();
    expect(station.screen()).not.toBe('profile');
  });

  it('recomputes the total when a row is deleted from the rail', () => {
    station.startSorted();
    station.skip();
    station.pick('nhua');
    station.weigh.stop();

    // Two rows recorded by the scale.
    station['addItem']('nhua', 3.2);
    station['addItem']('giay', 1.8);
    expect(station.sessionTotal()).toBeCloseTo(5.0, 5);

    station.removeItem(station.items()[0].id);
    expect(station.items().length).toBe(1);
    expect(station.sessionTotal()).toBeCloseTo(1.8, 5);
  });

  it('keeps the scale-offline card dismissed while the scale is still down', () => {
    station.startSorted();
    station.skip();
    station.pick('nhua');
    station.weigh.stop();

    // No scale is connected in the test env, so the card raises itself.
    TestBed.tick();
    expect(station.error()).toBe('scale');

    station.dismissError();
    TestBed.tick();
    expect(station.error()).toBeNull();
  });

  it('will not finish an empty session', () => {
    station.startSorted();
    station.skip();
    station.gotoSummary();

    expect(station.screen()).not.toBe('summary');
  });

  it('posts an anonymous session and still counts it for the station', async () => {
    station.startSorted();
    station.skip();
    station['addItem']('nhua', 2.5);
    station.gotoSummary();

    expect(station.screen()).toBe('summary');
    // Anonymous: recorded with no code, so nobody is credited.
    expect(api.recordSession).toHaveBeenCalledWith(null, [
      { category: 'nhua', weight: 2.5 },
    ]);

    await Promise.resolve();
    await Promise.resolve();
    expect(station.communityTotal()).toBeCloseTo(12483, 5);
  });

  it('queues a session for later when the upload fails, rather than losing it', async () => {
    api.recordSession.mockRejectedValue(new Error('offline'));
    await vi.waitFor(() => expect(station.communityTotal()).toBeGreaterThan(0));
    const before = station.communityTotal();

    station.startSorted();
    station.skip();
    station['addItem']('nhua', 2.5);
    station.gotoSummary();

    // The summary still shows the visit counted, optimistically.
    expect(station.communityTotal()).toBeCloseTo(before + 2.5, 5);

    await vi.waitFor(() => expect(localStorage.getItem('tagom.station.outbox')).toBeTruthy());
    const queued = JSON.parse(localStorage.getItem('tagom.station.outbox')!);
    expect(queued).toEqual([{ code: null, items: [{ category: 'nhua', weight: 2.5 }] }]);
  });

  it('returns to idle on reset', () => {
    station.startSorted();
    station.skip();
    station['addItem']('nhua', 2.5);
    station.gotoSummary();

    station.reset();
    expect(station.screen()).toBe('idle');
    expect(station.items()).toEqual([]);
    expect(station.identity()).toBeNull();
  });
});
