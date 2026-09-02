// ============================================================
// TEMPLATE PARAMÉTRICO — "Agente no WhatsApp"
// Mesma linguagem visual dos vídeos da campanha AMZ, mas com
// TODO o texto, a marca e as cores vindo de props (multi-tenant).
// Renderizado na VPS pelo worker (bunx remotion render).
// ============================================================

import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { font } from "../../font";
import { ehClaro, rgba, textoSobre } from "./contraste";

// ---------- contrato de props ----------

export type Mensagem = { de: "dono" | "agente"; texto: string };

export type Paleta = {
  bg: string;
  bg2: string;
  panel: string;
  line: string;
  destaque: string;
  destaqueSoft: string;
  texto: string;
  suave: string;
};

export type TemplateAgenteProps = {
  marca: string; // sigla exibida no logo/CTA quando NÃO há logoUrl (ex.: iniciais da marca)
  logoUrl?: string; // logo do cliente (URL assinada ou data URL) — quando existe, substitui a sigla
  site?: string; // opcional — site DO CLIENTE, nunca fallback de outra marca
  cores: Paleta;
  hook: { kicker: string; linhas: string[]; destaque?: string; sub?: string };
  chat: { titulo: string; tituloDestaque?: string; mensagens: Mensagem[] };
  cta: { frase: string; sub?: string; telefone?: string; consultor?: string };
  legendas: string[];
};


export const PALETA_AMZ: Paleta = {
  bg: "#0f1720",
  bg2: "#1a2332",
  panel: "#16202c",
  line: "#26313f",
  destaque: "#FF7A1A",
  destaqueSoft: "#ff9e56",
  texto: "#f4f7fb",
  suave: "#93a4b8",
};

// ---------- matemática de duração ----------

const HOOK_FRAMES = 190;
const CTA_FRAMES = 170;
const TRANSICAO = 30;
const MSG_ESPACO = 52;
const CHAT_ENTRADA = 40;
const CHAT_RESPIRO = 70;

export const framesChat = (n: number) =>
  CHAT_ENTRADA + Math.max(1, n) * MSG_ESPACO + CHAT_RESPIRO;

/** Duração total já descontando a sobreposição das 2 transições. */
export const framesTemplateAgente = (props: TemplateAgenteProps) =>
  HOOK_FRAMES + framesChat(props.chat.mensagens.length) + CTA_FRAMES - TRANSICAO * 2;

// ---------- cenas ----------

const Backdrop: React.FC<{ c: Paleta }> = ({ c }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 900px at 20% 0%, ${c.bg2} 0%, ${c.bg} 60%, ${c.bg} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.35,
          backgroundImage: `linear-gradient(${c.line} 1px, transparent 1px), linear-gradient(90deg, ${c.line} 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          transform: `translateY(${((frame * 0.35) % 72) - 72}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          left: -320 + drift,
          top: 980,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${c.destaque}44 0%, transparent 65%)`,
          filter: "blur(30px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          right: -260 - drift,
          top: -180,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${c.destaqueSoft}22 0%, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Hook: React.FC<{ c: Paleta } & TemplateAgenteProps["hook"]> = ({
  c,
  kicker,
  linhas,
  destaque,
  sub,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame, fps, config: { damping: 200 } });
  const t = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const barra = spring({ frame: frame - 34, fps, config: { damping: 18, stiffness: 120 } });
  const s = interpolate(frame, [48, 76], [0, 1], { extrapolateRight: "clamp" });
  const float = Math.sin(frame / 22) * 6;

  return (
    <AbsoluteFill style={{ ...font, padding: "0 92px", justifyContent: "center" }}>
      <div
        style={{
          color: c.suave,
          fontSize: 30,
          letterSpacing: 8,
          textTransform: "uppercase",
          opacity: k,
          transform: `translateX(${interpolate(k, [0, 1], [-40, 0])}px)`,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          marginTop: 26,
          color: c.texto,
          fontSize: linhas.some((l) => l.length > 14) ? 92 : 116,
          fontWeight: 800,
          lineHeight: 1.03,
          letterSpacing: -3,
          opacity: t,
          transform: `translateY(${interpolate(t, [0, 1], [70, float])}px)`,
        }}
      >
        {linhas.map((l, i) => (
          <div key={`${i}-${l}`}>{l}</div>
        ))}
        {destaque ? <div style={{ color: c.destaque }}>{destaque}</div> : null}
      </div>
      <div
        style={{
          height: 12,
          width: 420 * barra,
          background: `linear-gradient(90deg, ${c.destaque}, ${c.destaqueSoft})`,
          borderRadius: 8,
          marginTop: 42,
        }}
      />
      {sub ? (
        <div
          style={{
            marginTop: 38,
            color: c.suave,
            fontSize: 38,
            lineHeight: 1.3,
            whiteSpace: "pre-line",
            opacity: s,
            transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)`,
          }}
        >
          {sub}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Bolha: React.FC<{ c: Paleta; m: Mensagem; from: number }> = ({ c, m, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - from, fps, config: { damping: 18, stiffness: 150 } });
  const dono = m.de === "dono";
  return (
    <div
      style={{
        alignSelf: dono ? "flex-end" : "flex-start",
        maxWidth: "84%",
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
        background: dono ? `linear-gradient(135deg, ${c.destaque}, ${c.destaqueSoft})` : c.bg2,
        color: dono ? textoSobre(c.destaque) : c.texto,
        border: dono ? "none" : `1px solid ${c.line}`,

        borderRadius: 22,
        borderBottomRightRadius: dono ? 6 : 22,
        borderBottomLeftRadius: dono ? 22 : 6,
        padding: "22px 24px",
        fontSize: 30,
        lineHeight: 1.3,
        fontWeight: dono ? 700 : 400,
      }}
    >
      {m.texto}
    </div>
  );
};

