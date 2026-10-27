import asyncio
import io
import os
import re
import time
from typing import Annotated

import cv2
import numpy as np
import pypdfium2 as pdfium
import pytesseract
from fastapi import FastAPI, Header, HTTPException, Request
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from detector import classify_document
from ocr_engine import OcrMetrics, OcrResult, preload_paddle, recognize_crlv_image

MAX_BYTES = 15 * 1024 * 1024
OCR_TIMEOUT_SECONDS = 25
OCR_INTERNAL_DEADLINE_SECONDS = 18
DETECT_TIMEOUT_SECONDS = 8
register_heif_opener()

app = FastAPI(
    title="AMZ OCR local",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def _authorized(received: str | None) -> bool:
    expected = os.environ.get("AMZ_OCR_TOKEN", "")
    return bool(expected) and bool(received) and received == expected


def _pil_images(
    raw: bytes,
    content_type: str,
    first_page_only: bool = False,
) -> list[Image.Image]:
    if content_type == "application/pdf" or raw.startswith(b"%PDF-"):
        document = pdfium.PdfDocument(raw)
        pages = range(min(len(document), 1)) if first_page_only else range(len(document))
        return [
            document[index].render(scale=2.5).to_pil().convert("RGB")
            for index in pages
        ]
    return [ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")]


def _deskew(gray: np.ndarray) -> np.ndarray:
    inverted = cv2.bitwise_not(gray)
    points = np.column_stack(np.where(inverted > 0))
    if len(points) < 20:
        return gray
    angle = cv2.minAreaRect(points)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    if abs(angle) < 0.2 or abs(angle) > 15:
        return gray
    height, width = gray.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1.0)
    return cv2.warpAffine(
        gray,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def _resize(image: Image.Image, max_side: int) -> Image.Image:
    longest = max(image.size)
    if longest <= max_side:
        return image
    ratio = max_side / longest
    return image.resize(
        (max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
        Image.Resampling.LANCZOS,
    )


def _preprocess(image: Image.Image) -> np.ndarray:
    rgb = np.array(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray = _deskew(gray)
    return cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        41,
        11,
    )


def _osd_rotate(image: Image.Image) -> Image.Image | None:
    try:
        osd = pytesseract.image_to_osd(
            np.array(image),
            config="--psm 0",
            output_type=pytesseract.Output.DICT,
        )
        angle = int(osd.get("rotate", 0)) % 360
        return image if angle == 0 else image.rotate(-angle, expand=True)
    except Exception:
        return None


def _possible_document_background(image: Image.Image) -> bool:
    sample = np.array(_resize(image.convert("RGB"), 500))
    hsv = cv2.cvtColor(sample, cv2.COLOR_RGB2HSV)
    hue, saturation, value = cv2.split(hsv)
    light_colored = (saturation >= 18) & (value >= 135)
    green_or_blue = ((hue >= 35) & (hue <= 130)) & light_colored
    return float(np.count_nonzero(green_or_blue)) / green_or_blue.size >= 0.35


_REAL_WORD_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]{3,}")
_DOCUMENT_TEXT_HINT_RE = re.compile(
    r"\b(?:PLACA|RENAVAM|CHASSI|PROPRIETARIO|PROPRIETÁRIO|"
    r"CPF|CNPJ|DETRAN|REGISTRO|LICENCIAMENTO|HABILITACAO|HABILITAÇÃO|"
    r"VALIDADE|NASCIMENTO|FILIACAO|FILIAÇÃO|CATEGORIA|COMBUSTIVEL|"
    r"COMBUSTÍVEL|MUNICIPIO|MUNICÍPIO)\b",
    re.IGNORECASE,
)


def _possible_document_text(text: str, image: Image.Image) -> bool:
    real_word_lines: list[list[str]] = []
    for raw_line in text.splitlines():
        words = _REAL_WORD_RE.findall(raw_line)
        if len(words) >= 2:
            real_word_lines.append(words)

    words = [word for line in real_word_lines for word in line]
    letter_count = sum(len(word) for word in words)
    dense_text = (
        len(real_word_lines) >= 12
        and len(words) >= 24
        and letter_count >= 100
    )
    hint_count = len(_DOCUMENT_TEXT_HINT_RE.findall(text))
    old_colored_document = (
        _possible_document_background(image)
        and len(real_word_lines) >= 6
        and len(words) >= 12
        and letter_count >= 55
        and hint_count >= 2
    )
    return dense_text or old_colored_document


def _detect_image(image: Image.Image) -> tuple[bool, str | None, bool]:
    image = _resize(image, 1400)
    oriented = _osd_rotate(image) or image
    text = pytesseract.image_to_string(
        _preprocess(oriented),
        lang="por",
        config="--oem 1 --psm 11",
    )
    documento, tipo = classify_document(text)
    possivel = not documento and _possible_document_text(text, oriented)
    return documento, tipo, possivel


def _ocr(
    raw: bytes,
    content_type: str,
    progress: list[OcrResult] | None = None,
) -> tuple[str, OcrMetrics]:
    # Tudo fica em memória; nenhum arquivo temporário é criado.
    started = time.monotonic()
    texts: list[str] = []
    metrics: list[OcrMetrics] = []
    for image in _pil_images(raw, content_type):
        remaining = max(
            0.1,
            OCR_INTERNAL_DEADLINE_SECONDS - (time.monotonic() - started),
        )
        result = recognize_crlv_image(
            image,
            timeout_seconds=remaining,
            progress_callback=(
                (lambda partial: progress.__setitem__(slice(None), [partial]))
                if progress is not None
                else None
            ),
        )
        if result.text:
            texts.append(result.text)
        metrics.append(result.metrics)
        if time.monotonic() - started >= OCR_INTERNAL_DEADLINE_SECONDS:
            break
    winner = max(metrics, key=lambda value: value.n_campos_validos)
    return "\n\n".join(texts), OcrMetrics(
        motor=winner.motor,
        variante_vencedora=winner.variante_vencedora,
        tempo_ms=round((time.monotonic() - started) * 1000),
        n_campos_validos=winner.n_campos_validos,
    )


def _detect(raw: bytes, content_type: str) -> tuple[bool, str | None, bool]:
    images = _pil_images(raw, content_type, first_page_only=True)
    # A primeira página basta para o portão e mantém o endpoint previsível.
    return _detect_image(images[0])


async def _read_request(
    request: Request,
    x_ocr_token: str | None,
) -> tuple[bytes, str]:
    if not _authorized(x_ocr_token):
        raise HTTPException(status_code=401, detail="não autorizado")
    content_length = int(request.headers.get("content-length", "0") or "0")
    if content_length > MAX_BYTES:
        raise HTTPException(status_code=413, detail="arquivo excede 15 MB")
    raw = await request.body()
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="arquivo inválido ou excede 15 MB")
    return raw, request.headers.get("content-type", "application/octet-stream")


@app.on_event("startup")
async def warm_local_models() -> None:
    try:
        await asyncio.to_thread(preload_paddle)
    except Exception:
        # A reserva Tesseract continua disponível; não revelar detalhes do motor.
        pass


@app.post("/ocr")
async def ocr(
    request: Request,
    x_ocr_token: Annotated[str | None, Header()] = None,
) -> dict[str, str | int | dict[str, str | int]]:
    raw, content_type = await _read_request(request, x_ocr_token)
    partial: list[OcrResult] = []
    try:
        text, metrics = await asyncio.wait_for(
            asyncio.to_thread(_ocr, raw, content_type, partial),
            timeout=OCR_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        if partial and partial[0].text:
            return {
                "text": partial[0].text,
                "metrics": partial[0].metrics.public(),
            }
        raise HTTPException(status_code=504, detail="OCR excedeu 25 segundos") from exc
    except Exception as exc:
        # Não incluir conteúdo, metadados pessoais nem detalhes do decoder.
        raise HTTPException(status_code=422, detail="não foi possível ler o arquivo") from exc
    return {"text": text, "metrics": metrics.public()}


@app.post("/detectar")
async def detectar(
    request: Request,
    x_ocr_token: Annotated[str | None, Header()] = None,
) -> dict[str, bool | str | None]:
    raw, content_type = await _read_request(request, x_ocr_token)
    try:
        documento, tipo, possivel = await asyncio.wait_for(
            asyncio.to_thread(_detect, raw, content_type),
            timeout=DETECT_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="detecção excedeu 8 segundos") from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail="não foi possível verificar o arquivo") from exc
    return {
        "documento": documento,
        "tipo": tipo,
        "possivel_documento": possivel,
    }
