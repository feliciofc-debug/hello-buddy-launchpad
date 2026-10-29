from __future__ import annotations

import unittest
import unittest.mock

from detector import classify_document, possible_document_text

try:
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

    import app as detector_app
    from vehicle_detector import VehicleDetection

    DETECTOR_RUNTIME_AVAILABLE = True
except ModuleNotFoundError:
    DETECTOR_RUNTIME_AVAILABLE = False


class DetectorTest(unittest.TestCase):
    def test_positive_identity_and_vehicle_documents(self) -> None:
        cases = {
            "crlv": "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO",
            "crlv_e": "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO DIGITAL",
            "cnh": "CARTEIRA NACIONAL DE HABILITAÇÃO",
            "rg": "CARTEIRA DE IDENTIDADE REGISTRO GERAL",
            "atpv_e": "AUTORIZAÇÃO PARA TRANSFERÊNCIA DE PROPRIEDADE DO VEÍCULO ATPV-E",
        }
        expected = {
            "crlv": "crlv",
            "crlv_e": "crlv",
            "cnh": "cnh",
            "rg": "rg",
            "atpv_e": "outro",
        }
        for name, text in cases.items():
            with self.subTest(name=name):
                self.assertEqual(classify_document(text), (True, expected[name]))

    def test_negative_everyday_business_media(self) -> None:
        cases = {
            "orcamento_funilaria": (
                "ORÇAMENTO FUNILARIA DO ZÉ CNPJ 04.252.011/0001-10 "
                "TELEFONE 11 98765-4321 TOTAL R$ 3.800,00"
            ),
            "nfe_danfe": "DANFE DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA NF-e",
            "boleto": "BANCO BOLETO PAGÁVEL VALOR R$ 850,00 LINHA DIGITÁVEL",
            "folheto": "PROMOÇÃO CNPJ 04.252.011/0001-10 WHATSAPP 11 98765-4321",
            "identidade_visual": "Crie uma identidade visual da marca em azul e branco",
            "foto_carro": "SUV PRATA EM ESTÚDIO PLACA ABC1D23",
            "print_anuncio": "ANÚNCIO COROLLA 2023 R$ 120.000 CHAME 11 98765-4321",
        }
        for name, text in cases.items():
            with self.subTest(name=name):
                self.assertEqual(classify_document(text), (False, None))

    def test_strong_official_combination_requires_valid_pattern(self) -> None:
        prefix = "REPÚBLICA FEDERATIVA DO BRASIL DETRAN"
        self.assertEqual(
            classify_document(f"{prefix} CPF 529.982.247-25"),
            (True, "outro"),
        )
        self.assertEqual(
            classify_document(f"{prefix} CPF 111.111.111-11"),
            (False, None),
        )

    def test_possible_document_requires_dense_real_text(self) -> None:
        car_scene = "\n".join(
            ["||| 123", "---- 456", "12 34"] * 15
            + [
                "GOL BRANCO",
                "GRADE FERRO",
                "ARVORES FUNDO",
                "PATIO LOJA",
                "FOTO VEICULO",
                "CEU AZUL",
            ]
        )
        old_crlv = "\n".join(
            [
                "REGISTRO NACIONAL",
                "PLACA VEICULO",
                "RENAVAM NUMERO",
                "MARCA MODELO",
                "ANO FABRICACAO",
                "COR PREDOMINANTE",
                "COMBUSTIVEL CATEGORIA",
                "PROPRIETARIO NOME",
            ]
        )
        dense_document = "\n".join(
            f"campo sintetico linha {index:02d}" for index in range(25)
        )
        self.assertFalse(possible_document_text(car_scene, True))
        self.assertTrue(possible_document_text(old_crlv, True))
        self.assertTrue(possible_document_text(dense_document, False))

    def test_old_layout_rule_rejects_noisy_car_photo_ocr(self) -> None:
        noise_lines = [
            "||| ||| 123 456",
            "---- ----",
            "12 34 56 78",
        ] * 17
        noise_lines.extend(
            [
                "GOL BRANCO",
                "GRADE FERRO",
                "ARVORES FUNDO",
                "PATIO LOJA",
                "FOTO VEICULO",
                "CEU AZUL",
            ]
        )
        car_ocr = "\n".join(noise_lines)
        self.assertGreaterEqual(sum(1 for line in car_ocr.splitlines() if line.strip()), 52)
        self.assertFalse(possible_document_text(car_ocr, True))

    def test_old_layout_rule_accepts_dense_legacy_crlv_ocr(self) -> None:
        words = [
            "REPUBLICA",
            "FEDERATIVA",
            "BRASIL",
            "DETRAN",
            "CERTIFICADO",
            "REGISTRO",
            "LICENCIAMENTO",
            "VEICULO",
            "RENAVAM",
            "PLACA",
            "CHASSI",
            "MARCA",
            "MODELO",
            "FABRICACAO",
            "COMBUSTIVEL",
            "CATEGORIA",
            "PROPRIETARIO",
            "MUNICIPIO",
            "EXERCICIO",
            "ANTERIOR",
            "POTENCIA",
            "CILINDRADA",
            "COR",
            "PREDOMINANTE",
            "DOCUMENTO",
            "IDENTIDADE",
            "TRANSITO",
        ]
        lines = []
        for index in range(95):
            word = words[index % len(words)]
            lines.append(f"{word} {index:03d} ***")
        crlv_ocr = "\n".join(lines)
        self.assertTrue(possible_document_text(crlv_ocr, True))

    def test_strong_term_alone_still_marks_possible_document(self) -> None:
        self.assertTrue(possible_document_text("DETRAN", False))

    def test_any_strong_fuzzy_keyword_or_identifier_is_possible(self) -> None:
        for text in (
            "DETRAM",
            "RENAVAN",
            "CHASS1",
            "CERTIFICADO DE REGISTRO",
            "REPUBLICA FEDERATIVA",
            "CPF",
            "529.982.247-25",
            "9BWZZZ377VT004251",
        ):
            with self.subTest(text=text):
                self.assertTrue(possible_document_text(text, False))

    def test_short_strong_terms_require_exact_match(self) -> None:
        self.assertTrue(possible_document_text("CPF", False))
        self.assertFalse(possible_document_text("CPG", False))
        self.assertFalse(possible_document_text("CF", False))