const Chat: React.FC<{ c: Paleta; marca: string; logoUrl?: string } & TemplateAgenteProps["chat"]> = ({
  c,
  marca,
  logoUrl,
  titulo,
  tituloDestaque,
  mensagens,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const tituloOp = interpolate(frame, [6, 26], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 116,
          left: 84,
          right: 84,
          color: c.texto,
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: -1,
          lineHeight: 1.08,
          opacity: tituloOp,
          transform: `translateY(${interpolate(tituloOp, [0, 1], [30, 0])}px)`,
        }}
      >
        {titulo}{" "}
        {tituloDestaque ? <span style={{ color: c.destaque }}>{tituloDestaque}</span> : null}
      </div>

      <div
        style={{
          width: 640,
          height: 1120,
          borderRadius: 56,
          background: c.panel,
          border: `2px solid ${c.line}`,
          boxShadow: ehClaro(c.bg)
            ? `0 40px 90px ${rgba("#0b1220", 0.16)}`
            : `0 60px 120px ${rgba("#000000", 0.55)}`,

          overflow: "hidden",
          position: "relative",
          transform: `translateY(${interpolate(entrada, [0, 1], [220, 110])}px) scale(${interpolate(
            entrada,
            [0, 1],
            [0.92, 1],
          )})`,
        }}
      >
        <div
          style={{
            height: 78,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 28px",
            borderBottom: `1px solid ${c.line}`,
            background: c.bg2,
          }}
        >
          {logoUrl ? (
            <Img
              src={logoUrl}
              style={{ height: 40, maxWidth: 190, objectFit: "contain" }}
            />
          ) : (
            <>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: c.destaque }} />
              <span style={{ color: c.texto, fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>
                {marca}
              </span>
            </>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 26, height: 4, borderRadius: 2, background: c.suave }} />
            ))}
          </div>
        </div>
        <div style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18 }}>
          {mensagens.map((m, i) => (
            <Bolha key={`${i}-${m.texto}`} c={c} m={m} from={CHAT_ENTRADA / 2 + i * MSG_ESPACO} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CTA: React.FC<
  { c: Paleta; marca: string; logoUrl?: string; site?: string } & TemplateAgenteProps["cta"]
> = ({
  c,
  marca,
  logoUrl,
  site,
  frase,
  sub,
  telefone,
  consultor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const texto = interpolate(frame, [18, 44], [0, 1], { extrapolateRight: "clamp" });
  const linha = interpolate(frame, [38, 74], [0, 1], { extrapolateRight: "clamp" });
  const float = Math.sin(frame / 20) * 5;

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: 52,
          background: logoUrl ? c.bg2 : `linear-gradient(135deg, ${c.destaque}, ${c.destaqueSoft})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: logoUrl ? c.texto : textoSobre(c.destaque),
          fontSize:
            marca.length <= 3 ? 78 : marca.length === 4 ? 62 : marca.length === 5 ? 50 : marca.length <= 8 ? 34 : 26,
          fontWeight: 800,
          letterSpacing: marca.length > 5 ? 0 : -2,
          lineHeight: 1.05,
          textAlign: "center",
          padding: 14,
          overflowWrap: "anywhere",
          transform: `scale(${logo}) translateY(${float}px)`,
          boxShadow: `0 40px 90px ${rgba(c.destaque, ehClaro(c.bg) ? 0.18 : 0.32)}`,
        }}
      >
        {logoUrl ? (
          <Img src={logoUrl} style={{ width: 164, height: 164, objectFit: "contain" }} />
        ) : (
          marca
        )}
      </div>
      <div
        style={{
          marginTop: 54,
          padding: "0 80px",
          color: c.texto,
          fontSize: 62,
          fontWeight: 800,
          textAlign: "center",
          letterSpacing: -1.5,
          lineHeight: 1.1,
          opacity: texto,
          transform: `translateY(${interpolate(texto, [0, 1], [30, 0])}px)`,
        }}
      >
        {frase}
      </div>
      <div
        style={{ height: 6, width: 300 * linha, background: c.destaque, borderRadius: 4, marginTop: 32 }}
      />
      {sub ? (
        <div style={{ marginTop: 28, color: c.suave, fontSize: 36, opacity: linha, textAlign: "center" }}>
          {sub}
        </div>
      ) : null}
      {consultor ? (
        <div style={{ marginTop: 22, color: c.texto, fontSize: 30, fontWeight: 700, opacity: linha, textAlign: "center" }}>
          {consultor}
        </div>
      ) : null}
      {telefone ? (
        <div style={{ marginTop: 12, color: c.suave, fontSize: 30, opacity: linha, textAlign: "center" }}>
          {telefone}
        </div>
      ) : null}
      {site ? (
        <div style={{ marginTop: 18, color: c.destaque, fontSize: 36, fontWeight: 700, opacity: linha, textAlign: "center" }}>
          {site}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const LinhaLegenda: React.FC<{ c: Paleta; text: string }> = ({ c, text }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...font, justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 150,
          maxWidth: 900,
          textAlign: "center",
          background: rgba(c.panel, 0.9),
          border: `1px solid ${c.line}`,
          borderRadius: 20,
          padding: "20px 30px",
          color: c.texto,
          fontSize: 40,
          fontWeight: 600,
          lineHeight: 1.25,
          opacity: o,
          transform: `translateY(${interpolate(o, [0, 1], [16, 0])}px)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// ---------- composição ----------

const timing = springTiming({ config: { damping: 200 }, durationInFrames: TRANSICAO });

export const TemplateAgente: React.FC<TemplateAgenteProps> = (props) => {
  const { cores: c, marca, logoUrl, site, hook, chat, cta, legendas } = props;
  const total = framesTemplateAgente(props);
  const legendasValidas = (legendas || []).filter((l) => l && l.trim().length > 0);
  const passo = legendasValidas.length > 0 ? Math.floor((total - 20) / legendasValidas.length) : 0;

  return (
    <AbsoluteFill>
      <Backdrop c={c} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK_FRAMES}>
          <Hook c={c} {...hook} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={framesChat(chat.mensagens.length)}>
          <Chat c={c} marca={marca} logoUrl={logoUrl} {...chat} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={CTA_FRAMES}>
          <CTA c={c} marca={marca} logoUrl={logoUrl} site={site} {...cta} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {legendasValidas.map((text, i) => (
        <Sequence
          key={`${i}-${text}`}
          from={10 + i * passo}
          durationInFrames={Math.max(40, passo - 8)}
        >
          <LinhaLegenda c={c} text={text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const PROPS_EXEMPLO: TemplateAgenteProps = {
  marca: "AMZ",
  site: "amzofertas.com.br",
  cores: PALETA_AMZ,
  hook: {
    kicker: "Agente no WhatsApp",
    linhas: ["Postou pelo", "WhatsApp."],
    destaque: "Sério.",
    sub: "Um agente que sabe tudo\ndo seu negócio, na sua mão.",
  },
  chat: {
    titulo: "Marketing pelo",
    tituloDestaque: "WhatsApp",
    mensagens: [
      { de: "dono", texto: "posta essa foto no reels e no story hoje 19h" },
      { de: "agente", texto: "Fechado. Escrevi a legenda com o tom da sua loja e agendei para 19:00." },
      { de: "dono", texto: "quanto de estoque tem do modelo novo?" },
      { de: "agente", texto: "12 unidades. Já preparei um post de urgência para amanhã." },
      { de: "dono", texto: "manda por áudio que eu tô dirigindo" },
      { de: "agente", texto: "Recebi seu áudio, transcrevi e transformei em post. Quer publicar?" },
    ],
  },
  cta: { frase: "Sua plataforma no chat.", sub: "Foto, áudio ou texto. Ele publica." },
  legendas: [
    "Postou pelo WhatsApp. Sério.",
    "Manda a foto e diz o que quer.",
    "Ele escreve a legenda e agenda.",
    "Sabe seu estoque, preço e tom de voz.",
    "Mandou áudio? Ele transforma em post.",
  ],
};
