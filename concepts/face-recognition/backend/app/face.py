"""insightface wrapper: image bytes -> normalized 512-d embedding."""

from dataclasses import dataclass

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from . import config


class NoFaceError(Exception):
    pass


class MultipleFacesError(Exception):
    pass


class BadImageError(Exception):
    pass


@dataclass
class ExtractedFace:
    embedding: np.ndarray  # L2-normalized, float32, shape (512,)
    det_score: float
    bbox: list[float]  # [x1, y1, x2, y2] in source image pixels
    num_faces: int


class FaceService:
    def __init__(self) -> None:
        self.app = FaceAnalysis(
            name=config.MODEL_NAME,
            providers=["CPUExecutionProvider"],
        )
        self.app.prepare(ctx_id=-1, det_size=(config.DET_SIZE, config.DET_SIZE))

    @staticmethod
    def _decode(data: bytes) -> np.ndarray:
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise BadImageError("could not decode image")
        return img

    def extract(self, data: bytes, *, require_single: bool = False) -> ExtractedFace:
        """Blocking CPU work — call via a threadpool from async code."""
        img = self._decode(data)
        faces = self.app.get(img)
        offset_x = offset_y = 0.0
        if not faces:
            # SCRFD misses faces that fill most of the frame (typical for tight
            # client crops) — retry with a neutral border around the image.
            h, w = img.shape[:2]
            offset_x, offset_y = w / 2, h / 2
            padded = cv2.copyMakeBorder(
                img,
                int(offset_y),
                int(offset_y),
                int(offset_x),
                int(offset_x),
                cv2.BORDER_CONSTANT,
                value=(114, 114, 114),
            )
            faces = self.app.get(padded)
        if not faces:
            raise NoFaceError("no face detected")
        if require_single and len(faces) > 1:
            raise MultipleFacesError(f"{len(faces)} faces detected, expected exactly 1")

        # Largest face wins when several are present (recognition path)
        def bbox_area(f) -> float:
            x1, y1, x2, y2 = f.bbox
            return max(0.0, x2 - x1) * max(0.0, y2 - y1)

        face = max(faces, key=bbox_area)
        x1, y1, x2, y2 = (float(v) for v in face.bbox)
        return ExtractedFace(
            embedding=face.normed_embedding.astype(np.float32),
            det_score=float(face.det_score),
            bbox=[x1 - offset_x, y1 - offset_y, x2 - offset_x, y2 - offset_y],
            num_faces=len(faces),
        )
