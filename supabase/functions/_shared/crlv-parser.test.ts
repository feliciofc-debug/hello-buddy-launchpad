import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { respostaCrlvWhatsApp } from "./documento-portao.ts";
import { parseCrlvText, validarRenavam } from "./crlv-parser.ts";

const CRLV_E_SINTETICO = `
CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO
PLACA: ABC1D23
RENAVAM: 12345678900
CHASSI: 9BWZZZ377VT004251
NUMERO DO MOTOR: MOT123456
MARCA/MODELO/VERSAO: MARCA TESTE / MODELO EXEMPLO / VERSAO X
ANO FABRICACAO: 2022
ANO MODELO: 2023
COR PREDOMINANTE: PRATA
COMBUSTIVEL: ALCOOL / GASOLINA
ESPECIE/TIPO: PASSAGEIRO AUTOMOVEL
CATEGORIA: PARTICULAR
CARROCERIA: SEDAN
POTENCIA/CILINDRADA: 150 CV / 1998 CC
CAPACIDADE/LOTACAO: 5 / 5
PBT/CMT: 1.80 / 3.50
NUMERO CRV: 123456789012
CODIGO DE SEGURANCA DO CLA: CLA987654321
EXERCICIO: 2026
DATA DE EMISSAO: 15/10/2026
MUNICIPIO/UF: CIDADE TESTE / SP
NOME DO PROPRIETARIO: PESSOA SINTETICA
CPF/CNPJ: 529.982.247-25
OBSERVACOES: ALIENACAO FIDUCIARIA: BANCO SINTETICO
RESTRICAO ADMINISTRATIVA
`;

Deno.test("DOC-1 — parser extrai todos os campos do CRLV-e sintético", () => {
  const result = parseCrlvText(CRLV_E_SINTETICO, "pdf_texto");
  assertEquals(result.veiculo.placa, { valor: "ABC1D23", confianca: "alta" });
  assertEquals(result.veiculo.renavam.valor, "12345678900");
  assertEquals(result.veiculo.chassi.valor, "9BWZZZ377VT004251");
  assertEquals(result.veiculo.numero_motor.valor, "MOT123456");
  assertStringIncludes(
    result.veiculo.marca_modelo_versao.valor ?? "",
    "MODELO EXEMPLO",
  );
  assertEquals(result.veiculo.ano_fabricacao.valor, 2022);
  assertEquals(result.veiculo.ano_modelo.valor, 2023);
  assertEquals(result.veiculo.cor.valor, "PRATA");
  assertEquals(result.veiculo.combustivel.valor, "flex");
  assertEquals(result.veiculo.especie_tipo.valor, "PASSAGEIRO AUTOMOVEL");
  assertEquals(result.veiculo.categoria.valor, "PARTICULAR");
  assertEquals(result.veiculo.carroceria.valor, "SEDAN");
  assertEquals(result.veiculo.potencia_cv.valor, 150);
  assertEquals(result.veiculo.cilindrada_cc.valor, 1998);
  assertEquals(result.veiculo.capacidade.valor, 5);
  assertEquals(result.veiculo.lotacao.valor, 5);
  assertEquals(result.veiculo.pbt.valor, 1.8);
  assertEquals(result.veiculo.cmt.valor, 3.5);
  assertEquals(result.documento.numero_crv.valor, "123456789012");
  assertEquals(result.documento.codigo_seguranca_cla.valor, "CLA987654321");
  assertEquals(result.documento.exercicio.valor, 2026);
  assertEquals(result.documento.data_emissao.valor, "2026-10-15");
  assertEquals(result.documento.municipio.valor, "CIDADE TESTE");
  assertEquals(result.documento.uf.valor, "SP");
  assertEquals(result.proprietario.nome.valor, "PESSOA SINTETICA");
  assertEquals(result.proprietario.cpf_cnpj.valor, "52998224725");
  assertEquals(result.observacoes.alienacao_fiduciaria.valor, true);
  assertEquals(result.observacoes.financeira.valor, "BANCO SINTETICO");
  assertStringIncludes(
    result.observacoes.restricoes.valor?.[0] ?? "",
    "RESTRICAO",
  );
  assertEquals(result.leitura_fraca, false);
});

Deno.test("DOC-1 — OCR com ruído corrige caracteres só quando DV permanece válido", () => {
  const result = parseCrlvText(
    `
    PLACA ABC1D23
    RENAVAM 123456789O0
    CHASSI 9BWZZZ377VTOO4251
    MARCA/MODELO MARCA TESTE MODELO OCR
    ANO MODELO 2023
  `,
    "ocr",
  );
  assertEquals(result.veiculo.renavam.valor, "12345678900");
  assertEquals(result.veiculo.renavam.confianca, "media");
  assertEquals(result.veiculo.chassi.valor, "9BWZZZ377VT004251");
  assertEquals(result.veiculo.chassi.confianca, "media");
});

