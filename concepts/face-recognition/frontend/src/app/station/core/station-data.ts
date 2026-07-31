import { Injectable, inject, signal } from '@angular/core';

import { ApiService, PersonDto } from '../../api.service';
import { CategoryKey, Person, WeighSession } from './models';

/**
 * Depositor records, weigh history and the station total, served by the
 * backend (`/api/people`, `/api/sessions`, `/api/stats`).
 *
 * The only thing still kept locally is an outbox of sessions that failed to
 * upload, so a weigh is never lost when the network drops — which is what the
 * offline error card promises ("data saves when back online", handoff §6).
 */

const KEY_OUTBOX = 'tagom.station.outbox';

interface PendingSession {
  code: string | null;
  items: { category: CategoryKey; weight: number }[];
}

/** ISO / SQL timestamp from the API → the dd/MM/yyyy the history list shows. */
export function formatDate(value: string): string {
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
}

/** Member-since is shown as MM/yyyy. */
export function formatMonth(value: string): string {
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
}

export function toPerson(dto: PersonDto): Person {
  return {
    code: dto.code,
    fullName: dto.full_name,
    phone: dto.phone ?? '',
    age: dto.age ?? undefined,
    city: dto.city ?? undefined,
    ward: dto.ward ?? undefined,
    address: dto.address ?? undefined,
    citizenId: dto.citizen_id ?? undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class StationDataStore {
  private readonly api = inject(ApiService);

  /** Everything this station has gathered, including its pre-existing baseline. */
  readonly communityTotal = signal(0);
  readonly communityGoal = signal(15000);
  /** Signed-in person's lifetime total and history; reset when they leave. */
  readonly personalTotal = signal(0);
  readonly sessions = signal<WeighSession[]>([]);
  readonly memberSince = signal('');
  /** True while a recorded session is sitting in the outbox awaiting upload. */
  readonly pendingUpload = signal(false);

  constructor() {
    this.pendingUpload.set(this.outbox().length > 0);
    addEventListener('online', () => void this.flushOutbox());
  }

  async loadStats(): Promise<void> {
    try {
      const stats = await this.api.getStats();
      this.communityTotal.set(stats.community_total);
      this.communityGoal.set(stats.community_goal);
    } catch {
      // Offline: keep whatever total we last saw rather than showing zero.
    }
  }

  /** Loads profile + history for a code. Returns null if nobody holds it. */
  async loadPerson(code: string): Promise<Person | null> {
    try {
      const bundle = await this.api.getPerson(code);
      if (!bundle) return null;
      this.personalTotal.set(bundle.personal_total);
      this.memberSince.set(formatMonth(bundle.person.member_since));
      this.sessions.set(
        bundle.sessions.map((s) => ({
          date: formatDate(s.date),
          items: s.items.map((i) => ({ key: i.category as CategoryKey, weight: i.weight })),
        })),
      );
      return toPerson(bundle.person);
    } catch {
      return null;
    }
  }

  clearPerson(): void {
    this.personalTotal.set(0);
    this.sessions.set([]);
    this.memberSince.set('');
  }

  /**
   * Records a finished visit. Totals move immediately so the summary is right
   * the moment it opens; the server's numbers replace them when they land, and
   * a failed upload is queued rather than dropped.
   */
  async recordSession(
    code: string | null,
    items: { key: CategoryKey; weight: number }[],
  ): Promise<void> {
    const total = items.reduce((sum, i) => sum + i.weight, 0);
    this.communityTotal.update((v) => round2(v + total));
    if (code) this.personalTotal.update((v) => round2(v + total));

    const payload: PendingSession = {
      code,
      items: items.map((i) => ({ category: i.key, weight: i.weight })),
    };

    try {
      const res = await this.api.recordSession(payload.code, payload.items);
      this.communityTotal.set(res.community_total);
      if (code) await this.loadPerson(code);
    } catch {
      this.queue(payload);
    }
  }

  /** Retries queued sessions. Safe to call repeatedly. */
  async flushOutbox(): Promise<void> {
    const queued = this.outbox();
    if (!queued.length) return;

    const stillPending: PendingSession[] = [];
    for (const session of queued) {
      try {
        await this.api.recordSession(session.code, session.items);
      } catch {
        stillPending.push(session);
      }
    }
    this.writeOutbox(stillPending);
    if (stillPending.length < queued.length) await this.loadStats();
  }

  private queue(session: PendingSession): void {
    this.writeOutbox([...this.outbox(), session]);
  }

  private outbox(): PendingSession[] {
    try {
      return JSON.parse(localStorage.getItem(KEY_OUTBOX) ?? '[]') as PendingSession[];
    } catch {
      return [];
    }
  }

  private writeOutbox(sessions: PendingSession[]): void {
    try {
      if (sessions.length) localStorage.setItem(KEY_OUTBOX, JSON.stringify(sessions));
      else localStorage.removeItem(KEY_OUTBOX);
    } catch {
      // Private mode / quota — nothing more we can do than keep going.
    }
    this.pendingUpload.set(sessions.length > 0);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
