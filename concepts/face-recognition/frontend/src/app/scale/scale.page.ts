import { Component, OnDestroy, inject, signal } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { ScaleService } from './scale.service';

@Component({
  selector: 'app-scale',
  imports: [IonButton, IonContent, IonHeader, IonInput, IonItem, IonNote, IonTitle, IonToolbar],
  templateUrl: './scale.page.html',
  styleUrl: './scale.page.scss',
})
export class ScalePage implements OnDestroy {
  readonly scale = inject(ScaleService);

  readonly url = signal(this.scale.getUrl());

  toggle(): void {
    if (this.scale.status() === 'disconnected') {
      this.scale.connect(this.url());
    } else {
      this.scale.disconnect();
    }
  }

  ngOnDestroy(): void {
    this.scale.disconnect();
  }
}
