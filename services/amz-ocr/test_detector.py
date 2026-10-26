import unittest

from detector import classify_document


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


if __name__ == "__main__":
    unittest.main()
