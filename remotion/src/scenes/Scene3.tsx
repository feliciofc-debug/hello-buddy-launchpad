import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";

const canais = [
  { nome: "Instagram", detalhe: "Reels • Stories • Feed" },
  { nome: "Facebook", detalhe: "Página • Vídeo" },
  { nome: "LinkedIn", detalhe: "Post institucional" },
  { nome: "WhatsApp", detalhe: "Atendimento por IA" },
];

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titulo = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ ...font, padding: "0 84px", justifyContent: "center" }}>
      <div
        style={{
          color: C.text,
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: -2,
          opacity: titulo,
          transform: `translateY(${interpolate(titulo, [0, 1], [40, 0])}px)`,
          marginBottom: 56,
        }}
      >
        Um conteúdo.
        <br />
        <span style={{ color: C.orange }}>Todos os canais.</span>
      </div>

      {canais.map((c, i) => {
        const s = spring({ frame: frame - 16 - i * 22, fps, config: { damping: 16, stiffness: 140 } });
        const pulso = 1 + Math.sin((frame - i * 8) / 16) * 0.012;
        return (
          <div
            key={c.nome}
            style={{
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [70, 0])}px) scale(${pulso})`,
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderLeft: `8px solid ${C.orange}`,
              borderRadius: 22,
              padding: "34px 34px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontSize: 42, fontWeight: 700 }}>{c.nome}</div>
              <div style={{ color: C.muted, fontSize: 28, marginTop: 6 }}>{c.detalhe}</div>
            </div>
            <div
              style={{
                color: C.green,
                fontSize: 30,
                fontWeight: 700,
                opacity: interpolate(s, [0.6, 1], [0, 1], { extrapolateLeft: "clamp" }),
              }}
            >
              publicado
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
