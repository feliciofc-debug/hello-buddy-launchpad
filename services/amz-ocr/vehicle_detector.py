from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

MODEL_PATH = Path(__file__).resolve().parent / "models" / "yolov8n.onnx"
INPUT_SIZE = 640
# COCO: car, motorcycle, bus, truck
VEHICLE_CLASS_IDS = frozenset({2, 3, 5, 7})
MIN_VEHICLE_AREA_RATIO = 0.15

_net: cv2.dnn.Net | None = None


@dataclass(frozen=True)
class VehicleDetection:
    vehicle_detected: bool
    vehicle_area_ratio: float


def _load_net() -> cv2.dnn.Net:
    global _net
    if _net is not None:
        return _net
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"modelo ausente: {MODEL_PATH}")
    _net = cv2.dnn.readNetFromONNX(str(MODEL_PATH))
    _net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
    _net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    return _net


def _yolo_outputs_to_boxes(
    output: np.ndarray,
    conf_threshold: float = 0.25,
) -> list[tuple[int, float]]:
    """YOLOv8 ONNX export: shape (1, 4+nc, n_anchors)."""
    if output.ndim == 3:
        preds = np.squeeze(output, axis=0)
    else:
        preds = output
    if preds.ndim != 2:
        return []
    if preds.shape[0] < preds.shape[1]:
        preds = preds
    else:
        preds = preds.T
    boxes: list[tuple[int, float]] = []
    for row in preds:
        if row.shape[0] < 6:
            continue
        scores = row[4:]
        class_id = int(np.argmax(scores))
        confidence = float(scores[class_id])
        if confidence < conf_threshold or class_id not in VEHICLE_CLASS_IDS:
            continue
        _cx, _cy, w, h = row[:4]
        area_ratio = float(max(0.0, w * h) / float(INPUT_SIZE * INPUT_SIZE))
        if area_ratio <= 0:
            continue
        boxes.append((class_id, area_ratio))
    return boxes


def detect_vehicle(
    image: Image.Image,
    min_area_ratio: float = MIN_VEHICLE_AREA_RATIO,
) -> VehicleDetection:
    if os.environ.get("AMZ_OCR_SKIP_VEHICLE_MODEL") == "1":
        return VehicleDetection(False, 0.0)
    try:
        net = _load_net()
    except Exception:
        return VehicleDetection(False, 0.0)

    rgb = np.array(image.convert("RGB"))
    height, width = rgb.shape[:2]
    if width < 2 or height < 2:
        return VehicleDetection(False, 0.0)

    scale = min(INPUT_SIZE / width, INPUT_SIZE / height)
    new_w = max(1, int(round(width * scale)))
    new_h = max(1, int(round(height * scale)))
    resized = cv2.resize(rgb, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    padded = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, dtype=np.uint8)
    padded[:new_h, :new_w] = resized

    blob = cv2.dnn.blobFromImage(
        padded,
        scalefactor=1 / 255,
        size=(INPUT_SIZE, INPUT_SIZE),
        swapRB=True,
        crop=False,
    )
    net.setInput(blob)
    try:
        outputs = net.forward()
    except Exception:
        return VehicleDetection(False, 0.0)

    best_ratio = 0.0
    for out in outputs if isinstance(outputs, (list, tuple)) else [outputs]:
        for _class_id, ratio in _yolo_outputs_to_boxes(np.asarray(out)):
            best_ratio = max(best_ratio, ratio)

    if best_ratio >= min_area_ratio:
        return VehicleDetection(True, round(best_ratio, 4))
    return VehicleDetection(False, round(best_ratio, 4))
