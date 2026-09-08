// ============================================================
// TEMPLATE "INSTITUCIONAL" — sem mockup de celular.
// Tipografia grande, blocos de argumento com ícone SVG e um bloco
// de destaque para dado/selo. Reaproveita a base comum (fundo,
// gancho, legendas, encerramento).
// 3 arranjos de cena para o mesmo estilo não repetir visual.
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

export type BlocoArgumento = { titulo: string; apoio?: string; icone?: string };

export type TemplateInstitucionalProps = {
  marca: string;
  logoUrl?: string;
  site?: string;
  trilhaUrl?: string;
  trilha_volume?: number;
  cores: Paleta;
  hook: Hook;
  cta: Cta;
  legendas?: string[];
  blocos: BlocoArgumento[];
  selo?: { valor: string; rotulo?: string };
  /** 1, 2 ou 3 — arranjo de cena */
  arranjo?: number;
  /** frames por bloco; vídeo mais longo respira um pouco mais em cada cena */
  ritmo?: number;
};

const BLOCO_FRAMES = 100;
const SELO_FRAMES = 120;
const TRANSICAO = 30;

export const ritmoInstitucional = (p: TemplateInstitucionalProps) =>
  p.ritmo && p.ritmo >= 60 && p.ritmo <= 220 ? Math.round(p.ritmo) : BLOCO_FRAMES;

export const framesTemplateInstitucional = (p: TemplateInstitucionalProps) => {
  const blocos = Math.max(1, (p.blocos || []).length);
  const selo = p.selo?.valor ? SELO_FRAMES : 0;
  const transicoes = selo ? 3 : 2;
  return HOOK_FRAMES + blocos * ritmoInstitucional(p) + selo + CTA_FRAMES - TRANSICAO * transicoes;
};

// ---------- cena de blocos ----------

