import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'grid'
  | 'zap'
  | 'arrow-right'
  | 'arrow-left'
  | 'chevron-right'
  | 'x'
  | 'camera'
  | 'user'
  | 'phone'
  | 'id-card'
  | 'check'
  | 'refresh'
  | 'trash'
  | 'edit'
  | 'plus'
  | 'warning'
  | 'confused'
  | 'face-scan'
  | 'plastic'
  | 'paper'
  | 'metal'
  | 'glass'
  | 'fabric'
  | 'unsorted';

/**
 * Tagom has no icon font. These are Lucide-style stroke glyphs used as a
 * substitution (handoff §9) — swap for hand-drawn marks later. The one real
 * brand motif is the star in public/tagom/star.svg, used as the help mark.
 */
@Component({
  selector: 'tg-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('grid') {
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        }
        @case ('zap') {
          <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
        }
        @case ('arrow-right') {
          <path d="M5 12h14M13 6l6 6-6 6" />
        }
        @case ('arrow-left') {
          <path d="M19 12H5M11 18l-6-6 6-6" />
        }
        @case ('chevron-right') {
          <path d="M9 18l6-6-6-6" />
        }
        @case ('x') {
          <path d="M18 6 6 18M6 6l12 12" />
        }
        @case ('camera') {
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        }
        @case ('user') {
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        }
        @case ('phone') {
          <path
            d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2z"
          />
        }
        @case ('id-card') {
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M9 6h6M9 10h6M9 14h4" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
        @case ('refresh') {
          <path d="M3 7v6h6" />
          <path d="M3.5 13a9 9 0 1 0 2.6-6.4L3 9" />
        }
        @case ('trash') {
          <path
            d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"
          />
        }
        @case ('edit') {
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('warning') {
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        }
        @case ('confused') {
          <path d="M9 9h.01M15 9h.01M8 15c1-1 2.5-1 4-1s3 0 4 1" />
          <circle cx="12" cy="12" r="10" />
        }
        @case ('face-scan') {
          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="11" r="3" />
        }
        @case ('plastic') {
          <path d="M9 2h6M10 2v2.5L8.5 7A4 4 0 0 0 8 9v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9a4 4 0 0 0-.5-2L14 4.5V2" />
          <path d="M8 13h8" />
        }
        @case ('paper') {
          <path d="M7 4h7l4 4v12H7z" />
          <path d="M4 8h3v12h8" />
          <path d="M14 4v4h4" />
        }
        @case ('metal') {
          <ellipse cx="12" cy="5" rx="6" ry="2.4" />
          <path d="M6 5v14a6 2.4 0 0 0 12 0V5" />
          <path d="M6 12a6 2.4 0 0 0 12 0" />
        }
        @case ('glass') {
          <path d="M10 2h4v3l1.5 3A3 3 0 0 1 16 11v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-9a3 3 0 0 1 .5-3L10 5z" />
        }
        @case ('fabric') {
          <path d="M4 7c3-3 5 1 8 0s4-3 8 0v3c-3 2-5-1-8 0s-5 3-8 0z" />
          <path d="M4 13c3-3 5 1 8 0s4-3 8 0v3c-3 2-5-1-8 0s-5 3-8 0z" />
        }
        @case ('unsorted') {
          <path d="M3 6h18M6 6l1.5 13a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8L18 6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
  `,
})
export class TgIcon {
  readonly name = input.required<IconName>();
  readonly size = input(24);
  readonly strokeWidth = input(2);
}
