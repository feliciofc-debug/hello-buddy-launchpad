import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildProcedenciaResumo,
  parseEndpointErro,
} from "./consultar-placa-parse.ts";
import type { ConsultarPlacaCallResult } from "./consultar-placa-client.ts";

function mockResult(partial: Partial<ConsultarPlacaCallResult>): ConsultarPlacaCallResult {
  return {
    ok: true,
    httpStatus: 200,
    endpoint: "/x",
    tipoErro: null,
    payload: null,
    indisponivel: false,
    ...partial,
  };
}

Deno.test("parse leilão e indisponível", () => {
  const r = mockResult({
    ok: false,
    indisponivel: true,
    tipoErro: "servico_indisponivel",
    payload: { status: "erro", tipo_do_erro: "servico_indisponivel" },
  });
  assertEquals(parseEndpointErro(r), "servico_indisponivel");
  const resumo = buildProcedenciaResumo({
    consultarRegistroLeilaoPrime: mockResult({
      payload: {
        status: "ok",
        dados: { possui: true, classificacao: "B", parecer: "alerta" },
      },
    }),
  }, 100);
  assert(resumo.leilao.possui);
  assertEquals(resumo.leilao.classificacao, "B");
});

Deno.test("credito insuficiente HTTP 402", () => {
  const r = mockResult({ ok: false, httpStatus: 402, tipoErro: "credito_insuficiente" });
  assertEquals(parseEndpointErro(r), "credito_insuficiente");
});

Deno.test("resumo não inclui cpf proprietário", () => {
  const resumo = buildProcedenciaResumo({
    consultarPlaca: mockResult({
      payload: {
        status: "ok",
        dados: {
          marca: "BMW",
          modelo: "X1",
          cpf: "12345678900",
          nome_proprietario: "João",
        },
      },
    }),
  }, null);
  assertEquals(resumo.veiculo.marca, "BMW");
  const json = JSON.stringify(resumo);
  assert(!json.includes("12345678900"));
  assert(!json.includes("João"));
});
