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

@Component({
  selector: 'app-root',
  imports: [IonApp, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
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
