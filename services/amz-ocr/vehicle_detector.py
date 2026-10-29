from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# PicoDet-S 320 COCO (PaddleDetection, Apache-2.0)
# https://paddledet.bj.bcebos.com/deploy/third_engine/picodet_s_320_lcnet_postprocessed.onnx
MODEL_PATH = (
    Path(__file__).resolve().parent / "models" /
    "picodet_s_320_lcnet_postprocessed.onnx"
)
INPUT_SIZE = 320
# COCO: car, motorcycle, bus, truck
VEHICLE_CLASS_IDS = frozenset({2, 3, 5, 7})
MIN_VEHICLE_AREA_RATIO = 0.15
CONF_THRESHOLD = 0.4

_session = None


@dataclass(frozen=True)
class VehicleDetection:
    vehicle_detected: bool
    vehicle_area_ratio: float


def _load_session():
    global _session
    if _session is not None:
        return _session
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"modelo ausente: {MODEL_PATH}")
    import onnxruntime as ort

    options = ort.SessionOptions()
    options.log_severity_level = 3
    _session = ort.InferenceSession(
        str(MODEL_PATH),
        options,
        providers=["CPUExecutionProvider"],
    )
    return _session


def _normalize(img: np.ndarray) -> np.ndarray:
    mean = np.array([103.53, 116.28, 123.675], dtype=np.float32).reshape(1, 1, 3)
    std = np.array([57.375, 57.12, 58.395], dtype=np.float32).reshape(1, 1, 3)
    img = img.astype(np.float32)
    return (img / 255.0 - mean / 255.0) / (std / 255.0)


def _resize_image(
    rgb: np.ndarray,
    input_shape: tuple[int, int],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    newh, neww = input_shape
    origin_shape = rgb.shape[:2]
    im_scale_y = newh / float(origin_shape[0])
    im_scale_x = neww / float(origin_shape[1])
    img_shape = np.array([[float(newh), float(neww)]], dtype="float32")
    scale_factor = np.array([[im_scale_y, im_scale_x]], dtype="float32")

    if origin_shape[0] != origin_shape[1]:
        hw_scale = origin_shape[0] / origin_shape[1]
        if hw_scale > 1:
            newh, neww = input_shape[0], int(input_shape[1] / hw_scale)
            img = cv2.resize(rgb, (neww, newh), interpolation=cv2.INTER_AREA)
            left = int((input_shape[1] - neww) * 0.5)
            img = cv2.copyMakeBorder(
                img,
                0,
                0,
                left,
                input_shape[1] - neww - left,
                cv2.BORDER_CONSTANT,
                value=0,
            )
        else:
            newh, neww = int(input_shape[0] * hw_scale), input_shape[1]
            img = cv2.resize(rgb, (neww, newh), interpolation=cv2.INTER_AREA)
            top = int((input_shape[0] - newh) * 0.5)
            img = cv2.copyMakeBorder(
                img,
                top,
                input_shape[0] - newh - top,
                0,
                0,
                cv2.BORDER_CONSTANT,
                value=0,
            )
    else:
        img = cv2.resize(rgb, input_shape, interpolation=cv2.INTER_LINEAR)
    return img, img_shape, scale_factor


def detect_vehicle(
    image: Image.Image,
    min_area_ratio: float = MIN_VEHICLE_AREA_RATIO,
) -> VehicleDetection:
    if os.environ.get("AMZ_OCR_SKIP_VEHICLE_MODEL") == "1":
        return VehicleDetection(False, 0.0)
    try:
        session = _load_session()
    except Exception:
        return VehicleDetection(False, 0.0)

    rgb = np.array(image.convert("RGB"))
    height, width = rgb.shape[:2]
    if width < 2 or height < 2:
        return VehicleDetection(False, 0.0)

    input_shape = (INPUT_SIZE, INPUT_SIZE)
    try:
        inputs = session.get_inputs()
        shape = inputs[0].shape[2:]
        if len(shape) == 2 and shape[0] and shape[1]:
            input_shape = (int(shape[0]), int(shape[1]))
    except Exception:
        pass

    img, im_shape, scale_factor = _resize_image(rgb, input_shape)
    img = _normalize(img)
    blob = np.expand_dims(np.transpose(img, (2, 0, 1)), axis=0).astype(
        np.float32,
    )
    inputs_dict = {
        "im_shape": im_shape,
        "image": blob,
        "scale_factor": scale_factor,
    }
    input_names = [item.name for item in session.get_inputs()]
    feed = {name: inputs_dict[name] for name in input_names if name in inputs_dict}

    try:
        outs = session.run(None, feed)
        boxes = np.array(outs[0])
    except Exception:
        return VehicleDetection(False, 0.0)

    canvas = float(input_shape[0] * input_shape[1])
    best_ratio = 0.0
    for row in boxes:
        if row.shape[0] < 6:
            continue
        class_id = int(row[0])
        confidence = float(row[1])
        if confidence < CONF_THRESHOLD or class_id not in VEHICLE_CLASS_IDS:
            continue
        xmin, ymin, xmax, ymax = row[2:6]
        area = max(0.0, float(xmax - xmin) * float(ymax - ymin))
        best_ratio = max(best_ratio, area / canvas)

    if best_ratio >= min_area_ratio:
        return VehicleDetection(True, round(best_ratio, 4))
    return VehicleDetection(False, round(best_ratio, 4))
