import { TestBed } from '@angular/core/testing';

import { StationService } from './station.service';

/** Covers the behaviours the handoff flags as easy to get wrong (§8). */
describe('StationService', () => {
  let station: StationService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
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

  it('records the session and returns to idle on reset', () => {
    station.startSorted();
    station.skip();
    station['addItem']('nhua', 2.5);
    station.gotoSummary();

    expect(station.screen()).toBe('summary');
    // Anonymous weights still join the station's community total.
    expect(station.communityTotal()).toBeCloseTo(12483.0, 5);

    station.reset();
    expect(station.screen()).toBe('idle');
    expect(station.items()).toEqual([]);
    expect(station.identity()).toBeNull();
  });
});
