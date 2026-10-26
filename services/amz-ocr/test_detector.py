import unittest

from detector import classify_document


class DetectorTest(unittest.TestCase):
    def test_crlv(self) -> None:
        self.assertEqual(
            classify_document(
                "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO RENAVAM 12345678900"
            ),
            (True, "crlv"),
        )

    def test_cnh(self) -> None:
        self.assertEqual(
            classify_document("CARTEIRA NACIONAL DE HABILITAÇÃO CNH"),
            (True, "cnh"),
        )

    def test_rg(self) -> None:
        self.assertEqual(
            classify_document("CARTEIRA DE IDENTIDADE REGISTRO GERAL"),
            (True, "rg"),
        )

    def test_generic_document_patterns(self) -> None:
        self.assertEqual(
            classify_document("CPF 529.982.247-25 ATPV"),
            (True, "outro"),
        )

    def test_vehicle_photo_is_not_document(self) -> None:
        self.assertEqual(
            classify_document("SUV PRATA EM ESTUDIO PLACA ABC1D23"),
            (False, None),
        )


if __name__ == "__main__":
    unittest.main()
