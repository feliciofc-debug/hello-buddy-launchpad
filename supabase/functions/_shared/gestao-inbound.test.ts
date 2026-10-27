import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { inferGestaoCategoria } from "./gestao-categoria-pt.ts";
import {
  classifyGestaoIntent,
  isGestaoAffirmative,
  isGestaoNegative,
} from "./gestao-intent-pt.ts";
import { isGestaoAuthorizedPhone } from "./gestao-auth-phone.ts";
import { tryProcessGestaoLucroInbound } from "./gestao-inbound.ts";
import { parseGestaoValorPt } from "./gestao-valor-pt.ts";
import { rankGestaoVeiculoMatches } from "./gestao-veiculo-match.ts";
import {
  parseGestaoDisambiguationPick,
} from "./gestao-intent-pt.ts";

Deno.test("parseGestaoValorPt casos obrigatórios", () => {
  assertEquals(parseGestaoValorPt("850"), 850);
  assertEquals(parseGestaoValorPt("1.200"), 1200);
  assertEquals(parseGestaoValorPt("1,2 mil"), 1200);
  assertEquals(parseGestaoValorPt("mil e duzentos"), 1200);
  assertEquals(parseGestaoValorPt("R$ 3.500,00"), 3500);
  assertEquals(parseGestaoValorPt("80 mil"), 80000);
  assertEquals(parseGestaoValorPt("meio milhão"), 500_000);
});

Deno.test("categorias despesa", () => {
  assertEquals(inferGestaoCategoria("pneu novo"), "pneus");
  assertEquals(inferGestaoCategoria("funilaria lateral"), "funilaria_pintura");
  assertEquals(inferGestaoCategoria("bateria nova"), "mecanica");
  assertEquals(inferGestaoCategoria("martelinho de ouro"), "funilaria_pintura");
  assertEquals(inferGestaoCategoria("almoço"), "outros");
});

Deno.test("intent despesa exige valor e veículo", () => {
  const ok = classifyGestaoIntent("gastei 850 de pneu no X6");
  assertEquals(ok.kind, "despesa");
  assertEquals(classifyGestaoIntent("gastei 850").kind, "none");
  assertEquals(classifyGestaoIntent("lembrete amanhã 10h").kind, "none");
  assertEquals(classifyGestaoIntent("meu estoque").kind, "none");
});

Deno.test("confirmação SIM/NÃO", () => {
  assertEquals(isGestaoAffirmative("SIM"), true);
  assertEquals(isGestaoNegative("cancelar"), true);
});

Deno.test("match veículo por modelo", () => {
  const rows = [{
    id: "1",
    marca: "BMW",
    modelo: "X6",
    versao: null,
    placa: "ABC1D23",
  }];
  assertEquals(rankGestaoVeiculoMatches("x6", rows).length, 1);
});

Deno.test("desambiguação: parse opção numérica", () => {
  assertEquals(parseGestaoDisambiguationPick("2"), 2);
  assertEquals(parseGestaoDisambiguationPick("opção 2"), 2);
  assertEquals(parseGestaoDisambiguationPick("o 2"), 2);
});

Deno.test("gestor cadastrado autorizado sem ser owner_phone", () => {
  assert(
    isGestaoAuthorizedPhone("5521999887766", {
      ownerPhone: "5521888776655",
      ownerAltPhones: [],
      gestores: ["5521999887766"],
    }),
  );
});

Deno.test("gestor ver carros não aciona intent gestão", () => {
  assertEquals(classifyGestaoIntent("ver carros").kind, "none");
});

Deno.test("AJUDA-1 — cliente e parceiro nunca recebem ajuda de gestão", async () => {
  let dbTouched = false;
  const result = await tryProcessGestaoLucroInbound({
    sb: {
      from: () => {
        dbTouched = true;
        throw new Error("não deveria consultar");
      },
    },
    userId: "u1",
    fromNumber: "5511999999999",
    userText: "cartilha",
    hasInboundMedia: false,
    auth: {
      ownerPhone: "5521888776655",
      ownerAltPhones: [],
      gestores: ["5521777666555"],
    },
    agentState: {},
    saveAgentStatePatch: async () => true,
  });
  assertEquals(result.handled, false);
  assertEquals(dbTouched, false);
});

Deno.test("AJUDA-1 — fechamento inbound usa builder de produção", async () => {
  const source = await Deno.readTextFile(
    new URL("./gestao-inbound.ts", import.meta.url),
  );
  assert(source.includes('intent.kind === "fechamento_dia"'));
  assert(source.includes("buildGestaoFechamentoDia("));
  assert(source.includes("financeiroPermitido: true"));
});

Deno.test("AJUDA-1 — ajuda curta oferece a cartilha sem anexar de imediato", async () => {
  const sb = {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _value: string) => ({
          maybeSingle: () =>
            Promise.resolve({
              data: table === "profiles"
                ? { tipo: "revenda_veiculos" }
                : {
                  segmento: null,
                  sobre_negocio: null,
                  vitrine_veiculos_demo: false,
                },
            }),
        }),
      }),
    }),
  };
  const result = await tryProcessGestaoLucroInbound({
    sb,
    userId: "u1",
    fromNumber: "5521888776655",
    userText: "ajuda",
    hasInboundMedia: false,
    auth: {
      ownerPhone: "5521888776655",
      ownerAltPhones: [],
      gestores: [],
    },
    agentState: {},
    saveAgentStatePatch: async () => true,
  });
  assertEquals(result.handled, true);
  assert(String(result.reply).includes("COMO PEDIR AO JARVIS"));
  assert(String(result.reply).includes("Responda *cartilha*"));
});

