from __future__ import annotations

import io
import os
import time
import unittest
import unittest.mock

try:
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont

    from ocr_engine import (
        _paddle_input,
        _paddle_reader,
        _run_variants,
        preprocessing_variants,
        recognize_crlv_image,
        valid_crlv_fields,
    )

    OCR_RUNTIME_AVAILABLE = True
except ModuleNotFoundError:
    OCR_RUNTIME_AVAILABLE = False


def synthetic_old_crlv(
    rotation: int = 90,
    jpeg_quality: int = 58,
) -> Image.Image:
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
    rotations = {
        0: low,
        90: cv2.rotate(low, cv2.ROTATE_90_CLOCKWISE),
        180: cv2.rotate(low, cv2.ROTATE_180),
        270: cv2.rotate(low, cv2.ROTATE_90_COUNTERCLOCKWISE),
    }
    rotated = rotations[rotation]
    encoded = io.BytesIO()
    Image.fromarray(rotated).save(
        encoded,
        format="JPEG",
        quality=jpeg_quality,
    )
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

    def test_run_variants_continues_after_single_variant_failure(self) -> None:
        image = synthetic_old_crlv()
        variants = preprocessing_variants(image)
        calls: list[str] = []

        def reader(arr: np.ndarray) -> tuple[str, float]:
            name = variants[len(calls)][0] if len(calls) < len(variants) else "x"
            calls.append(name)
            if len(calls) == 1:
                raise ValueError("simulated paddle failure on gray variant")
            return ("PLACA\nABC1D23\nCHASSI\n9BWZZZ377VT004251", 0.8)

        text, variant, fields, _ = _run_variants(
            variants,
            reader,
            time.monotonic() + 5,
        )
        self.assertGreater(len(calls), 1)
        self.assertIn("placa", valid_crlv_fields(text))
        self.assertIn("chassi", valid_crlv_fields(text))
        self.assertGreaterEqual(fields, 2)

    def test_paddle_reader_accepts_gray_2d_array(self) -> None:
        gray = np.zeros((120, 200), dtype=np.uint8)
        bgr = _paddle_input(gray)
        self.assertEqual(bgr.ndim, 3)
        self.assertEqual(bgr.shape[2], 3)

        captured: list[tuple] = []

        class FakeOcr:
            def predict(self, image: np.ndarray):
                captured.append(image.shape)
                return [{"rec_texts": ["ABC1D23"], "rec_scores": [0.9]}]

        import ocr_engine as engine_mod

        with unittest.mock.patch.object(
            engine_mod,
            "_paddle_engine",
            return_value=FakeOcr(),
        ):
            text, confidence = engine_mod._paddle_reader(gray)
        self.assertEqual(captured[0], bgr.shape)
        self.assertIn("ABC1D23", text)
        self.assertGreater(confidence, 0)

    @unittest.skipUnless(
        os.environ.get("AMZ_OCR_REAL_TESTS") == "1",
        "teste real roda na imagem Docker com os modelos locais",
    )
    def test_real_paddle_reads_rotated_noisy_green_crlv(self) -> None:
        measurements: list[int] = []
        engines: set[str] = set()
        variants: set[str] = set()
        for rotation, quality in ((90, 58), (0, 52), (270, 64)):
            with self.subTest(rotation=rotation, quality=quality):
                started = time.monotonic()
                result = recognize_crlv_image(
                    synthetic_old_crlv(rotation, quality),
                    timeout_seconds=25,
                )
                fields = valid_crlv_fields(result.text)
                self.assertIn("placa", fields)
                self.assertIn("chassi", fields)
                self.assertEqual(
                    result.metrics.motor,
                    "paddleocr",
                    "variantes em cinza não podem derrubar o Paddle inteiro",
                )
                self.assertLess(time.monotonic() - started, 25)
                measurements.append(result.metrics.tempo_ms)
                engines.add(result.metrics.motor)
                variants.add(result.metrics.variante_vencedora)
        average_ms = round(sum(measurements) / len(measurements))
        print(
            "OCR_SYNTHETIC_METRICS "
            f"runs={len(measurements)} "
            f"engines={','.join(sorted(engines))} "
            f"variants={','.join(sorted(variants))} "
            f"average_ms={average_ms} "
            f"samples_ms={','.join(str(value) for value in measurements)}"
        )


if __name__ == "__main__":
    unittest.main()
