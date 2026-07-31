import { Injectable } from '@angular/core';

import { CategoryKey, Person, WeighSession } from './models';

/**
 * Depositor records and weigh history.
 *
 * The backend currently only stores what face recognition needs (employee_code,
 * full_name, department + embeddings — see backend/app/stores). It has no table
 * for a depositor's phone/age/address, no weigh sessions and no station total,
 * so those live in localStorage for now.
 *
 * This is the single seam to replace when that schema lands: swap the bodies for
 * API calls and nothing else in the station has to change.
 */

/** kg the station had gathered before this device started counting. */
export const COMMUNITY_BASE = 12480.5;
/** Community bar on the summary fills against this target. */
export const COMMUNITY_GOAL = 15000;

const KEY_PEOPLE = 'tagom.station.people';
const KEY_SESSIONS = 'tagom.station.sessions';

interface StoredPerson extends Person {
  code: string;
  memberSince: string; // MM/yyyy
}

interface StoredSession extends WeighSession {
  code: string; // owning person, or '' for anonymous
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota — the session still works, it just won't persist.
  }
}

export function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatMonth(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

@Injectable({ providedIn: 'root' })
export class StationDataStore {
  getPerson(code: string): StoredPerson | null {
    return readJson<StoredPerson[]>(KEY_PEOPLE, []).find((p) => p.code === code) ?? null;
  }

  /** Insert or update by `code` (the depositor's phone digits). */
  savePerson(person: Person & { code: string }): StoredPerson {
    const people = readJson<StoredPerson[]>(KEY_PEOPLE, []);
    const existing = people.find((p) => p.code === person.code);
    const stored: StoredPerson = {
      ...existing,
      ...person,
      memberSince: existing?.memberSince ?? formatMonth(new Date()),
    };
    const next = people.filter((p) => p.code !== person.code).concat(stored);
    writeJson(KEY_PEOPLE, next);
    return stored;
  }

  memberSince(code: string): string {
    return this.getPerson(code)?.memberSince ?? formatMonth(new Date());
  }

  /** Newest first. */
  sessions(code: string): WeighSession[] {
    if (!code) return [];
    return readJson<StoredSession[]>(KEY_SESSIONS, [])
      .filter((s) => s.code === code)
      .reverse();
  }

  /** Records a finished session. Anonymous sessions still count towards the
   *  station total — they're just not attributed to anyone. */
  addSession(code: string, items: { key: CategoryKey; weight: number }[]): void {
    if (!items.length) return;
    const sessions = readJson<StoredSession[]>(KEY_SESSIONS, []);
    sessions.push({ code, date: formatDate(new Date()), items });
    writeJson(KEY_SESSIONS, sessions);
  }

  personalTotal(code: string): number {
    return this.sessions(code).reduce((sum, s) => sum + sessionSum(s), 0);
  }

  communityTotal(): number {
    const recorded = readJson<StoredSession[]>(KEY_SESSIONS, []).reduce(
      (sum, s) => sum + sessionSum(s),
      0,
    );
    return COMMUNITY_BASE + recorded;
  }
}

export function sessionSum(session: WeighSession): number {
  return session.items.reduce((sum, i) => sum + i.weight, 0);
}