Deno.test("DOC-1 — campos inválidos ficam vazios", () => {
  const result = parseCrlvText(`
    PLACA: INVALIDA
    RENAVAM: 11111111111
    CHASSI: 9BWIOQ
    CPF/CNPJ: 111.111.111-11
    DATA DE EMISSAO: 31/02/2026
  `);
  assertEquals(result.veiculo.placa.valor, null);
  assertEquals(result.veiculo.renavam.valor, null);
  assertEquals(result.veiculo.chassi.valor, null);
  assertEquals(result.proprietario.cpf_cnpj.valor, null);
  assertEquals(result.documento.data_emissao.valor, null);
  assertEquals(result.leitura_fraca, true);
  assertEquals(validarRenavam("12345678900"), true);
  assertEquals(validarRenavam("12345678901"), false);
});

Deno.test("VEIC-WPP-1 — parser reconhece CRLV antigo em papel", () => {
  const result = parseCrlvText(
    `
CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO
PLACA: LMC-5764
RENAVAM: 12345678900
CHASSI: 9BWZZZ377VT004251
MARCA / MODELO: VOLKSWAGEN GOL CL 1.6
ANO FAB / ANO MOD: 1998 1999
COR: VERDE
COMBUSTIVEL: GASOLINA
ESPECIE / TIPO: PASSAGEIRO AUTOMOVEL
CATEGORIA: PARTICULAR
MUNICIPIO: RIO DE JANEIRO
UF: RJ
NOME: PESSOA SINTETICA COMPLETA
CPF/CNPJ: 529.982.247-25
`,
    "ocr",
  );
  assertEquals(result.veiculo.placa.valor, "LMC5764");
  assertEquals(
    result.veiculo.marca_modelo_versao.valor,
    "VOLKSWAGEN GOL CL 1.6",
  );
  assertEquals(result.veiculo.ano_fabricacao.valor, 1998);
  assertEquals(result.veiculo.ano_modelo.valor, 1999);
  assertEquals(result.documento.municipio.valor, "RIO DE JANEIRO");
  assertEquals(result.documento.uf.valor, "RJ");
  assertEquals(result.proprietario.nome.valor, "PESSOA SINTETICA COMPLETA");
  assertEquals(result.leitura_fraca, false);
});

Deno.test("OCR-FIX-2 — parser reconhece linhas matriciais do CRLV verde antigo", () => {
  const result = parseCrlvText(
    `
REPUBLICA FEDERATIVA DO BRASIL
MINISTERIO DAS CIDADES
DETRAN - RJ
Nº 012345678901
CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO
VIA COD. RENAVAN RNTRC EXERCICIO
1 12345678900 ******** 2016
NOME
FULANO DE TAL SILVA / **** RES.CONTRAN No 310/09 ****
CPF/CNPJ PLACA
123.456.789-09 ABC1234
PLACA ANT/UF CHASS1
*******/** 9BWZZZ377VT004251
ESPECIE TIPO COMBUSTIVEL
PAS/AUTOMOVEL/NAO APLIC ALCO/GASOL
MARCA/MODELO ANO FAB ANO MOD
TOYOTA/COROLLA ALTISFLEX 2014 2015
CAP/POT/CIL CATEGORIA COR PREDOMINANTE
5 PAS/154/1987 PARTIC PRATA
LOCAL DATA
RIO DE JANEIRO 23/03/2016
`,
    "ocr",
  );
  assertEquals(result.veiculo.placa.valor, "ABC1234");
  assertEquals(result.veiculo.renavam.valor, "12345678900");
  assertEquals(result.veiculo.chassi.valor, "9BWZZZ377VT004251");
  assertEquals(
    result.veiculo.marca_modelo_versao.valor,
    "TOYOTA/COROLLA ALTISFLEX",
  );
  assertEquals(result.veiculo.ano_fabricacao.valor, 2014);
  assertEquals(result.veiculo.ano_modelo.valor, 2015);
  assertEquals(result.veiculo.cor.valor, "PRATA");
  assertEquals(result.veiculo.combustivel.valor, "flex");
  assertEquals(
    result.veiculo.especie_tipo.valor,
    "PAS/AUTOMOVEL/NAO APLIC",
  );
  assertEquals(result.veiculo.categoria.valor, "PARTIC");
  assertEquals(result.veiculo.potencia_cv.valor, 154);
  assertEquals(result.veiculo.cilindrada_cc.valor, 1987);
  assertEquals(result.documento.municipio.valor, "RIO DE JANEIRO");
  assertEquals(result.documento.uf.valor, "RJ");
  assertEquals(result.documento.data_emissao.valor, "2016-03-23");
  assertEquals(result.proprietario.nome.valor, "FULANO DE TAL SILVA");
  assertEquals(result.proprietario.cpf_cnpj.valor, "12345678909");
  assertEquals(result.leitura_fraca, false);

  const response = respostaCrlvWhatsApp(result);
  assertStringIncludes(response, "CPF/CNPJ: ***.456.789-**");
  assertEquals(response.includes("123.456.789-09"), false);
});

Deno.test("DOC-1 — leitura e parser não importam IA externa", async () => {
  const parser = await Deno.readTextFile(
    new URL("./crlv-parser.ts", import.meta.url),
  );
  const leitura = await Deno.readTextFile(
    new URL("./crlv-leitura.ts", import.meta.url),
  );
  for (const source of [parser, leitura]) {
    assertEquals(
      /gateway|gemini|openai|anthropic|vision|llm/i.test(source),
      false,
    );
  }
});
