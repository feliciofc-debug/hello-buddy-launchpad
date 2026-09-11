import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classificarIntencao,
  ferramentaPermitida,
  mensagemDeErroParaUsuario,
} from "./jarvis-intent.ts";

// Matriz de intenção: frases reais, inclusive com erro de digitação e abreviação.
const CASOS: Array<{ frase: string; esperado: string; pending?: Record<string, boolean> }> = [
  // vídeo
  { frase: "faz um vídeo sobre a AMZ Ofertas", esperado: "video" },
  { frase: "faz um vídeo animado institucional de 45 segundos sobre a AMZ Ofertas", esperado: "video" },
  {
    frase:
      "faz um vídeo animado institucional de 45 segundos sobre a AMZ Ofertas. O dono manda áudio no WhatsApp, a IA escreve a legenda e cria a arte, e a publicação sai no Instagram, Facebook, TikTok, LinkedIn e WhatsApp",
    esperado: "video",
  },
  { frase: "cria um video pra divulgar no instagram", esperado: "video" },
  { frase: "faz um vdeo animado pro facebook", esperado: "video" },
  { frase: "quero um vídeo institucional", esperado: "video" },
  // vídeo mesmo com fluxo de imagem anterior
  { frase: "faz um vídeo animado institucional de 45 segundos", esperado: "video", pending: { imagemRecente: true } },
  // post
  { frase: "cria um post sobre consórcio", esperado: "post" },
  { frase: "monta uma arte com legenda pro insta", esperado: "post" },
  // editar imagem
  { frase: "muda a cor dessa imagem", esperado: "editar_imagem" },
  { frase: "melhora essa foto e coloca um cenario bonito", esperado: "editar_imagem" },
  { frase: "coloca minha logo na foto", esperado: "editar_imagem" },
  { frase: "tira o fundo dessa imgem", esperado: "editar_imagem" },
  // publicar
  { frase: "publica em todas", esperado: "publicar" },
  { frase: "posta no instagram e no facebook", esperado: "publicar" },
  { frase: "publca em todas as redes", esperado: "publicar" },
  // aprovação e cancelamento com pendência
  { frase: "aprovado", esperado: "aprovar_video", pending: { videoDraft: true } },
  { frase: "pode gerar", esperado: "aprovar_video", pending: { videoDraft: true } },
  { frase: "cancela", esperado: "cancelar_video", pending: { videoDraft: true } },
  // aprovação sem pendência não vira vídeo
  { frase: "ok", esperado: "outro" },
];

Deno.test("matriz de intenção do Jarvis", () => {
  for (const caso of CASOS) {
    const { intent } = classificarIntencao(caso.frase, caso.pending ?? {});
    assertEquals(intent, caso.esperado, `frase: ${caso.frase} → ${intent}`);
  }
});

Deno.test("pedido de vídeo nunca cai em ferramenta de imagem", () => {
  const { intent } = classificarIntencao(
    "faz um vídeo animado institucional de 45 segundos sobre a AMZ Ofertas para Instagram e Facebook",
  );
  assertEquals(intent, "video");
  assertEquals(ferramentaPermitida(intent, "editar_imagem"), false);
  assertEquals(ferramentaPermitida(intent, "criar_video_animado"), true);
});

Deno.test("edição de imagem nunca chama vídeo", () => {
  const { intent } = classificarIntencao("muda a cor dessa imagem");
  assertEquals(intent, "editar_imagem");
  assertEquals(ferramentaPermitida(intent, "criar_video_animado"), false);
});

Deno.test("códigos internos nunca vazam para o usuário", () => {
  const msg = mensagemDeErroParaUsuario("sem_imagem");
  assertEquals(msg.includes("sem_imagem"), false);
  assertEquals(mensagemDeErroParaUsuario("erro_desconhecido_xyz").includes("erro_desconhecido_xyz"), false);
});
