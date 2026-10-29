"""Baixa o PicoDet-S ONNX no build da imagem (sem curl)."""
from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

MODEL_URL = (
    "https://paddledet.bj.bcebos.com/deploy/third_engine/"
    "picodet_s_320_lcnet_postprocessed.onnx"
)
MODEL_PATH = Path("/app/models/picodet_s_320_lcnet_postprocessed.onnx")
# SHA-256 do artefato oficial em paddledet.bj.bcebos.com (PicoDet-S 320 COCO).
EXPECTED_SHA256 = (
    "09fc88131be8ad224f13739a5cf8fc838600d76a77539af7f0400fa90506c5f3"
)
MIN_BYTES = 1_000_000


def main() -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    data = MODEL_PATH.read_bytes()
    size = len(data)
    if size <= MIN_BYTES:
        raise SystemExit(f"modelo muito pequeno: {size} bytes")
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit(
            f"sha256 não confere: obtido {digest}, esperado {EXPECTED_SHA256}",
        )
    print(f"modelo ok: {size} bytes sha256={digest}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(1) from exc
