// ============================================================
// TEMPLATE "LISTA / PASSO A PASSO" — itens numerados entrando em
// sequência ("3 motivos", "como funciona em 4 passos").
// Usa a mesma base do institucional: fundo, gancho, legendas e CTA.
// 3 arranjos: numerada empilhada, cronologia lateral, um por tela.
// ============================================================

import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { font } from "../../font";
import { ehClaro, rgba, textoSobre } from "../agente/contraste";
import {
  Backdrop,
  CTA_FRAMES,
  CtaCena,
  HOOK_FRAMES,
  HookCena,
  Icone,
  Legendas,
  volumeTrilha,
  type Cta,
  type Hook,
  type Paleta,
} from "../base";

export type ItemLista = { titulo: string; apoio?: string; icone?: string };

export type TemplateListaProps = {
  marca: string;
  logoUrl?: string;
  site?: string;
  trilhaUrl?: string;
  trilha_volume?: number;
  cores: Paleta;
  hook: Hook;
  cta: Cta;
  legendas?: string[];
  itens: ItemLista[];
  /** rótulo da lista, ex.: "3 motivos", "4 passos" */
  rotulo?: string;
  arranjo?: number;
  /** frames por item; vídeo mais longo respira um pouco mais em cada cena */
  ritmo?: number;
};

const ITEM_FRAMES = 95;
const TRANSICAO = 30;

export const framesTemplateLista = (p: TemplateListaProps) => {
  const itens = Math.max(1, (p.itens || []).length);
  return HOOK_FRAMES + itens * ritmoLista(p) + CTA_FRAMES - TRANSICAO * 2;
};

export const ritmoLista = (p: TemplateListaProps) =>
  p.ritmo && p.ritmo >= 60 && p.ritmo <= 200 ? Math.round(p.ritmo) : ITEM_FRAMES;

const Numero: React.FC<{ c: Paleta; n: number; tamanho?: number }> = ({ c, n, tamanho = 84 }) => (
  <div
    style={{
      width: tamanho,
      height: tamanho,
      flexShrink: 0,
      borderRadius: tamanho / 3,
      background: `linear-gradient(135deg, ${c.destaque}, ${c.destaqueSoft})`,
      color: textoSobre(c.destaque),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: tamanho * 0.5,
      fontWeight: 800,
    }}
  >
    {n}
  </div>
);

