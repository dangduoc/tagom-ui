import { Component } from '@angular/core';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  checkmarkCircle,
  closeCircle,
  closeOutline,
  cloudUploadOutline,
  helpCircleOutline,
  personAddOutline,
  refreshOutline,
  trashOutline,
  videocamOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor() {
    addIcons({
      cameraOutline,
      checkmarkCircle,
      closeCircle,
      closeOutline,
      cloudUploadOutline,
      helpCircleOutline,
      personAddOutline,
      refreshOutline,
      trashOutline,
      videocamOutline,
    });
  }
}
