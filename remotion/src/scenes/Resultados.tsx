import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";

const barras = [0.22, 0.34, 0.3, 0.48, 0.56, 0.62, 0.78, 0.86, 1];
const leads = [
  { nome: "Novo lead • 21h42", from: 130 },
  { nome: "Novo lead • 22h15", from: 172 },
  { nome: "Novo lead • 23h04", from: 214 },
];

export const Resultados: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titulo = spring({ frame, fps, config: { damping: 200 } });
  const numero = Math.round(interpolate(frame, [30, 150], [0, 90], { extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill style={{ ...font, padding: "0 84px", justifyContent: "center" }}>
      <div
        style={{
          color: C.text,
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: -2,
          lineHeight: 1.05,
          opacity: titulo,
          transform: `translateY(${interpolate(titulo, [0, 1], [40, 0])}px)`,
        }}
      >
        30 dias no
        <br />
        <span style={{ color: C.orange }}>piloto automático.</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 34 }}>
        <div style={{ color: C.orange, fontSize: 150, fontWeight: 800, letterSpacing: -6 }}>
          {numero}
        </div>
        <div style={{ color: C.muted, fontSize: 38 }}>posts publicados</div>
      </div>

      <div
        style={{
          marginTop: 40,
          height: 420,
          display: "flex",
          alignItems: "flex-end",
          gap: 16,
          background: C.panel,
          border: `1px solid ${C.line}`,
          borderRadius: 26,
          padding: 28,
        }}
      >
        {barras.map((b, i) => {
          const s = spring({ frame: frame - 30 - i * 9, fps, config: { damping: 18, stiffness: 120 } });
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${b * 100 * s}%`,
                borderRadius: 12,
                background: `linear-gradient(180deg, ${C.orangeSoft}, ${C.orange})`,
                opacity: 0.55 + b * 0.45,
              }}
            />
          );
        })}
      </div>

      <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 16 }}>
        {leads.map((l) => {
          const s = spring({ frame: frame - l.from, fps, config: { damping: 15, stiffness: 160 } });
          return (
            <div
              key={l.nome}
              style={{
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [80, 0])}px)`,
                background: C.bg2,
                border: `1px solid ${C.line}`,
                borderLeft: `8px solid ${C.green}`,
                borderRadius: 20,
                padding: "24px 26px",
                color: C.text,
                fontSize: 32,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: 7, background: C.green }} />
              {l.nome}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
