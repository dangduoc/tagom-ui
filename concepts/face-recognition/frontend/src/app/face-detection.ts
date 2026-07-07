import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

/** BlazeFace short-range detector (client-side, WASM/GPU). Shared by the
 *  Live overlay and the Enroll capture guide. Caller owns close(). */
export async function createFaceDetector(): Promise<FaceDetector> {
  const vision = await FilesetResolver.forVisionTasks('/wasm');
  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: '/models/blaze_face_short_range.tflite',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  });
}
