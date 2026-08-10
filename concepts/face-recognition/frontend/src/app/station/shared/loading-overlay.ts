import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Covers the whole screen while something is in flight, so nothing underneath
 * can be tapped a second time and the person can see the station is working.
 *
 * It fades in after a short delay on purpose. A lookup against a backend on the
 * same machine usually answers in tens of milliseconds, and an overlay that
 * appears and vanishes inside one frame reads as a glitch — so a fast answer
 * shows nothing at all, and only a slow one is worth announcing.
 */
@Component({
  selector: 'tg-loading-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="spinner" aria-hidden="true"></div>
    <p class="label tg-display">{{ label() }}</p>
  `,
  host: {
    role: 'status',
    'aria-live': 'polite',
  },
  styles: `
    :host {
      display: flex;
      position: fixed;
      z-index: 40;
      opacity: 0;
      inset: 0;
      flex-direction: column;
      gap: 28px;
      align-items: center;
      justify-content: center;
      animation: tg-veil var(--dur-slow) 180ms var(--ease-out) forwards;
      background: var(--surface-page);
      color: var(--tagom-green);
    }

    @keyframes tg-veil {
      to {
        opacity: 1;
      }
    }

    .spinner {
      border: 7px solid color-mix(in srgb, var(--accent) 22%, transparent);
      border-top-color: var(--accent);
      border-radius: var(--radius-circle);
      width: 84px;
      height: 84px;
      animation: tg-spin 900ms linear infinite;
    }

    @keyframes tg-spin {
      to {
        transform: rotate(1turn);
      }
    }

    .label {
      margin: 0;
      font-size: var(--text-h2);
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        opacity: 1;
        animation: none;
      }

      .spinner {
        animation: tg-blink 1.2s ease-in-out infinite;
      }
    }
  `,
})
export class LoadingOverlay {
  readonly label = input.required<string>();
}