const Cartao: React.FC<{ c: Paleta; b: BlocoArgumento; from: number; compacto?: boolean }> = ({
  c,
  b,
  from,
  compacto,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - from, fps, config: { damping: 20, stiffness: 130 } });
  return (
    <div
      style={{
        display: "flex",
        gap: 26,
        alignItems: "flex-start",
        background: rgba(c.panel, ehClaro(c.bg) ? 0.92 : 0.7),
        border: `1px solid ${c.line}`,
        borderRadius: 30,
        padding: compacto ? "26px 28px" : "34px 36px",
        opacity: s,
        transform: `translateX(${interpolate(s, [0, 1], [70, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 84,
          height: 84,
          flexShrink: 0,
          borderRadius: 24,
          background: rgba(c.destaque, 0.14),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icone nome={b.icone} cor={c.destaque} tamanho={46} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: c.texto,
            fontSize: compacto ? 44 : 52,
            fontWeight: 800,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          {b.titulo}
        </div>
        {b.apoio ? (
          <div style={{ marginTop: 12, color: c.suave, fontSize: compacto ? 30 : 34, lineHeight: 1.28 }}>
            {b.apoio}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Arranjo 1 — cartões empilhados entrando um a um. */
const BlocosEmpilhados: React.FC<{ c: Paleta; blocos: BlocoArgumento[] }> = ({ c, blocos }) => (
  <AbsoluteFill style={{ ...font, padding: "0 76px", justifyContent: "center", gap: 26 }}>
    {blocos.map((b, i) => (
      <Cartao key={`${i}-${b.titulo}`} c={c} b={b} from={10 + i * 22} compacto={blocos.length > 3} />
    ))}
  </AbsoluteFill>
);

/** Arranjo 2 — um bloco por vez, ocupando a tela. */
const BlocoTelaCheia: React.FC<{ c: Paleta; b: BlocoArgumento; indice: number; total: number }> = ({
  c,
  b,
  indice,
  total,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const parallax = interpolate(frame, [0, BLOCO_FRAMES], [24, -24]);
  return (
    <AbsoluteFill style={{ ...font, padding: "0 92px", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ color: c.suave, fontSize: 28, letterSpacing: 6, opacity: s }}>
        {String(indice + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
      <div style={{ marginTop: 34, opacity: s, transform: `translateY(${parallax * 0.4}px)` }}>
        <Icone nome={b.icone} cor={c.destaque} tamanho={110} />
      </div>
      <div
        style={{
          marginTop: 34,
          color: c.texto,
          fontSize: b.titulo.length > 24 ? 76 : 92,
          fontWeight: 800,
          letterSpacing: -2.5,
          lineHeight: 1.05,
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [50, 0]) + parallax * 0.2}px)`,
        }}
      >
        {b.titulo}
      </div>
      {b.apoio ? (
        <div
          style={{
            marginTop: 28,
            color: c.suave,
            fontSize: 38,
            lineHeight: 1.3,
            maxWidth: 860,
            opacity: interpolate(frame, [14, 34], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {b.apoio}
        </div>
      ) : null}
      <div
        style={{
          marginTop: 44,
          height: 8,
          width: interpolate(frame, [8, BLOCO_FRAMES], [0, 360], { extrapolateRight: "clamp" }),
          borderRadius: 6,
          background: `linear-gradient(90deg, ${c.destaque}, ${c.destaqueSoft})`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Arranjo 3 — grade revelando um bloco por vez. */
const BlocosGrade: React.FC<{ c: Paleta; blocos: BlocoArgumento[] }> = ({ c, blocos }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ ...font, padding: "0 68px", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
        {blocos.map((b, i) => {
          const o = interpolate(frame, [8 + i * 20, 30 + i * 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={`${i}-${b.titulo}`}
              style={{
                width: blocos.length <= 2 ? "100%" : "calc(50% - 12px)",
                background: rgba(c.panel, ehClaro(c.bg) ? 0.94 : 0.72),
                border: `1px solid ${c.line}`,
                borderRadius: 32,
                padding: "34px 30px",
                opacity: o,
                transform: `scale(${interpolate(o, [0, 1], [0.92, 1])})`,
              }}
            >
              <Icone nome={b.icone} cor={c.destaque} tamanho={56} />
              <div
                style={{
                  marginTop: 20,
                  color: c.texto,
                  fontSize: b.titulo.length > 20 ? 40 : 46,
                  fontWeight: 800,
                  letterSpacing: -1,
                  lineHeight: 1.1,
                }}
              >
                {b.titulo}
              </div>
              {b.apoio ? (
                <div style={{ marginTop: 12, color: c.suave, fontSize: 28, lineHeight: 1.3 }}>{b.apoio}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- selo / dado em destaque ----------

const Selo: React.FC<{ c: Paleta; valor: string; rotulo?: string }> = ({ c, valor, rotulo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${c.destaque}, ${c.destaqueSoft})`,
          color: textoSobre(c.destaque),
          borderRadius: 40,
          padding: "44px 54px",
          textAlign: "center",
          transform: `scale(${interpolate(s, [0, 1], [0.86, 1])})`,
          boxShadow: `0 40px 90px ${rgba(c.destaque, ehClaro(c.bg) ? 0.2 : 0.35)}`,
        }}
      >
        <div style={{ fontSize: valor.length > 14 ? 72 : 108, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>
          {valor}
        </div>
        {rotulo ? <div style={{ marginTop: 16, fontSize: 34, fontWeight: 600, opacity: 0.9 }}>{rotulo}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

// ---------- composição ----------

const timing = springTiming({ config: { damping: 200 }, durationInFrames: TRANSICAO });

export const TemplateInstitucional: React.FC<TemplateInstitucionalProps> = (props) => {
  const { cores: c, marca, logoUrl, site, trilhaUrl, trilha_volume, hook, cta, legendas, selo } = props;
  const blocos = (props.blocos || []).filter((b) => b && b.titulo);
  const arranjo = props.arranjo === 2 || props.arranjo === 3 ? props.arranjo : 1;
  const lista = blocos.length ? blocos : [{ titulo: "Tecnologia própria", apoio: "Feito para o seu negócio." }];
  const total = framesTemplateInstitucional({ ...props, blocos: lista });
  const duracaoBlocos = lista.length * BLOCO_FRAMES;

  return (
    <AbsoluteFill>
      <Backdrop c={c} arranjo={arranjo} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK_FRAMES}>
          <HookCena c={c} arranjo={arranjo} {...hook} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={arranjo === 2 ? fade() : slide({ direction: "from-bottom" })}
          timing={timing}
        />
        {arranjo === 2 ? (
          lista.map((b, i) => (
            <TransitionSeries.Sequence key={`bloco-${i}`} durationInFrames={BLOCO_FRAMES + (i === 0 ? 0 : 0)}>
              <BlocoTelaCheia c={c} b={b} indice={i} total={lista.length} />
            </TransitionSeries.Sequence>
          ))
        ) : (
          <TransitionSeries.Sequence durationInFrames={duracaoBlocos}>
            {arranjo === 3 ? <BlocosGrade c={c} blocos={lista} /> : <BlocosEmpilhados c={c} blocos={lista} />}
          </TransitionSeries.Sequence>
        )}
        {selo?.valor ? (
          <>
            <TransitionSeries.Transition presentation={fade()} timing={timing} />
            <TransitionSeries.Sequence durationInFrames={SELO_FRAMES}>
              <Selo c={c} valor={selo.valor} rotulo={selo.rotulo} />
            </TransitionSeries.Sequence>
          </>
        ) : null}
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

export const PROPS_INSTITUCIONAL_EXEMPLO: TemplateInstitucionalProps = {
  marca: "SUA MARCA",
  cores: {
    bg: "#0f1720",
    bg2: "#1a2332",
    panel: "#16202c",
    line: "#26313f",
    destaque: "#FF7A1A",
    destaqueSoft: "#ff9e56",
    texto: "#f4f7fb",
    suave: "#93a4b8",
  },
  hook: {
    kicker: "Tecnologia",
    linhas: ["Segurança", "de verdade."],
    destaque: "Sem improviso.",
    sub: "Infraestrutura própria e integração oficial.",
  },
  blocos: [
    { titulo: "Integração oficial", apoio: "Conexão homologada, sem atalhos.", icone: "escudo" },
    { titulo: "Dados isolados", apoio: "Cada empresa no seu próprio ambiente.", icone: "engrenagem" },
    { titulo: "Resposta em segundos", apoio: "Atendimento no horário do cliente.", icone: "relogio" },
  ],
  selo: { valor: "Tech Provider", rotulo: "verificado pela Meta" },
  cta: { frase: "Conheça a plataforma.", sub: "Fale com o nosso time." },
  legendas: ["Segurança de verdade.", "Integração oficial.", "Cada empresa isolada.", "Resposta em segundos."],
  arranjo: 1,
};
