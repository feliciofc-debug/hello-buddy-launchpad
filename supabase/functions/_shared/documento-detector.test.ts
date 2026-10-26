import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classificarDocumentoIdentidade,
  documentoDetectorInternals,
} from "./documento-detector.ts";

Deno.test("DOC-0.1 — detector aceita somente títulos oficiais esperados", () => {
  const positives = [
    ["CRLV", "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO", "crlv"],
    [
      "CRLV-e",
      "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO DIGITAL",
      "crlv",
    ],
    ["CNH", "CARTEIRA NACIONAL DE HABILITACAO", "cnh"],
    ["RG", "CARTEIRA DE IDENTIDADE REGISTRO GERAL", "rg"],
    [
      "ATPV-e",
      "AUTORIZACAO PARA TRANSFERENCIA DE PROPRIEDADE DO VEICULO ATPV-E",
      "outro",
    ],
  ] as const;
  for (const [name, text, tipo] of positives) {
    assertEquals(
      classificarDocumentoIdentidade(text),
      { documento: true, tipo },
      name,
    );
  }
});

Deno.test("DOC-0.1 — mídia comercial cotidiana não vira documento", () => {
  const negatives = [
    [
      "orçamento",
      "ORCAMENTO FUNILARIA DO ZE CNPJ 04.252.011/0001-10 TELEFONE 11 98765-4321 TOTAL R$ 3.800",
    ],
    ["NF-e", "DANFE DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA NF-E"],
    ["boleto", "BANCO BOLETO PAGAVEL VALOR R$ 850 LINHA DIGITAVEL"],
    [
      "folheto",
      "PROMOCAO CNPJ 04.252.011/0001-10 WHATSAPP 11 98765-4321",
    ],
    [
      "identidade visual",
      "Crie uma identidade visual da marca em azul e branco",
    ],
    ["foto de carro", "SUV PRATA EM ESTUDIO PLACA ABC1D23"],
    [
      "print de anúncio",
      "ANUNCIO COROLLA 2023 R$ 120.000 CHAME 11 98765-4321",
    ],
  ] as const;
  for (const [name, text] of negatives) {
    assertEquals(
      classificarDocumentoIdentidade(text),
      { documento: false, tipo: null },
      name,
    );
  }
});

Deno.test("DOC-0.1 — CPF e CNPJ só são padrões quando o DV é válido", () => {
  assertEquals(documentoDetectorInternals.cpfValid("52998224725"), true);
  assertEquals(documentoDetectorInternals.cpfValid("11111111111"), false);
  assertEquals(documentoDetectorInternals.cnpjValid("04252011000110"), true);
  assertEquals(documentoDetectorInternals.cnpjValid("04252011000111"), false);
  assertEquals(
    classificarDocumentoIdentidade(
      "REPUBLICA FEDERATIVA DO BRASIL DETRAN CPF 529.982.247-25",
    ),
    { documento: true, tipo: "outro" },
  );
  assertEquals(
    classificarDocumentoIdentidade(
      "REPUBLICA FEDERATIVA DO BRASIL DETRAN CPF 111.111.111-11",
    ),
    { documento: false, tipo: null },
  );
});