/** Arranjo 1 — itens numerados empilhados, entrando um a um. */
const ListaEmpilhada: React.FC<{ c: Paleta; itens: ItemLista[]; rotulo?: string }> = ({ c, itens, rotulo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const compacto = itens.length > 3;
  return (
    <AbsoluteFill style={{ ...font, padding: "0 76px", justifyContent: "center", gap: compacto ? 22 : 30 }}>
      {rotulo ? (
        <div
          style={{
            color: c.destaque,
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            marginBottom: 6,
            opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {rotulo}
        </div>
      ) : null}
      {itens.map((item, i) => {
        const s = spring({ frame: frame - (8 + i * 24), fps, config: { damping: 20, stiffness: 130 } });
        return (
          <div
            key={`${i}-${item.titulo}`}
            style={{
              display: "flex",
              gap: 24,
              alignItems: "center",
              background: rgba(c.panel, ehClaro(c.bg) ? 0.92 : 0.66),
              border: `1px solid ${c.line}`,
              borderRadius: 28,
              padding: compacto ? "22px 26px" : "30px 32px",
              opacity: s,
              transform: `translateX(${interpolate(s, [0, 1], [-70, 0])}px)`,
            }}
          >
            <Numero c={c} n={i + 1} tamanho={compacto ? 68 : 84} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: c.texto,
                  fontSize: compacto ? 42 : 50,
                  fontWeight: 800,
                  letterSpacing: -1,
                  lineHeight: 1.1,
                }}
              >
                {item.titulo}
              </div>
              {item.apoio ? (
                <div style={{ marginTop: 10, color: c.suave, fontSize: compacto ? 28 : 32, lineHeight: 1.28 }}>
                  {item.apoio}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Arranjo 2 — cronologia com linha vertical ligando os passos. */
const ListaCronologia: React.FC<{ c: Paleta; itens: ItemLista[]; rotulo?: string }> = ({ c, itens, rotulo }) => {
  const frame = useCurrentFrame();
  const alturaLinha = interpolate(frame, [10, 20 + itens.length * 24], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ ...font, padding: "0 80px", justifyContent: "center" }}>
      {rotulo ? (
        <div style={{ color: c.destaque, fontSize: 30, letterSpacing: 6, textTransform: "uppercase", marginBottom: 34 }}>
          {rotulo}
        </div>
      ) : null}
      <div style={{ position: "relative", paddingLeft: 92 }}>
        <div
          style={{
            position: "absolute",
            left: 40,
            top: 10,
            width: 4,
            height: `${alturaLinha}%`,
            background: `linear-gradient(180deg, ${c.destaque}, ${c.destaqueSoft})`,
            borderRadius: 2,
          }}
        />
        {itens.map((item, i) => {
          const o = interpolate(frame, [12 + i * 24, 32 + i * 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={`${i}-${item.titulo}`}
              style={{ position: "relative", marginBottom: itens.length > 3 ? 34 : 48, opacity: o }}
            >
              <div style={{ position: "absolute", left: -72, top: 4 }}>
                <Numero c={c} n={i + 1} tamanho={62} />
              </div>
              <div
                style={{
                  color: c.texto,
                  fontSize: itens.length > 3 ? 46 : 54,
                  fontWeight: 800,
                  letterSpacing: -1,
                  lineHeight: 1.08,
                  transform: `translateX(${interpolate(o, [0, 1], [30, 0])}px)`,
                }}
              >
                {item.titulo}
              </div>
              {item.apoio ? (
                <div style={{ marginTop: 8, color: c.suave, fontSize: itens.length > 3 ? 28 : 32, lineHeight: 1.28 }}>
                  {item.apoio}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Arranjo 3 — um item por tela, número gigante ao fundo. */
const ItemTelaCheia: React.FC<{ c: Paleta; item: ItemLista; indice: number; total: number }> = ({
  c,
  item,
  indice,
  total,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const parallax = interpolate(frame, [0, ITEM_FRAMES], [20, -20]);
  return (
    <AbsoluteFill style={{ ...font, padding: "0 92px", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 420,
          fontSize: 520,
          fontWeight: 800,
          color: rgba(c.destaque, 0.14),
          lineHeight: 1,
          transform: `translateY(${parallax}px)`,
        }}
      >
        {indice + 1}
      </div>
      <div style={{ color: c.suave, fontSize: 28, letterSpacing: 6, opacity: s }}>
        PASSO {indice + 1} DE {total}
      </div>
      <div style={{ marginTop: 30, opacity: s }}>
        <Icone nome={item.icone} cor={c.destaque} tamanho={96} />
      </div>
      <div
        style={{
          marginTop: 30,
          color: c.texto,
          fontSize: item.titulo.length > 24 ? 76 : 90,
          fontWeight: 800,
          letterSpacing: -2.5,
          lineHeight: 1.05,
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
        }}
      >
        {item.titulo}
      </div>
      {item.apoio ? (
        <div
          style={{
            marginTop: 26,
            color: c.suave,
            fontSize: 38,
            lineHeight: 1.3,
            maxWidth: 840,
            opacity: interpolate(frame, [14, 34], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {item.apoio}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const timing = springTiming({ config: { damping: 200 }, durationInFrames: TRANSICAO });

export const TemplateLista: React.FC<TemplateListaProps> = (props) => {
  const { cores: c, marca, logoUrl, site, trilhaUrl, trilha_volume, hook, cta, legendas, rotulo } = props;
  const itens = (props.itens || []).filter((i) => i && i.titulo);
  const lista = itens.length ? itens : [{ titulo: "Primeiro passo", apoio: "Comece por aqui." }];
  const arranjo = props.arranjo === 2 || props.arranjo === 3 ? props.arranjo : 1;
  const total = framesTemplateLista({ ...props, itens: lista });

  return (
    <AbsoluteFill>
      <Backdrop c={c} arranjo={arranjo} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK_FRAMES}>
          <HookCena c={c} arranjo={arranjo === 3 ? 2 : 1} {...hook} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={arranjo === 3 ? fade() : slide({ direction: "from-bottom" })}
          timing={timing}
        />
        {arranjo === 3 ? (
          lista.map((item, i) => (
            <TransitionSeries.Sequence key={`item-${i}`} durationInFrames={ITEM_FRAMES}>
              <ItemTelaCheia c={c} item={item} indice={i} total={lista.length} />
            </TransitionSeries.Sequence>
          ))
        ) : (
          <TransitionSeries.Sequence durationInFrames={lista.length * ITEM_FRAMES}>
            {arranjo === 2 ? (
              <ListaCronologia c={c} itens={lista} rotulo={rotulo} />
            ) : (
              <ListaEmpilhada c={c} itens={lista} rotulo={rotulo} />
            )}
          </TransitionSeries.Sequence>
        )}
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={CTA_FRAMES}>
          <CtaCena c={c} marca={marca} logoUrl={logoUrl} site={site} {...cta} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {trilhaUrl ? (
        <Audio src={trilhaUrl} volume={volumeTrilha(total, trilha_volume ?? 0.28)} startFrom={0} endAt={total} />
      ) : null}

      <Legendas c={c} legendas={legendas} total={total} />
    </AbsoluteFill>
  );
};

export const PROPS_LISTA_EXEMPLO: TemplateListaProps = {
  marca: "SUA MARCA",
  cores: {
    bg: "#ffffff",
    bg2: "#f6f7f9",
    panel: "#ffffff",
    line: "#e2e6ea",
    destaque: "#c8102e",
    destaqueSoft: "#ed5368",
    texto: "#1b2026",
    suave: "#6b7480",
  },
  hook: { kicker: "Como funciona", linhas: ["Em 3 passos", "simples."], destaque: "Sem burocracia." },
  rotulo: "3 passos",
  itens: [
    { titulo: "Você descreve o tema", apoio: "Uma frase basta.", icone: "chat" },
    { titulo: "A plataforma escreve", apoio: "Texto no tom da sua marca.", icone: "engrenagem" },
    { titulo: "Publicação agendada", apoio: "No horário de maior alcance.", icone: "relogio" },
  ],
  cta: { frase: "Comece hoje.", sub: "Fale com o nosso time." },
  legendas: ["Em 3 passos simples.", "Você descreve o tema.", "A plataforma escreve.", "Publicação agendada."],
  arranjo: 1,
};
