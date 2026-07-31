import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Scrim + centred card shared by every overlay and the error banner. */
@Component({
  selector: 'tg-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" [style.max-width.px]="width()" role="dialog" aria-modal="true">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      position: absolute;
      inset: 0;
      align-items: center;
      justify-content: center;
      z-index: 20;
      background: rgb(11 22 20 / 0.55);
      padding: 24px;
    }
    .card {
      border-radius: var(--radius-xl);
      background: var(--surface-card);
      width: 100%;
      max-height: 100%;
      overflow: auto;
      animation: tg-pop var(--dur-slow) var(--ease-out);
    }
  `,
})
export class TgDialog {
  readonly width = input(560);
}
