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

  // ── the entry flow: chooser → Face ID | phone | register ──

  it('starts a session on the chooser, not the camera', () => {
    // What a tap on the idle poster does — there is no mode choice any more, so
    // every session is sorted and the category grid is always shown.
    station.startSorted();

    expect(station.screen()).toBe('login');
    expect(station.mode()).toBe('sorted');
    // The camera screen must be chosen, never arrived at by default.
    expect(station.isEntry()).toBe(true);
    expect(station.inFlow()).toBe(false);
  });

  it('opens the phone screen with a clear keypad', () => {
    station.startSorted();
    station.pressKey('9');
    station.goPhone();

    expect(station.screen()).toBe('phone');
    expect(station.keypad()).toBe('');
    expect(station.keypadMiss()).toBeNull();
  });

  it('confirms a person found by phone number', async () => {
    api.getPerson.mockResolvedValue({
      person: {
        code: '0901234567',
        full_name: 'Chị Lan',
        phone: '090 ••• 67',
        member_since: '2026-01-04 10:00:00',
        has_face_data: false,
      },
      sessions: [],
      personal_total: 0,
      session_count: 0,
    });

    station.startSorted();
    station.goPhone();
    for (const d of '0901234567') station.pressKey(d);
    await station.lookupPhone();

    expect(station.screen()).toBe('confirmed');
    expect(station.account()?.fullName).toBe('Chị Lan');
  });

  it('keeps an unknown number on the phone screen instead of dropping the person', async () => {
    station.startSorted();
    station.goPhone();
    for (const d of '0900000000') station.pressKey(d);
    await station.lookupPhone();

    expect(station.screen()).toBe('phone');
    expect(station.keypadMiss()).toBe('notfound');
  });

  // The bug behind "I typed my number and it said I have no account": the store
  // swallowed every failure into null, so an unreachable backend was reported as
  // an unknown number — sending someone with a good account off to register a
  // duplicate.
  it('says the system is unreachable, not that the account is missing', async () => {
    api.getPerson.mockRejectedValue(new Error('network down'));

    station.startSorted();
    station.goPhone();
    for (const d of '0338004227') station.pressKey(d);
    await station.lookupPhone();

    expect(station.screen()).toBe('phone');
    expect(station.keypadMiss()).toBe('offline');
    expect(station.keypadBusy()).toBe(false);
  });

  it('sends "not me" back to the chooser, not to the camera that got it wrong', () => {
    station.startSorted();
    station.identifiedAs({
      code: '0901234567',
      full_name: 'Chị Lan',
      department: '',
      similarity: 0.7,
    });
    expect(station.screen()).toBe('confirmed');

    station.notMe();
    expect(station.screen()).toBe('login');
    expect(station.identity()).toBeNull();
  });

  it('returns to the chooser from register, keeping the mode picked on idle', () => {
    station.startQuick();
    station.goRegister();
    expect(station.screen()).toBe('register');

    station.back();
    expect(station.screen()).toBe('login');
    expect(station.mode()).toBe('quick');
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

  // The bug: on a station with no camera, dismissing the card let the identify
  // screen's effect re-raise it on the next run, which also re-prompted for
  // permission. Dismissing has to stick for the rest of the session.
  it('keeps the camera card dismissed once the person waves it away', () => {
    station.reportCameraFault('missing');
    expect(station.error()).toBe('camera');

    station.dismissError();
    expect(station.error()).toBeNull();

    // The identify screen reports the same fault on every effect run.
    station.reportCameraFault('missing');
    station.reportCameraFault('missing');
    expect(station.error()).toBeNull();
  });

  it('lets a new person see the camera card again, without re-asking the browser', () => {
    station.reportCameraFault('missing');
    station.dismissError();
    station.reset();

    station.reportCameraFault('missing');
    expect(station.error()).toBe('camera');
    // The fault itself survives the reset, so acquire() still won't prompt.
    expect(station.cameraFault()).toBe('missing');
  });

  it('retryCamera clears the fault so the next attempt really asks', () => {
    station.reportCameraFault('denied');
    station.dismissError();

    station.retryCamera();
    expect(station.error()).toBeNull();
    expect(station.cameraFault()).toBeNull();

    // Un-muted again, so a fresh failure is allowed to surface.
    station.reportCameraFault('denied');
    expect(station.error()).toBe('camera');
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
