import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  avaliarCasamentoProduto,
  prepararPostDoCatalogo,
  PreviaSemProcedenciaError,
  publicarComPreflight,
  renderProcedencia,
  verificarCompatibilidadeRedes,
} from "./post-guardas.ts";

const TERMOS = new Set(["isso", "isto", "post", "foto", "imagem", "video", "midia", "todas", "as redes"]);
const ehGenerico = (q: string) => {
  const n = q.toLowerCase().trim();
  return n.length < 3 || TERMOS.has(n);
};

// 1. ORQUESTRAÇÃO: "postar em todas as redes sociais" não escolhe produto e não cria pedido.
Deno.test("orquestracao: pedido generico nao escolhe produto e nao cria pedido", async () => {
  let pedidosCriados = 0;
  const criarPedido = () => { pedidosCriados++; };

  const r = await prepararPostDoCatalogo({
    query: "todas",
    ehTermoGenerico: ehGenerico,
    listarNomes: () => Promise.resolve(["AMZOFERTAS", "Consultório Odontológico", "Kit"]),
    sugestoes: () => Promise.resolve(["AMZOFERTAS"]),
  });
  if (r.ok) criarPedido();

  assertEquals(r.ok, false);
  assertEquals(pedidosCriados, 0);

  // Nem por aproximação: "redes sociais" também não casa com nenhum produto.
  const r2 = await prepararPostDoCatalogo({
    query: "postar em todas as redes sociais",
    ehTermoGenerico: ehGenerico,
    listarNomes: () => Promise.resolve(["AMZOFERTAS", "Consultório Odontológico"]),
  });
  assertEquals(r2.ok, false);
  if (!r2.ok) assertEquals(r2.resposta.erro, "produto_nao_identificado");
  assertEquals(pedidosCriados, 0);
});

// 2. Prévia sem procedência: erro, nada é enviado.
Deno.test("previa sem procedencia lanca e nao renderiza", () => {
  assertThrows(() => renderProcedencia(undefined), PreviaSemProcedenciaError);
  assertThrows(() => renderProcedencia({ midiaIdCurto: "bd601b92" }), PreviaSemProcedenciaError);
  assertThrows(
    () => renderProcedencia({ origem: "catalogo", midiaIdCurto: "bd601b92", midiaTipo: "foto" }),
    PreviaSemProcedenciaError,
  );

  const txt = renderProcedencia({
    origem: "catalogo",
    produtoNome: "AMZOFERTAS",
    midiaIdCurto: "bd601b92",
    midiaTipo: "foto",
  });
  assertEquals(txt.includes("produto do catálogo: AMZOFERTAS"), true);
  assertEquals(txt.includes("BD601B92"), true);
  assertEquals(txt.includes("Foto"), true);
});

// 3. ORQUESTRAÇÃO: item foto + TikTok selecionado → publicador recebe ZERO chamadas.
Deno.test("orquestracao: foto com tiktok selecionado nao chama o publicador", async () => {
  let chamadasPublicador = 0;
  const out = await publicarComPreflight({
    redes: ["facebook", "instagram", "linkedin", "tiktok"],
    tipo: "foto",
    formato: "feed",
    publicar: (redes) => { chamadasPublicador++; return Promise.resolve(redes); },
  });

  assertEquals(chamadasPublicador, 0);
  assertEquals(out.publicou, false);
  if (!out.publicou) assertEquals(out.resposta.status, "incompatibilidade_de_tipo");

  // Depois do "sim", publica só nas compatíveis — uma única chamada, sem TikTok.
  let redesRecebidas: string[] = [];
  const out2 = await publicarComPreflight({
    redes: ["facebook", "instagram", "linkedin", "tiktok"],
    tipo: "foto",
    formato: "feed",
    somenteCompativeisConfirmado: true,
    redesConfirmadas: ["facebook", "instagram", "linkedin"],
    publicar: (redes) => { chamadasPublicador++; redesRecebidas = redes; return Promise.resolve(redes); },
  });
  assertEquals(chamadasPublicador, 1);
  assertEquals(out2.publicou, true);
  assertEquals(redesRecebidas, ["facebook", "instagram", "linkedin"]);
});

// 4. Código curto rotulado resolve; produto nomeado vai pelo casamento forte.
Deno.test("casamento forte: nome exato e nome curto", async () => {
  assertEquals(avaliarCasamentoProduto("kit de ferramentas", ["Kit"]).forca, "fraco");
  assertEquals(avaliarCasamentoProduto("Kit", ["Kit"]).forca, "exato");
  assertEquals(avaliarCasamentoProduto("posta o AMZOFERTAS no instagram", ["AMZOFERTAS"]).forca, "palavra_inteira");

  const r = await prepararPostDoCatalogo({
    query: "posta o AMZOFERTAS no instagram",
    ehTermoGenerico: ehGenerico,
    listarNomes: () => Promise.resolve(["Consultório Odontológico", "AMZOFERTAS"]),
  });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.indice, 1);
});

Deno.test("ambiguidade nao escolhe: dois casamentos fortes perguntam", async () => {
  const r = await prepararPostDoCatalogo({
    query: "cadeira gamer cadeira escritorio",
    ehTermoGenerico: ehGenerico,
    listarNomes: () => Promise.resolve(["cadeira gamer", "cadeira escritorio"]),
  });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals((r.resposta.candidatos_do_catalogo as string[]).length, 2);
});

Deno.test("compatibilidade: video passa em todas as redes", () => {
  const c = verificarCompatibilidadeRedes(["facebook", "instagram", "tiktok", "linkedin"], "video", "feed");
  assertEquals(c.incompativeis.length, 0);
  assertEquals(c.compativeis.length, 4);
});

// A camada de termos genéricos NÃO toca no banco: listarNomes não é chamado.
Deno.test("termo generico nao lista o catalogo", async () => {
  let listagens = 0;
  await prepararPostDoCatalogo({
    query: "isso",
    ehTermoGenerico: ehGenerico,
    listarNomes: () => { listagens++; return Promise.resolve([]); },
  });
  assertEquals(listagens, 0);
});

Deno.test("orquestracao: compatPendente com flag false NAO publica, mesmo com redesConfirmadas gravado", async () => {
  let chamadas = 0;
  const out = await publicarComPreflight({
    redes: ["facebook", "instagram", "tiktok"],
    tipo: "foto",
    formato: "feed",
    // Estado exatamente como marcarCompatPendente grava no banco:
    somenteCompativeisConfirmado: false,
    redesConfirmadas: ["facebook", "instagram"],
    publicar: async (redes) => { chamadas++; return redes; },
  });
  assertEquals(chamadas, 0);
  assertEquals(out.publicou, false);
});
