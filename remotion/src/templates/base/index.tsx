// ============================================================
// BASE COMUM DA BIBLIOTECA DE TEMPLATES
// Fundo, tipografia, gancho, ícones, legendas e encerramento.
// Todos os estilos novos (institucional, lista, comparativo, dado)
// reaproveitam estes componentes — nada de fundo/CTA duplicado.
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
import { font } from "../../font";
import { ehClaro, fundoLegenda, rgba, textoSobre } from "../agente/contraste";

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

export type Cta = {
  frase: string;
  sub?: string;
  telefone?: string;
  consultor?: string;
};

export type Hook = {
  kicker: string;
  linhas: string[];
  destaque?: string;
  sub?: string;
};

// ---------- fundo (3 variantes de arranjo) ----------

export const Backdrop: React.FC<{ c: Paleta; arranjo?: number }> = ({ c, arranjo = 1 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  const claro = ehClaro(c.bg);

  return (
    <AbsoluteFill
      style={{
        background:
          arranjo === 2
            ? `linear-gradient(160deg, ${c.bg} 0%, ${c.bg2} 100%)`
            : `radial-gradient(1200px 900px at 20% 0%, ${c.bg2} 0%, ${c.bg} 60%, ${c.bg} 100%)`,
      }}
    >
      {arranjo === 3 ? (
        <AbsoluteFill
          style={{
            opacity: claro ? 0.5 : 0.3,
            backgroundImage: `repeating-linear-gradient(135deg, ${c.line} 0px, ${c.line} 2px, transparent 2px, transparent 26px)`,
            transform: `translateY(${(frame * 0.25) % 26}px)`,
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            opacity: claro ? 0.55 : 0.35,
            backgroundImage: `linear-gradient(${c.line} 1px, transparent 1px), linear-gradient(90deg, ${c.line} 1px, transparent 1px)`,
            backgroundSize: "72px 72px",
            transform: `translateY(${((frame * 0.35) % 72) - 72}px)`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          left: arranjo === 2 ? 420 + drift : -320 + drift,
          top: arranjo === 2 ? -260 : 980,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${rgba(c.destaque, claro ? 0.16 : 0.27)} 0%, transparent 65%)`,
          filter: "blur(30px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          right: -260 - drift,
          top: arranjo === 2 ? 1080 : -180,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${rgba(c.destaqueSoft, claro ? 0.12 : 0.14)} 0%, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---------- ícones SVG simples (traço na cor de destaque) ----------

export type NomeIcone =
  | "raio"
  | "escudo"
  | "grafico"
  | "relogio"
  | "chat"
  | "selo"
  | "check"
  | "engrenagem"
  | "alvo";

const TRACOS: Record<NomeIcone, React.ReactNode> = {
  raio: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  escudo: <path d="M12 3l7 3v6c0 5-3.2 8-7 9-3.8-1-7-4-7-9V6l7-3Z" />,
  grafico: <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />,
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
  selo: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 15l-2 7 5-3 5 3-2-7" />
    </>
  ),
  check: <path d="M4 13l5 5L20 6" />,
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2.2 2.2M16.8 16.8 19 19M19 5l-2.2 2.2M7.2 16.8 5 19" />
    </>
  ),
  alvo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
};

export const Icone: React.FC<{ nome?: string; cor: string; tamanho?: number }> = ({
  nome,
  cor,
  tamanho = 56,
}) => {
  const escolhido = (nome && (nome as NomeIcone) in TRACOS ? (nome as NomeIcone) : "check") as NomeIcone;
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRACOS[escolhido]}
    </svg>
  );
};

// ---------- gancho de abertura ----------

export const HOOK_FRAMES = 170;

export const HookCena: React.FC<{ c: Paleta; arranjo?: number } & Hook> = ({
  c,
  arranjo = 1,
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
  const centralizado = arranjo === 2;

  return (
    <AbsoluteFill
      style={{
        ...font,
        padding: "0 92px",
        justifyContent: "center",
        alignItems: centralizado ? "center" : "flex-start",
        textAlign: centralizado ? "center" : "left",
      }}
    >
      <div
        style={{
          color: c.suave,
          fontSize: 30,
          letterSpacing: 8,
          textTransform: "uppercase",
          opacity: k,
          transform: `translateX(${interpolate(k, [0, 1], [centralizado ? 0 : -40, 0])}px)`,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          marginTop: 26,
          color: c.texto,
          fontSize: linhas.some((l) => l.length > 14) ? 92 : 112,
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
            maxWidth: 860,
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

// ---------- encerramento (logo + CTA + contato) ----------

export const CTA_FRAMES = 170;

export const CtaCena: React.FC<
  { c: Paleta; marca: string; logoUrl?: string; site?: string } & Cta
> = ({ c, marca, logoUrl, site, frase, sub, telefone, consultor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const texto = interpolate(frame, [18, 44], [0, 1], { extrapolateRight: "clamp" });
  const linha = interpolate(frame, [38, 74], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const float = Math.sin(frame / 20) * 5;

  const palavras = marca.split(/\s+/).filter(Boolean);
  const nomeLongo = marca.length > 10;
  const dentroDoBloco = nomeLongo ? palavras.map((p) => p[0]).join("").toUpperCase().slice(0, 4) : marca;
  const tamanhoBloco = dentroDoBloco.length <= 3 ? 78 : dentroDoBloco.length === 4 ? 62 : 46;
  const tamanhoFrase = frase.length > 46 ? 44 : frase.length > 34 ? 52 : 62;

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
          fontSize: tamanhoBloco,
          fontWeight: 800,
          lineHeight: 1.05,
          textAlign: "center",
          padding: 14,
          whiteSpace: "nowrap",
          transform: `scale(${logo}) translateY(${float}px)`,
          boxShadow: `0 40px 90px ${rgba(c.destaque, ehClaro(c.bg) ? 0.18 : 0.32)}`,
        }}
      >
        {logoUrl ? <Img src={logoUrl} style={{ width: 164, height: 164, objectFit: "contain" }} /> : dentroDoBloco}
      </div>
      {!logoUrl && nomeLongo ? (
        <div
          style={{
            marginTop: 22,
            color: c.texto,
            fontSize: 38,
            fontWeight: 700,
            textAlign: "center",
            maxWidth: 900,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: texto,
          }}
        >
          {marca}
        </div>
      ) : null}
      <div
        style={{
          marginTop: 54,
          padding: "0 80px",
          color: c.texto,
          fontSize: tamanhoFrase,
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
      <div style={{ height: 6, width: 300 * linha, background: c.destaque, borderRadius: 4, marginTop: 32 }} />
      {sub ? (
        <div style={{ marginTop: 28, color: c.suave, fontSize: 36, opacity: linha, textAlign: "center", padding: "0 80px" }}>
          {sub}
        </div>
      ) : null}
      {consultor ? (
        <div style={{ marginTop: 22, color: c.texto, fontSize: 30, fontWeight: 700, opacity: linha }}>{consultor}</div>
      ) : null}
      {telefone ? (
        <div style={{ marginTop: 12, color: c.suave, fontSize: 30, opacity: linha }}>{telefone}</div>
      ) : null}
      {site ? (
        <div style={{ marginTop: 18, color: c.destaque, fontSize: 36, fontWeight: 700, opacity: linha }}>{site}</div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------- legendas queimadas ----------

export const LinhaLegenda: React.FC<{ c: Paleta; text: string }> = ({ c, text }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const fundo = fundoLegenda(c.bg, c.panel);
  return (
    <AbsoluteFill style={{ ...font, justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 150,
          maxWidth: 900,
          textAlign: "center",
          background: rgba(fundo, 0.92),
          border: `1px solid ${c.line}`,
          borderRadius: 20,
          padding: "20px 30px",
          color: textoSobre(fundo),
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

/** Distribui as legendas ao longo do vídeo — mesma regra em todos os estilos. */
export const Legendas: React.FC<{ c: Paleta; legendas?: string[]; total: number }> = ({
  c,
  legendas,
  total,
}) => {
  const validas = (legendas || []).filter((l) => l && l.trim().length > 0);
  if (!validas.length) return null;
  const passo = Math.floor((total - 20) / validas.length);
  return (
    <>
      {validas.map((text, i) => (
        <Sequence key={`${i}-${text}`} from={10 + i * passo} durationInFrames={Math.max(40, passo - 8)}>
          <LinhaLegenda c={c} text={text} />
        </Sequence>
      ))}
    </>
  );
};

/** Volume com fade in/out — igual para todos os templates. */
export const volumeTrilha = (total: number, base = 0.28) => (frame: number) => {
  const v = Math.min(1, Math.max(0, base));
  const entrada = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const saida = interpolate(frame, [Math.max(0, total - 45), total], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return v * entrada * saida;
};
