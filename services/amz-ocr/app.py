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

MAX_BYTES = 15 * 1024 * 1024
OCR_TIMEOUT_SECONDS = 30
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


def _pil_images(raw: bytes, content_type: str) -> list[Image.Image]:
    if content_type == "application/pdf" or raw.startswith(b"%PDF-"):
        document = pdfium.PdfDocument(raw)
        return [
            page.render(scale=2.5).to_pil().convert("RGB")
            for page in document
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


def _ocr_image(image: Image.Image) -> str:
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


def _ocr(raw: bytes, content_type: str) -> str:
    # Tudo fica em memória; nenhum arquivo temporário é criado.
    return "\n\n".join(
        text for text in (_ocr_image(image) for image in _pil_images(raw, content_type))
        if text
    )


@app.post("/ocr")
async def ocr(
    request: Request,
    x_ocr_token: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    if not _authorized(x_ocr_token):
        raise HTTPException(status_code=401, detail="não autorizado")
    content_length = int(request.headers.get("content-length", "0") or "0")
    if content_length > MAX_BYTES:
        raise HTTPException(status_code=413, detail="arquivo excede 15 MB")
    raw = await request.body()
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="arquivo inválido ou excede 15 MB")
    content_type = request.headers.get("content-type", "application/octet-stream")
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
