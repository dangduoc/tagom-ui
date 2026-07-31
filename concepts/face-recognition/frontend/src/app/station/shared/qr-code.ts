import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Placeholder QR block, carried over from the prototype (handoff "Assets": QR
 * codes are procedurally-drawn placeholders). It renders a deterministic
 * QR-looking grid from `payload` — it is NOT scannable.
 *
 * To make it real, add a QR encoder (e.g. the `qrcode` package) and replace
 * `cells` with the encoded matrix; the payload input and layout stay as-is.
 */
@Component({
  selector: 'tg-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="qr"
      [style.grid-template-columns]="'repeat(' + size() + ', 1fr)'"
      [style.grid-template-rows]="'repeat(' + size() + ', 1fr)'"
      [style.padding.px]="pad()"
      [style.gap.px]="gap()"
      role="img"
      [attr.aria-label]="payload()"
    >
      @for (on of cells(); track $index) {
        <span [style.background]="on ? color() : 'transparent'"></span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .qr {
      display: grid;
      width: 100%;
      height: 100%;
    }
    .qr span {
      border-radius: 1px;
    }
  `,
})
export class QrCode {
  readonly payload = input('https://tagom.vn/app');
  readonly size = input(9);
  readonly pad = input(14);
  readonly gap = input(3);
  readonly color = input('var(--tagom-green)');

  readonly cells = computed(() => {
    const n = this.size();
    const seed = hash(this.payload());
    const out: boolean[] = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const corner = (r < 3 && c < 3) || (r < 3 && c >= n - 3) || (r >= n - 3 && c < 3);
      out.push(
        corner
          ? r === 0 || r === 2 || c === 0 || c === 2 || r === n - 1 || c === n - 1
          : (i * 7 + seed) % 3 === 0 || (i * i + seed) % 5 === 0,
      );
    }
    return out;
  });
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 97;
}
