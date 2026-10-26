import os
import re
import threading
import time
from dataclasses import asdict, dataclass
from typing import Callable

import cv2
import numpy as np
import pytesseract
from PIL import Image

Reader = Callable[[np.ndarray], tuple[str, float]]
Progress = Callable[[str, str, int], None]

_PADDLE = None
_PADDLE_LOCK = threading.Lock()


@dataclass(frozen=True)
class OcrMetrics:
    motor: str
    variante_vencedora: str
    tempo_ms: int
    n_campos_validos: int

    def public(self) -> dict[str, str | int]:
        return asdict(self)


@dataclass(frozen=True)
class OcrResult:
    text: str
    metrics: OcrMetrics


def _renavam_valid(value: str) -> bool:
    if not re.fullmatch(r"\d{11}", value) or len(set(value)) == 1:
        return False
    weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    total = sum(int(value[index]) * weight for index, weight in enumerate(weights))
    remainder = (total * 10) % 11
    digit = 0 if remainder == 10 else remainder
    return digit == int(value[10])


def _after_label(text: str, label: str) -> str:
    match = re.search(
        rf"(?:^|\n)\s*{label}\s*(?::|-)?\s*(?:\n\s*)?([^\n]+)",
        text,
        re.IGNORECASE,
    )
    return match.group(1).strip() if match else ""


def valid_crlv_fields(text: str) -> set[str]:
    normalized = (
        text.upper()
        .replace("\r", "")
        .replace("Í", "I")
        .replace("Ó", "O")
    )
    fields: set[str] = set()
    plate_source = _after_label(normalized, r"PLACA(?:\s+ANTERIOR/UF)?")
    plate = re.search(
        r"\b[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})\b",
        plate_source or normalized,
    )
    if plate:
        fields.add("placa")

    chassis_source = re.sub(
        r"[^A-Z0-9]",
        "",
        _after_label(normalized, r"CHASSI"),
    )
    chassis = chassis_source[:17]
    if re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", chassis):
        fields.add("chassi")

    renavam_source = _after_label(normalized, r"(?:CODIGO\s+)?RENAVAM")
    renavam = re.sub(r"\D", "", renavam_source)[:11]
    if _renavam_valid(renavam):
        fields.add("renavam")
    return fields


def _resize_max(image: np.ndarray, max_side: int) -> np.ndarray:
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= max_side:
        return image
    scale = max_side / longest
    return cv2.resize(
        image,
        (max(1, round(width * scale)), max(1, round(height * scale))),
        interpolation=cv2.INTER_AREA,
    )


def _upscale_small(image: np.ndarray) -> np.ndarray:
    if max(image.shape[:2]) >= 2000:
        return image
    return cv2.resize(
        image,
        None,
        fx=2,
        fy=2,
        interpolation=cv2.INTER_CUBIC,
    )


def _order_quad(points: np.ndarray) -> np.ndarray:
    ordered = np.zeros((4, 2), dtype=np.float32)
    sums = points.sum(axis=1)
    differences = np.diff(points, axis=1).reshape(-1)
    ordered[0] = points[np.argmin(sums)]
    ordered[2] = points[np.argmax(sums)]
    ordered[1] = points[np.argmin(differences)]
    ordered[3] = points[np.argmax(differences)]
    return ordered


def crop_document(image: np.ndarray) -> tuple[np.ndarray, bool]:
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 45, 140)
    edges = cv2.morphologyEx(
        edges,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)),
    )
    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    area_floor = image.shape[0] * image.shape[1] * 0.18
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:8]:
        perimeter = cv2.arcLength(contour, True)
        polygon = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(polygon) != 4 or cv2.contourArea(polygon) < area_floor:
            continue
        quad = _order_quad(polygon.reshape(4, 2).astype(np.float32))
        top_left, top_right, bottom_right, bottom_left = quad
        width = int(
            max(
                np.linalg.norm(bottom_right - bottom_left),
                np.linalg.norm(top_right - top_left),
            )
        )
        height = int(
            max(
                np.linalg.norm(top_right - bottom_right),
                np.linalg.norm(top_left - bottom_left),
            )
        )
        if width < 300 or height < 200:
            continue
        target = np.array(
            [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]],
            dtype=np.float32,
        )
        matrix = cv2.getPerspectiveTransform(quad, target)
        return (
            cv2.warpPerspective(
                image,
                matrix,
                (width, height),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            ),
            True,
        )
    return image, False


def _osd_oriented(image: np.ndarray) -> np.ndarray:
    try:
        osd = pytesseract.image_to_osd(
            image,
            config="--psm 0",
            output_type=pytesseract.Output.DICT,
        )
        angle = int(osd.get("rotate", 0)) % 360
        if angle == 90:
            return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
        if angle == 180:
            return cv2.rotate(image, cv2.ROTATE_180)
        if angle == 270:
            return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    except Exception:
        # Fotos de CRLV antigo são paisagem. Quando o OSD não reúne confiança
        # suficiente (comum em JPEG pequeno), o formato vertical denuncia a
        # rotação de 90° usada no teste e em fotos de celular sem EXIF.
        height, width = image.shape[:2]
        if height > width * 1.15:
            return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image


