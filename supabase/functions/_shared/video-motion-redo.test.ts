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
  const script = Array.from({ length: 8 }, (_, index) => {
    const start = index * 7;
    const end = index === 7 ? 60 : (index + 1) * 7;
    return `Cena ${index + 1} (${start}-${end}s): Narração literal ${index + 1}. Texto literal ${index + 1}.`;
  }).join("\n");
  const cenas = cenasPedidasNoTexto(script);
  assertEquals(cenas.length, 8);
  const props = aplicarCenasLiterais(base, cenas);
  assertEquals(props.estilo, "lista");
  assertEquals(props.arranjo, 3);
  assertEquals(props.roteiro_cenas, cenas);
  assertEquals(props.itens?.map((item) => item.apoio), cenas.map((cena) => cena.texto));
  assertEquals(props.duracao_alvo_segundos, 60);
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
