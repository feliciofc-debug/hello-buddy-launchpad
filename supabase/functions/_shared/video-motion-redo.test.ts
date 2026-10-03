import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aplicarCenasLiterais,
  cenasPedidasNoTexto,
  normalizarProps,
  type MotionProps,
  PALETA_PADRAO,
} from "./video-motion.ts";
import { aplicarAjusteRoteiroMotion } from "./video-motion-enfileirar.ts";

const base: MotionProps = {
  marca: "Marca do cliente",
  estilo: "institucional",
  duracao: "medio",
  ritmo: 145,
  arranjo: 2,
  cores: PALETA_PADRAO,
  hook: {
    kicker: "Campanha",
    linhas: ["Título original"],
    destaque: "Hoje",
  },
  chat: {
    titulo: "Conversa",
    mensagens: [{ de: "dono", texto: "Texto original" }],
  },
  blocos: [{ titulo: "Dado real", apoio: "Informado pelo cliente" }],
  cta: { frase: "Fale conosco" },
  legendas: ["Legenda original"],
};

Deno.test("refazer troca somente o fundo e preserva todo o roteiro", () => {
  const result = aplicarAjusteRoteiroMotion(
    base,
    "Refaz e troca o fundo para branco",
  );
  assertEquals(result.changed, true);
  assertEquals(result.props.fundo, "claro");
  assertEquals(result.props.hook, base.hook);
  assertEquals(result.props.blocos, base.blocos);
  assertEquals(result.props.chat, base.chat);
  assertEquals(result.props.legendas, base.legendas);
  assertEquals(base.fundo, undefined);
});

Deno.test("roteiro ditado preserva todas as cenas e duração", () => {
  const script = `Cena 1 (0-5s): Título: "Sem tempo para cuidar do" com destaque em laranja: "marketing?". Narração: "Você cuida do seu negócio. E o marketing, quem cuida?"
Cena 2 (5-12s): Texto: "Tudo pelo WhatsApp". Narração: "Com a AMZ Ofertas, seu marketing inteiro funciona pelo WhatsApp. É só mandar uma mensagem ou um áudio."
Cena 8 (52-60s): Texto: "AMZ Ofertas – seu marketing no WhatsApp". Narração: "AMZ Ofertas. Seu marketing com inteligência artificial, direto no WhatsApp. Peça sua demonstração."`;
  const cenas = cenasPedidasNoTexto(script);
  assertEquals(cenas.length, 3);
  const props = aplicarCenasLiterais(base, cenas);
  assertEquals(props.estilo, "institucional");
  assertEquals(props.arranjo, 2);
  assertEquals(props.roteiro_cenas, cenas);
  assertEquals(props.hook, {
    kicker: "Marca do cliente",
    linhas: ["Sem tempo para cuidar do"],
    destaque: "marketing?",
    sub: "Você cuida do seu negócio.",
  });
  assertEquals(props.blocos, [{
    titulo: "Tudo pelo WhatsApp",
    apoio:
      "Com a AMZ Ofertas, seu marketing inteiro funciona pelo WhatsApp.",
    icone: "chat",
  }]);
  assertEquals(props.cta.frase, "AMZ Ofertas – seu marketing no WhatsApp");
  assertEquals(props.cta.sub, "AMZ Ofertas.");
  assertEquals(props.itens, undefined);
  assertEquals(props.legendas, cenas.map((cena) => cena.narracao));
  assertEquals(props.legendas_timeline?.at(-1), {
    texto:
      "AMZ Ofertas. Seu marketing com inteligência artificial, direto no WhatsApp. Peça sua demonstração.",
    inicio_segundos: 52,
    fim_segundos: 60,
  });
  assertEquals(props.duracao_alvo_segundos, 60);

  const renderedTexts = [
    props.hook.kicker,
    ...props.hook.linhas,
    props.hook.destaque,
    props.hook.sub,
    ...(props.blocos ?? []).flatMap((block) => [
      block.titulo,
      block.apoio,
    ]),
    props.cta.frase,
    props.cta.sub,
    ...props.legendas,
  ].filter((value): value is string => Boolean(value));
  for (
    const forbidden of [
      "Texto:",
      "Narração:",
      "Título:",
      "Cena ",
      "Passo ",
      '"',
      "“",
      "”",
    ]
  ) {
    assertEquals(
      renderedTexts.some((text) => text.includes(forbidden)),
      false,
    );
  }
  assertEquals(
    renderedTexts.join(" ").match(/marketing\?/gi)?.length,
    1,
  );
});

Deno.test("normalização não inventa blocos ou mensagens genéricas", () => {
  const props = normalizarProps({
    estilo: "institucional",
    hook: { linhas: ["Informação real"] },
    blocos: [{ titulo: "Único dado", apoio: "Ditado pelo dono" }],
    chat: { mensagens: [] },
  }, {
    marca: "Marca",
    estilo: "institucional",
    duracao: "longo",
    arranjo: 1,
  });
  assertEquals(props.blocos, [{
    titulo: "Único dado",
    apoio: "Ditado pelo dono",
    icone: undefined,
  }]);
  assertEquals(props.chat.mensagens, []);
});