def preprocessing_variants(image: Image.Image) -> list[tuple[str, np.ndarray]]:
    rgb = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    rgb = cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB)
    rgb = _resize_max(rgb, 1600)
    rgb = _osd_oriented(rgb)
    cropped, perspective = crop_document(rgb)
    # O Paddle recebe no máximo 1600 px. O OSD/corte pode alterar as dimensões,
    # então a trava é aplicada novamente imediatamente antes das variantes.
    base = _resize_max(cropped, 1600)
    prefix = "perspectiva" if perspective else "pagina"

    gray = cv2.cvtColor(base, cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(gray)
    red, green, blue = cv2.split(base)
    neutralized = cv2.subtract(
        cv2.max(red, blue),
        cv2.convertScaleAbs(cv2.subtract(green, cv2.min(red, blue)), alpha=0.35),
    )
    neutralized = cv2.createCLAHE(
        clipLimit=2.6,
        tileGridSize=(8, 8),
    ).apply(neutralized)
    return [
        (f"{prefix}_cor", base),
        (f"{prefix}_clahe", clahe),
        (f"{prefix}_sem_fundo", neutralized),
    ]


def _paddle_engine():
    global _PADDLE
    if _PADDLE is not None:
        return _PADDLE
    with _PADDLE_LOCK:
        if _PADDLE is None:
            from paddleocr import PaddleOCR

            _PADDLE = PaddleOCR(
                device="cpu",
                # O PP-OCRv6 small usa o reconhecedor multilíngue que cobre
                # português e demais idiomas latinos.
                text_detection_model_name="PP-OCRv6_small_det",
                text_recognition_model_name="PP-OCRv6_small_rec",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                # Paddle 3.3.1 falha em alguns CPUs com atributos PIR/oneDNN.
                enable_mkldnn=False,
                cpu_threads=max(1, int(os.environ.get("AMZ_OCR_CPU_THREADS", "4"))),
            )
    return _PADDLE


def preload_paddle() -> None:
    _paddle_engine()


def _paddle_input(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    elif image.ndim == 3 and image.shape[2] == 4:
        image = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    if image.dtype != np.uint8:
        image = np.clip(image, 0, 255).astype(np.uint8)
    return image


def _paddle_reader(image: np.ndarray) -> tuple[str, float]:
    image = _paddle_input(image)
    texts: list[str] = []
    scores: list[float] = []
    for result in _paddle_engine().predict(image):
        recognized = list(result["rec_texts"])
        confidences = [float(value) for value in result["rec_scores"]]
        texts.extend(
            str(text).strip()
            for text, score in zip(recognized, confidences)
            if str(text).strip() and score >= 0.35
        )
        scores.extend(score for score in confidences if score >= 0.35)
    confidence = sum(scores) / len(scores) if scores else 0.0
    return "\n".join(texts), confidence


def _tesseract_reader(image: np.ndarray) -> tuple[str, float]:
    text = pytesseract.image_to_string(
        image,
        lang="por",
        config="--oem 1 --psm 11",
    ).strip()
    return text, 0.0


def _run_variants(
    variants: list[tuple[str, np.ndarray]],
    reader: Reader,
    deadline: float,
    progress: Progress | None = None,
) -> tuple[str, str, int, float]:
    best_text = ""
    best_variant = variants[0][0] if variants else "nenhuma"
    best_fields = -1
    best_confidence = -1.0
    for name, image in variants:
        if time.monotonic() >= deadline:
            break
        try:
            text, confidence = reader(image)
        except Exception:
            continue
        valid = len(valid_crlv_fields(text))
        # O parser decide primeiro. Confiança do motor só desempata; tamanho do
        # texto nunca participa da escolha.
        if (valid, confidence) > (best_fields, best_confidence):
            best_text = text
            best_variant = name
            best_fields = valid
            best_confidence = confidence
            if best_text and progress:
                progress(best_text, best_variant, max(best_fields, 0))
        valid_fields = valid_crlv_fields(text)
        if "placa" in valid_fields and (
            "chassi" in valid_fields or "renavam" in valid_fields
        ):
            break
    return best_text, best_variant, max(best_fields, 0), best_confidence


def recognize_crlv_image(
    image: Image.Image,
    *,
    paddle_reader: Reader | None = None,
    tesseract_reader: Reader | None = None,
    timeout_seconds: float = 18,
    progress_callback: Callable[[OcrResult], None] | None = None,
) -> OcrResult:
    started = time.monotonic()
    deadline = started + timeout_seconds
    variants = preprocessing_variants(image)
    paddle = paddle_reader or _paddle_reader
    fallback = tesseract_reader or _tesseract_reader
    engine = "paddleocr"
    def progress(text: str, variant: str, fields: int) -> None:
        if progress_callback:
            progress_callback(OcrResult(
                text=text,
                metrics=OcrMetrics(
                    motor=engine,
                    variante_vencedora=variant,
                    tempo_ms=round((time.monotonic() - started) * 1000),
                    n_campos_validos=fields,
                ),
            ))

    text, variant, fields, _ = _run_variants(
        variants,
        paddle,
        deadline,
        progress,
    )
    # Tesseract é reserva somente quando o Paddle não devolveu texto algum.
    # Campo não reconhecido ainda é resultado parcial útil para conferência.
    if not text.strip() and time.monotonic() < deadline:
        engine = "tesseract"
        text, variant, fields, _ = _run_variants(
            variants,
            fallback,
            deadline,
            progress,
        )
    return OcrResult(
        text=text,
        metrics=OcrMetrics(
            motor=engine,
            variante_vencedora=variant,
            tempo_ms=round((time.monotonic() - started) * 1000),
            n_campos_validos=fields,
        ),
    )
