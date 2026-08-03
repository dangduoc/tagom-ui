import { Injectable, signal } from '@angular/core';

export interface ScaleReading {
  weight: number;
  stable: boolean;
  unit: string;
}

export type ScaleStatus = 'disconnected' | 'connecting' | 'connected';

const URL_STORAGE_KEY = 'scale-ws-url';
/** The ESP32 takes a DHCP lease, so this drifts -- it was .103 until that lease
 *  moved to another machine. Treat it as a starting guess; the /debug page
 *  overrides it and that value wins. A DHCP reservation on the router is the
 *  real fix. */
const DEFAULT_URL = 'ws://192.168.83.105:81';
/** Same-origin path the dev server forwards to the ESP32 (see proxy.conf.js). */
const PROXY_PATH = '/scale-ws';

const pageIsHttps = () => location.protocol === 'https:';

/** An HTTPS page hard-blocks `ws://`, so `npm run start:lan` has to reach the
 *  scale through the dev server's own origin. On `http://localhost` -- which is
 *  what production uses -- go straight to the ESP32. */
function defaultUrl(): string {
  return pageIsHttps() ? `wss://${location.host}${PROXY_PATH}` : DEFAULT_URL;
}

/** The stored address, or null if there isn't a real override.
 *
 *  Migration: earlier builds persisted the computed default on every boot,
 *  which froze it -- the stored copy then outranked `defaultUrl()` forever, so
 *  changing DEFAULT_URL in code could never reach a station that had launched
 *  even once. Storage that merely echoes the default was never a choice, so
 *  drop it. This only catches values matching *today's* default; one frozen
 *  under an older DEFAULT_URL still has to be cleared from this page. */
function storedOverride(): string | null {
  const stored = localStorage.getItem(URL_STORAGE_KEY);
  if (stored === null) return null;
  if (stored === defaultUrl()) {
    localStorage.removeItem(URL_STORAGE_KEY);
    return null;
  }
  return stored;
}
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
  private url = storedOverride() ?? defaultUrl();

  getUrl(): string {
    return this.url;
  }

  /** Connects using the configured address. Deliberately does not persist: an
   *  address nobody chose must not outrank a future default. */
  connect(): void {
    this.disconnect();
    this.open();
  }

  /** Records an address the operator picked, and reconnects. Blank -- or a value
   *  equal to the default -- clears the override so the address goes back to
   *  following the origin. */
  setUrl(url: string): void {
    const next = url.trim();
    if (next && next !== defaultUrl()) {
      localStorage.setItem(URL_STORAGE_KEY, next);
      this.url = next;
    } else {
      localStorage.removeItem(URL_STORAGE_KEY);
      this.url = defaultUrl();
    }
    this.connect();
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

    // Retrying this is pointless -- the browser blocks it before a packet is
    // sent -- and the 2s reconnect just floods the console. Fail once, loudly.
    if (pageIsHttps() && this.url.startsWith('ws://')) {
      this.status.set('disconnected');
      this.error.set(
        `An HTTPS page cannot open ${this.url}. Use ${defaultUrl()} to go through ` +
          `the dev-server proxy, or open the app on http://localhost.`,
      );
      return;
    }

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
