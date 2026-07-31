import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonApp, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  cameraReverseOutline,
  checkmarkCircle,
  closeCircle,
  closeOutline,
  cloudUploadOutline,
  helpCircleOutline,
  personAddOutline,
  refreshOutline,
  scaleOutline,
  trashOutline,
  videocamOutline,
} from 'ionicons/icons';

/**
 * The original hardware test pages (live recognition, enrollment, scale
 * connection) kept reachable at /debug for setting up a station — notably the
 * scale's WebSocket URL. Not part of the depositor-facing flow.
 */
@Component({
  selector: 'app-debug-shell',
  imports: [IonApp, IonIcon, IonLabel, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <ion-app>
      <nav class="tabs">
        <a routerLink="/debug/live" routerLinkActive="on">
          <ion-icon name="videocam-outline" /><ion-label>Trực tiếp</ion-label>
        </a>
        <a routerLink="/debug/enroll" routerLinkActive="on">
          <ion-icon name="person-add-outline" /><ion-label>Đăng ký</ion-label>
        </a>
        <a routerLink="/debug/scale" routerLinkActive="on">
          <ion-icon name="scale-outline" /><ion-label>Cân</ion-label>
        </a>
        <a routerLink="/" class="exit"><ion-label>← Trạm</ion-label></a>
      </nav>
      <div class="body"><router-outlet /></div>
    </ion-app>
  `,
  styles: `
    :host {
      display: block;
      position: fixed;
      inset: 0;
    }
    .body {
      position: absolute;
      inset: 0 0 60px;
    }
    .tabs {
      display: flex;
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 10;
      border-top: 1px solid rgb(255 255 255 / 0.12);
      background: #1b1b1b;
      height: 60px;
    }
    .tabs a {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      align-items: center;
      justify-content: center;
      color: #9a9a9a;
      font-size: 12px;
      text-decoration: none;
    }
    .tabs a.on {
      color: #6ee7b7;
    }
    .tabs ion-icon {
      font-size: 22px;
    }
  `,
})
export class DebugShell {
  constructor() {
    addIcons({
      cameraOutline,
      cameraReverseOutline,
      checkmarkCircle,
      closeCircle,
      closeOutline,
      cloudUploadOutline,
      helpCircleOutline,
      personAddOutline,
      refreshOutline,
      scaleOutline,
      trashOutline,
      videocamOutline,
    });
  }
}
