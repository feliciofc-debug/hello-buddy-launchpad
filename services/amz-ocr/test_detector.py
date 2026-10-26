from __future__ import annotations

import unittest
import unittest.mock

from detector import classify_document

try:
    from PIL import Image, ImageDraw

    import app as detector_app

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


@unittest.skipUnless(
    DETECTOR_RUNTIME_AVAILABLE,
    "dependências do detector são instaladas na imagem Docker",
)
class PossibleDocumentTest(unittest.TestCase):
    def detect_with_text(
        self,
        image: Image.Image,
        text: str,
    ) -> tuple[bool, str | None, bool]:
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
        draw.rounded_rectangle((210, 350, 700, 510), radius=45, fill="#b83232")
        draw.ellipse((280, 470, 380, 570), fill="#242424")
        draw.ellipse((550, 470, 650, 570), fill="#242424")

        self.assertTrue(detector_app._possible_document_background(image))
        self.assertEqual(
            self.detect_with_text(image, ""),
            (False, None, False),
        )

    def test_green_ad_with_three_lines_is_not_possible_document(self) -> None:
        image = Image.new("RGB", (900, 600), "#acd29f")
        draw = ImageDraw.Draw(image)
        lines = ["OFERTA DA SEMANA", "SUV 2024", "CHAME NO WHATSAPP"]
        for index, line in enumerate(lines):
            draw.text((80, 100 + index * 130), line, fill="#17351b")

        self.assertTrue(detector_app._possible_document_background(image))
        self.assertEqual(
            self.detect_with_text(image, "\n".join(lines)),
            (False, None, False),
        )

    def test_green_background_with_thirty_tiny_lines_is_possible_document(
        self,
    ) -> None:
        image = Image.new("RGB", (900, 800), "#b4d7aa")
        draw = ImageDraw.Draw(image)
        lines = [f"campo sintetico {index:02d}" for index in range(30)]
        for index, line in enumerate(lines):
            draw.text((35, 10 + index * 25), line, fill="#18371c")

        self.assertTrue(detector_app._possible_document_background(image))
        self.assertEqual(
            self.detect_with_text(image, "\n".join(lines)),
            (False, None, True),
        )


if __name__ == "__main__":
    unittest.main()
