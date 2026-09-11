import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  JARVIS_PUBLICACAO_ATIVA,
  ehUuid,
  idCurto,
  nomeDoArquivo,
  resolverAsset,
  tipoPelaExtensao,
  validarTipoAprovado,
  type AssetPublicavel,
} from "./publicacao-por-id.ts";

const VIDEO_ID = "11111111-1111-4111-8111-111111111111";
const IMAGEM_ID = "22222222-2222-4222-8222-222222222222";
const OUTRO_DONO = "33333333-3333-4333-8333-333333333333";
const BLOQUEADA = "44444444-4444-4444-8444-444444444444";

const LINHAS: Record<string, any> = {
  [VIDEO_ID]: {
    id: VIDEO_ID, user_id: "dono", tipo: "video",
    midia_url: "https://x.co/storage/novo-video.mp4",
    thumbnail_url: null, arquivo_nome: null, status: "pendente",
    created_at: "2026-09-11T10:51:00Z", contexto_original: "video motion",
  },
  [IMAGEM_ID]: {
    id: IMAGEM_ID, user_id: "dono", tipo: "foto",
    midia_url: "https://x.co/storage/arte-antiga.png",
    thumbnail_url: null, arquivo_nome: null, status: "pendente",
    created_at: "2026-09-10T10:00:00Z", contexto_original: null,
  },
  [BLOQUEADA]: {
    id: BLOQUEADA, user_id: "dono", tipo: "video",
    midia_url: "https://x.co/storage/pessoal.mp4",
    thumbnail_url: null, arquivo_nome: null, status: "bloqueado_incidente",
    created_at: "2026-09-10T09:00:00Z", contexto_original: null,
  },
};

// Fake mínimo do cliente: só responde por (user_id, id), como o real.
function fakeSb() {
  return {
    from() {
      const filtros: Record<string, string> = {};
      const api: any = {
        select() { return api; },
        eq(coluna: string, valor: string) { filtros[coluna] = valor; return api; },
        limit() {
          const row = LINHAS[filtros.id];
          if (!row || row.user_id !== filtros.user_id) return Promise.resolve({ data: [], error: null });
          return Promise.resolve({ data: [row], error: null });
        },
      };
      return api;
    },
  };
}

// Publicação pelo WhatsApp foi reativada a pedido do dono; as guardas por ID,
// procedência e compatibilidade são o que impede publicação errada agora.
Deno.test("publicação pelo Jarvis está ativa e depende das guardas por ID", () => {
  assertEquals(JARVIS_PUBLICACAO_ATIVA, true);
});

Deno.test("ID curto é estável e comparável entre geração e confirmação", () => {
  assertEquals(idCurto(VIDEO_ID), "11111111");
  assertEquals(idCurto(VIDEO_ID), idCurto(VIDEO_ID));
  assert(idCurto(VIDEO_ID) !== idCurto(IMAGEM_ID));
});

Deno.test("ID inválido é recusado sem consultar nada", async () => {
  const r = await resolverAsset(fakeSb(), "dono", "nao-e-um-id");
  assertEquals(r.erro, "midia_nao_identificada");
  assert(!r.asset);
  assertEquals(ehUuid("nao-e-um-id"), false);
});

Deno.test("item inexistente falha, sem cair em outra mídia", async () => {
  const r = await resolverAsset(fakeSb(), "dono", OUTRO_DONO);
  assertEquals(r.erro, "midia_nao_encontrada");
  assert(!r.asset);
});

Deno.test("item de outro cliente nunca é devolvido", async () => {
  const r = await resolverAsset(fakeSb(), "outro-cliente", VIDEO_ID);
  assertEquals(r.erro, "midia_nao_encontrada");
  assert(!r.asset);
});

Deno.test("mídia bloqueada no incidente não pode publicar", async () => {
  const r = await resolverAsset(fakeSb(), "dono", BLOQUEADA);
  assertEquals(r.erro, "midia_bloqueada");
});

Deno.test("vídeo aprovado devolve o vídeo aprovado, com nome do arquivo", async () => {
  const { asset } = await resolverAsset(fakeSb(), "dono", VIDEO_ID);
  assert(asset);
  assertEquals(asset!.tipo, "video");
  assertEquals(asset!.arquivoNome, "novo-video.mp4");
  assertEquals(asset!.url, LINHAS[VIDEO_ID].midia_url);
});

Deno.test("vídeo aprovado não pode publicar imagem, nem o contrário", async () => {
  const { asset: video } = await resolverAsset(fakeSb(), "dono", VIDEO_ID);
  const { asset: imagem } = await resolverAsset(fakeSb(), "dono", IMAGEM_ID);
  assertEquals(validarTipoAprovado("video", video!), null);
  assertEquals(validarTipoAprovado("foto", imagem!), null);
  assert(validarTipoAprovado("foto", video!)?.includes("difere"));
  assert(validarTipoAprovado("video", imagem!)?.includes("difere"));
  assert(validarTipoAprovado(null, video!) === "tipo_aprovado_ausente");
});

Deno.test("arquivo que não bate com o tipo registrado é recusado", () => {
  const falso: AssetPublicavel = {
    id: VIDEO_ID, idCurto: idCurto(VIDEO_ID), tipo: "video",
    url: "https://x.co/storage/arte.png", arquivoNome: "arte.png",
    thumbnail: null, criadoEm: null, origem: null, bloqueado: false,
  };
  assert(validarTipoAprovado("video", falso)?.includes("arquivo_foto"));
});

Deno.test("tipo pela extensão reconhece vídeo e imagem", () => {
  assertEquals(tipoPelaExtensao("https://x.co/a/1789044241986-l0z34i.mp4"), "video");
  assertEquals(tipoPelaExtensao("https://x.co/a/arte.png?x=1"), "foto");
  assertEquals(tipoPelaExtensao("https://x.co/a/sem-extensao"), null);
  assertEquals(nomeDoArquivo("https://x.co/a/1789044241986-l0z34i.mp4"), "1789044241986-l0z34i.mp4");
});
