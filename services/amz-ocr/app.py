import asyncio
import io
import os
from typing import Annotated

import cv2
import numpy as np
import pypdfium2 as pdfium
import pytesseract
from fastapi import FastAPI, Header, HTTPException, Request
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from detector import classify_document

MAX_BYTES = 15 * 1024 * 1024
OCR_TIMEOUT_SECONDS = 30
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


def _score(text: str) -> int:
    return sum(char.isalnum() for char in text)


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


def _ocr_image(image: Image.Image) -> str:
    image = _resize(image, 2400)
    oriented = _osd_rotate(image)
    if oriented is not None:
        return pytesseract.image_to_string(
            _preprocess(oriented),
            lang="por",
            config="--oem 1 --psm 6",
        ).strip()

    candidates: list[str] = []
    for angle in (0, 90, 180, 270):
        rotated = image if angle == 0 else image.rotate(angle, expand=True)
        processed = _preprocess(rotated)
        candidates.append(
            pytesseract.image_to_string(
                processed,
                lang="por",
                config="--oem 1 --psm 6",
            ).strip()
        )
    return max(candidates, key=_score, default="")


def _detect_image(image: Image.Image) -> tuple[bool, str | None]:
    image = _resize(image, 1400)
    oriented = _osd_rotate(image) or image
    text = pytesseract.image_to_string(
        _preprocess(oriented),
        lang="por",
        config="--oem 1 --psm 11",
    )
    return classify_document(text)


def _ocr(raw: bytes, content_type: str) -> str:
    # Tudo fica em memória; nenhum arquivo temporário é criado.
    return "\n\n".join(
        text for text in (_ocr_image(image) for image in _pil_images(raw, content_type))
        if text
    )


def _detect(raw: bytes, content_type: str) -> tuple[bool, str | None]:
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


@app.post("/ocr")
async def ocr(
    request: Request,
    x_ocr_token: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    raw, content_type = await _read_request(request, x_ocr_token)
    try:
        text = await asyncio.wait_for(
            asyncio.to_thread(_ocr, raw, content_type),
            timeout=OCR_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="OCR excedeu 30 segundos") from exc
    except Exception as exc:
        # Não incluir conteúdo, metadados pessoais nem detalhes do decoder.
        raise HTTPException(status_code=422, detail="não foi possível ler o arquivo") from exc
    return {"text": text}


@app.post("/detectar")
async def detectar(
    request: Request,
    x_ocr_token: Annotated[str | None, Header()] = None,
) -> dict[str, bool | str | None]:
    raw, content_type = await _read_request(request, x_ocr_token)
    try:
        documento, tipo = await asyncio.wait_for(
            asyncio.to_thread(_detect, raw, content_type),
            timeout=DETECT_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="detecção excedeu 8 segundos") from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail="não foi possível verificar o arquivo") from exc
    return {"documento": documento, "tipo": tipo}