Deno.test("desambiguação: 2 → confirmação; sim → persiste", async () => {
  const vehicles = [
    {
      id: "v1",
      marca: "BMW",
      modelo: "X6",
      versao: null,
      placa: null,
      status: "disponivel",
      preco: 100,
    },
    {
      id: "v2",
      marca: "BMW",
      modelo: "X6",
      versao: "M",
      placa: null,
      status: "disponivel",
      preco: 200,
    },
  ];
  const state: Record<string, unknown> = {
    pending_gestao_confirm: {
      phase: "disambiguation",
      action: "despesa",
      draft: { valor: 850, categoria: "pneus" },
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      options: [
        { n: 1, veiculo_id: "v1", label: "BMW X6" },
        { n: 2, veiculo_id: "v2", label: "BMW X6 M" },
      ],
    },
  };
  const sb = {
    from: (table: string) => {
      const api: Record<string, unknown> = {
        select: (_cols: string) => api,
        insert: (_row: Record<string, unknown>) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: "d1" }, error: null }),
          }),
        }),
      };
      api.eq = (col: string, _val: string) => {
        if (table === "profiles" && col === "id") {
          return {
            maybeSingle: () => Promise.resolve({ data: { tipo: "revenda_veiculos" } }),
          };
        }
        if (table === "empresa_config" && col === "user_id") {
          return {
            maybeSingle: () => Promise.resolve({
              data: { segmento: null, sobre_negocio: null, vitrine_veiculos_demo: false },
            }),
          };
        }
        if (table === "veiculos_estoque" && col === "user_id") {
          return Promise.resolve({ data: vehicles });
        }
        return api;
      };
      return api;
    },
  };
  const auth = {
    ownerPhone: "5521888776655",
    ownerAltPhones: [] as string[],
    gestores: [] as string[],
  };
  const save = async (patch: Record<string, unknown>, current: Record<string, unknown>) => {
    Object.assign(state, patch);
    Object.assign(current, patch);
    return true;
  };
  const pick = await tryProcessGestaoLucroInbound({
    sb,
    userId: "u1",
    fromNumber: "5521888776655",
    userText: "2",
    hasInboundMedia: false,
    auth,
    agentState: state,
    saveAgentStatePatch: save,
  });
  assertEquals(pick.handled, true);
  assert(String(pick.reply).includes("Confirmar"));

  const confirm = await tryProcessGestaoLucroInbound({
    sb,
    userId: "u1",
    fromNumber: "5521888776655",
    userText: "sim",
    hasInboundMedia: false,
    auth,
    agentState: state,
    saveAgentStatePatch: save,
  });
  assertEquals(confirm.handled, true);
  assertEquals(confirm.reply, "Despesa registrada.");
});

Deno.test("confirmação despesa mostra label e aceita correção de categoria", async () => {
  const vehicles = [{
    id: "v1",
    marca: "BMW",
    modelo: "428i",
    versao: null,
    placa: null,
    status: "disponivel",
    preco: 100,
  }];
  const state: Record<string, unknown> = {
    pending_gestao_confirm: {
      phase: "confirm",
      action: "despesa",
      draft: { valor: 1100, categoria: "outros", veiculo_id: "v1" },
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    },
  };
  const sb = {
    from: (table: string) => {
      const api: Record<string, unknown> = { select: (_cols: string) => api };
      api.eq = (col: string, _val: string) => {
        if (table === "profiles" && col === "id") {
          return { maybeSingle: () => Promise.resolve({ data: { tipo: "revenda_veiculos" } }) };
        }
        if (table === "empresa_config" && col === "user_id") {
          return {
            maybeSingle: () => Promise.resolve({
              data: { segmento: null, sobre_negocio: null, vitrine_veiculos_demo: false },
            }),
          };
        }
        if (table === "veiculos_estoque" && col === "user_id") {
          return Promise.resolve({ data: vehicles });
        }
        return api;
      };
      return api;
    },
  };
  const auth = { ownerPhone: "5521888776655", ownerAltPhones: [] as string[], gestores: [] as string[] };
  const save = async (patch: Record<string, unknown>, current: Record<string, unknown>) => {
    Object.assign(state, patch);
    Object.assign(current, patch);
    return true;
  };
  const fix = await tryProcessGestaoLucroInbound({
    sb,
    userId: "u1",
    fromNumber: "5521888776655",
    userText: "mecânica",
    hasInboundMedia: false,
    auth,
    agentState: state,
    saveAgentStatePatch: save,
  });
  assertEquals(fix.handled, true);
  assert(String(fix.reply).includes("Mecânica"));
  const pending = state.pending_gestao_confirm as { draft: { categoria: string } };
  assertEquals(pending.draft.categoria, "mecanica");
});
