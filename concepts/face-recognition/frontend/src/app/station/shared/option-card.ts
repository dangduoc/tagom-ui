import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconName, TgIcon } from './tg-icon';

/**
 * The wide tap target shared by all three entry screens: icon on the left, one
 * or two lines of text, arrow on the right. One component so the chooser's three
 * cards and the Face ID / phone screens' fallback pairs can never drift apart.
 *
 * Attached to a real <button> so it keeps native keyboard and focus behaviour:
 *   <button tg-option-card [icon]="'phone'" [label]="..." (click)="...">
 *
 * `overline` is the question above the action ("Không thể nhận diện khuôn mặt?")
 * and `sub` the explanation below it — the chooser uses `sub`, the fallback
 * pairs use `overline`. Both are optional.
 */
@Component({
  selector: 'button[tg-option-card]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TgIcon],
  template: `
    <span class="glyph">
      <tg-icon [name]="icon()" [size]="iconSize()" [strokeWidth]="1.8" />
    </span>
    <span class="text">
      @if (overline()) {
        <span class="over">{{ overline() }}</span>
      }
      <span class="title tg-display">{{ label() }}</span>
      @if (sub()) {
        <span class="sub">{{ sub() }}</span>
      }
    </span>
    <tg-icon name="arrow-right" [size]="26" [strokeWidth]="2.2" />
  `,
  host: {
    type: 'button',
    '[class.filled]': "variant() === 'filled'",
    '[class.outline]': "variant() === 'outline'",
  },
  styles: `
    :host {
      display: flex;
      gap: 20px;
      align-items: center;
      /* The design's 10px — md is the nearest token and indistinguishable. */
      border-radius: var(--radius-md);
      padding: 22px 26px;
      width: 100%;
      text-align: left;
    }

    :host(.filled) {
      background: var(--accent);
      color: var(--on-accent);
    }

    :host(.outline) {
      border: 1.5px solid var(--border-strong);
      background: var(--surface-card);
      color: var(--tagom-green);
    }

    .glyph {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 56px;
    }

    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .over {
      opacity: 0.9;
      line-height: 1.3;
      font-size: var(--text-lg);
    }

    .title {
      line-height: 1.15;
      font-size: 32px;
    }

    .sub {
      opacity: 0.9;
      line-height: 1.3;
      font-size: var(--text-lg);
    }

    @media (max-width: 600px) {
      :host {
        gap: 14px;
        padding: 16px 18px;
      }

      .glyph {
        width: 40px;
      }

      .title {
        font-size: 21px;
      }
    }
  `,
})
export class OptionCard {
  readonly icon = input.required<IconName>();
  /** Named `label`, not `title`: on a <button> host, `title` would shadow the
   *  native tooltip attribute. */
  readonly label = input.required<string>();
  readonly overline = input<string>('');
  readonly sub = input<string>('');
  readonly variant = input<'filled' | 'outline'>('filled');
  readonly iconSize = input(46);
}
