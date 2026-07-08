import { Injectable, signal } from '@angular/core';

export interface ScaleReading {
  weight: number;
  stable: boolean;
  unit: string;
}

export type ScaleStatus = 'disconnected' | 'connecting' | 'connected';

const URL_STORAGE_KEY = 'scale-ws-url';
const DEFAULT_URL = 'ws://192.168.83.103:81';
const RECONNECT_DELAY_MS = 2000;
/** No reading for this long while connected → show the reading as gone stale. */
const READING_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ScaleService {
  readonly status = signal<ScaleStatus>('disconnected');
  readonly reading = signal<ScaleReading | null>(null);
  readonly error = signal<string | null>(null);

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readingTimer: ReturnType<typeof setTimeout> | null = null;
  private url = localStorage.getItem(URL_STORAGE_KEY) ?? DEFAULT_URL;

  getUrl(): string {
    return this.url;
  }

  connect(url: string): void {
    this.url = url.trim();
    localStorage.setItem(URL_STORAGE_KEY, this.url);
    this.disconnect();
    this.open();
  }

  disconnect(): void {
    this.clearTimers();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.status.set('disconnected');
    this.reading.set(null);
  }

  private open(): void {
    this.status.set('connecting');
    this.error.set(null);
    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      this.status.set('disconnected');
      this.error.set(err instanceof Error ? err.message : String(err));
      return;
    }

    this.ws.onopen = () => this.status.set('connected');
    this.ws.onmessage = (e) => this.onMessage(e.data);
    this.ws.onclose = () => {
      this.status.set('connecting');
      this.reading.set(null);
      this.scheduleReconnect();
    };
    // onerror always precedes onclose; reconnect is handled there
  }

  private onMessage(data: string): void {
    try {
      this.reading.set(JSON.parse(data) as ScaleReading);
    } catch {
      return; // ignore non-JSON frames
    }
    if (this.readingTimer) clearTimeout(this.readingTimer);
    this.readingTimer = setTimeout(() => this.reading.set(null), READING_TIMEOUT_MS);
  }

  private scheduleReconnect(): void {
    this.clearTimers();
    this.reconnectTimer = setTimeout(() => this.open(), RECONNECT_DELAY_MS);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.readingTimer) clearTimeout(this.readingTimer);
    this.reconnectTimer = null;
    this.readingTimer = null;
  }
}
