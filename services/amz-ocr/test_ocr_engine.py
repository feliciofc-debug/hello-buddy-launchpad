import io
import os
import time
import unittest

import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    import cv2

    from ocr_engine import recognize_crlv_image, valid_crlv_fields

    OCR_RUNTIME_AVAILABLE = True
except ModuleNotFoundError:
    OCR_RUNTIME_AVAILABLE = False


def synthetic_old_crlv() -> Image.Image:
    width, height = 1280, 820
    image = Image.new("RGB", (width, height), "#bad5b1")
    draw = ImageDraw.Draw(image)
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    font = ImageFont.truetype(font_path, 31)
    small = ImageFont.truetype(font_path, 25)
    bold = ImageFont.truetype(bold_path, 34)

    for offset in range(-height, width, 48):
        draw.line((offset, 0, offset + height, height), fill="#a6c8a0", width=2)
    draw.rounded_rectangle(
        (36, 34, width - 36, height - 34),
        radius=12,
        outline="#315942",
        width=5,
    )
    draw.text(
        (70, 62),
        "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO",
        fill="#11251a",
        font=bold,
    )
    fields = [
        ("PLACA", "ABC1D23", 145),
        ("RENAVAM", "12345678900", 260),
        ("CHASSI", "9BWZZZ377VT004251", 375),
        ("MARCA / MODELO / VERSAO", "MARCA / MODELO / VERSAO TESTE", 490),
    ]
    for label, value, top in fields:
        draw.rectangle((65, top, 1215, top + 93), outline="#52765d", width=3)
        draw.text((85, top + 8), label, fill="#1d3a28", font=small)
        draw.text((440, top + 35), value, fill="#07150c", font=font)

    array = np.array(image)
    noise = np.random.default_rng(42).normal(0, 7, array.shape).astype(np.int16)
    array = np.clip(array.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    low = cv2.resize(array, (704, 451), interpolation=cv2.INTER_AREA)
    rotated = cv2.rotate(low, cv2.ROTATE_90_CLOCKWISE)
    encoded = io.BytesIO()
    Image.fromarray(rotated).save(encoded, format="JPEG", quality=58)
    return Image.open(io.BytesIO(encoded.getvalue())).convert("RGB")


@unittest.skipUnless(
    OCR_RUNTIME_AVAILABLE,
    "dependências OCR são instaladas na imagem Docker",
)
class OcrEngineTest(unittest.TestCase):
    def test_parser_selects_valid_fields_instead_of_longest_text(self) -> None:
        image = synthetic_old_crlv()
        responses = iter(
            [
                ("TEXTO " * 500, 0.99),
                ("PLACA\nABC1D23", 0.75),
                (
                    "PLACA\nABC1D23\nCHASSI\n9BWZZZ377VT004251",
                    0.61,
                ),
            ]
        )

        def reader(_image: np.ndarray) -> tuple[str, float]:
            return next(responses, ("SEM CAMPO VALIDO", 1.0))

        result = recognize_crlv_image(
            image,
            paddle_reader=reader,
            tesseract_reader=reader,
            timeout_seconds=5,
        )
        self.assertEqual(
            valid_crlv_fields(result.text),
            {"placa", "chassi"},
        )
        self.assertEqual(result.metrics.motor, "paddleocr")
        self.assertEqual(result.metrics.n_campos_validos, 2)
        self.assertLess(result.metrics.tempo_ms, 5_000)

    @unittest.skipUnless(
        os.environ.get("AMZ_OCR_REAL_TESTS") == "1",
        "teste real roda na imagem Docker com os modelos locais",
    )
    def test_real_paddle_reads_rotated_noisy_green_crlv(self) -> None:
        started = time.monotonic()
        result = recognize_crlv_image(
            synthetic_old_crlv(),
            timeout_seconds=25,
        )
        fields = valid_crlv_fields(result.text)
        self.assertIn("placa", fields)
        self.assertIn("chassi", fields)
        self.assertLess(time.monotonic() - started, 25)
        print(
            "OCR_SYNTHETIC_METRICS "
            f"engine={result.metrics.motor} "
            f"variant={result.metrics.variante_vencedora} "
            f"elapsed_ms={result.metrics.tempo_ms} "
            f"valid_fields={result.metrics.n_campos_validos}"
        )


if __name__ == "__main__":
    unittest.main()