@unittest.skipUnless(
    DETECTOR_RUNTIME_AVAILABLE,
    "dependências do detector são instaladas na imagem Docker",
)
class PossibleDocumentTest(unittest.TestCase):
    def detect_with_text(
        self,
        image: Image.Image,
        text: str,
    ) -> tuple[bool, str | None, bool, object]:
        with (
            unittest.mock.patch.object(
                detector_app,
                "_osd_rotate",
                return_value=image,
            ),
            unittest.mock.patch.object(
                detector_app.pytesseract,
                "image_to_string",
                return_value=text,
            ),
            unittest.mock.patch.object(
                detector_app,
                "detect_vehicle",
                return_value=VehicleDetection(False, 0.0),
            ),
        ):
            return detector_app._detect_image(image)

    def test_outdoor_car_with_blue_sky_and_trees_is_not_possible_document(
        self,
    ) -> None:
        image = Image.new("RGB", (900, 600), "#86c8e5")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 330, 900, 600), fill="#79b970")
        for x in range(40, 900, 130):
            draw.rectangle((x + 35, 190, x + 50, 390), fill="#725438")
            draw.ellipse((x, 120, x + 100, 280), fill="#3f8f4b")
        draw.rounded_rectangle((210, 350, 700, 510), radius=45, fill="#f5f5f5")
        draw.ellipse((280, 470, 380, 570), fill="#242424")
        draw.ellipse((550, 470, 650, 570), fill="#242424")
        self.assertTrue(detector_app._possible_document_background(image))
        documento, tipo, possivel, _vehicle = self.detect_with_text(image, "")
        self.assertEqual((documento, tipo, possivel), (False, None, False))

    def test_first_pass_timeout_fails_closed(self) -> None:
        image = Image.new("RGB", (900, 600), "white")
        with (
            unittest.mock.patch.object(
                detector_app,
                "_osd_rotate",
                return_value=image,
            ),
            unittest.mock.patch.object(
                detector_app.pytesseract,
                "image_to_string",
                side_effect=RuntimeError("Tesseract process timeout"),
            ),
            unittest.mock.patch.object(
                detector_app,
                "detect_vehicle",
                return_value=VehicleDetection(False, 0.0),
            ),
        ):
            self.assertEqual(
                detector_app._detect_image(image),
                (False, None, True, VehicleDetection(False, 0.0)),
            )

    def test_cars_under_blue_sky_and_in_dealership_yard_are_not_documents(
        self,
    ) -> None:
        fixtures = [
            ("ceu_azul", "#7dc8ee", "#b9b9b9"),
            ("patio_loja", "#d8d8d8", "#777777"),
        ]
        for name, sky, ground in fixtures:
            with self.subTest(name=name):
                image = Image.new("RGB", (900, 600), sky)
                draw = ImageDraw.Draw(image)
                draw.rectangle((0, 310, 900, 600), fill=ground)
                for x in (90, 340, 590):
                    draw.rounded_rectangle(
                        (x, 350, x + 220, 470),
                        radius=28,
                        fill="#f4f4f4",
                    )
                documento, tipo, possivel, _vehicle = self.detect_with_text(
                    image,
                    "",
                )
                self.assertEqual((documento, tipo, possivel), (False, None, False))

    def test_green_ad_with_three_lines_is_not_possible_document(self) -> None:
        image = Image.new("RGB", (900, 600), "#acd29f")
        draw = ImageDraw.Draw(image)
        lines = ["OFERTA DA SEMANA", "SUV 2024", "CHAME NO WHATSAPP"]
        for index, line in enumerate(lines):
            draw.text((80, 100 + index * 130), line, fill="#17351b")

        self.assertTrue(detector_app._possible_document_background(image))
        documento, tipo, possivel, _vehicle = self.detect_with_text(
            image,
            "\n".join(lines),
        )
        self.assertEqual((documento, tipo, possivel), (False, None, False))

    def test_green_background_with_thirty_tiny_lines_is_possible_document(
        self,
    ) -> None:
        image = Image.new("RGB", (900, 800), "#b4d7aa")
        draw = ImageDraw.Draw(image)
        lines = [f"campo sintetico {index:02d}" for index in range(30)]
        for index, line in enumerate(lines):
            draw.text((35, 10 + index * 25), line, fill="#18371c")

        self.assertTrue(detector_app._possible_document_background(image))
        documento, tipo, possivel, _vehicle = self.detect_with_text(
            image,
            "\n".join(lines),
        )
        self.assertEqual((documento, tipo, possivel), (False, None, True))

    def test_old_green_crlv_without_full_header_is_possible_document(
        self,
    ) -> None:
        image = Image.new("RGB", (900, 800), "#b4d7aa")
        text = "\n".join(
            [
                "REGISTRO NACIONAL",
                "PLACA VEICULO",
                "RENAVAM NUMERO",
                "MARCA MODELO",
                "ANO FABRICACAO",
                "COR PREDOMINANTE",
                "COMBUSTIVEL CATEGORIA",
                "PROPRIETARIO NOME",
            ]
        )
        documento, tipo, possivel, _vehicle = self.detect_with_text(
            image,
            text,
        )
        self.assertEqual((documento, tipo, possivel), (False, None, True))

    def test_synthetic_documents_rotated_blurred_dark_on_wood_are_detected(
        self,
    ) -> None:
        try:
            font = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                28,
            )
        except OSError:
            font = ImageFont.load_default()
        fixtures: list[tuple[Image.Image, str]] = []
        for angle, header in (
            (5, "CERTIFICADO DE REGISTRO E LICENCIAMENTO"),
            (-12, "CARTEIRA NACIONAL DE HABILITACAO"),
            (15, "DOCUMENTO DE IDENTIDADE REGISTRO GERAL"),
        ):
            wood = Image.new("RGB", (1100, 800), "#855b3b")
            paper = Image.new("RGB", (850, 600), "#b9d5a7")
            draw = ImageDraw.Draw(paper)
            lines = [
                header,
                "REPUBLICA FEDERATIVA DO BRASIL",
                "PROPRIETARIO PESSOA EXEMPLO",
                "CPF 529.982.247-25",
                "RENAVAM 12345678900",
                "CHASSI 9BWZZZ377VT004251",
            ]
            for index, line in enumerate(lines):
                draw.text((35, 35 + index * 70), line, fill="#172015", font=font)
            transformed = paper.rotate(angle, expand=True, fillcolor="#855b3b")
            wood.paste(
                transformed,
                ((wood.width - transformed.width) // 2, 70),
            )
            transformed_fixture = ImageEnhance.Brightness(
                wood.filter(ImageFilter.GaussianBlur(1.2)),
            ).enhance(0.72)
            fixtures.append((transformed_fixture, "\n".join(lines)))

        for image, ocr_text in fixtures:
            with self.subTest(size=image.size):
                documento, _tipo, possivel, _vehicle = self.detect_with_text(
                    image,
                    ocr_text,
                )
                self.assertTrue(documento or possivel)

    def test_vehicle_detected_skips_document_gate(self) -> None:
        image = Image.new("RGB", (900, 600), "#cccccc")
        with unittest.mock.patch.object(
            detector_app,
            "detect_vehicle",
            return_value=VehicleDetection(True, 0.42),
        ):
            documento, tipo, possivel, vehicle = detector_app._detect_image(image)
        self.assertEqual((documento, tipo, possivel), (False, None, False))
        self.assertTrue(vehicle.vehicle_detected)
        self.assertGreaterEqual(vehicle.vehicle_area_ratio, 0.15)


if __name__ == "__main__":
    unittest.main()
