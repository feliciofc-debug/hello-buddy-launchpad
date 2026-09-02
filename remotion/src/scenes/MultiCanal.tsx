import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";

const destinos = [
  { nome: "Instagram", detalhe: "Reels • Stories • Feed" },
  { nome: "Facebook", detalhe: "Página • Vídeo" },
  { nome: "LinkedIn", detalhe: "Post institucional" },
  { nome: "WhatsApp", detalhe: "Catálogo para o cliente" },
];

export const MultiCanal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titulo = spring({ frame, fps, config: { damping: 200 } });
  const cardOrigem = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 120 } });
  const subir = interpolate(frame, [58, 88], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...font, padding: "0 84px", justifyContent: "center" }}>
      <div
        style={{
          color: C.text,
          fontSize: 66,
          fontWeight: 800,
          letterSpacing: -2,
          lineHeight: 1.05,
          opacity: titulo,
          transform: `translateY(${interpolate(titulo, [0, 1], [40, 0])}px)`,
          marginBottom: 40,
        }}
      >
        Um conteúdo.
        <br />
        <span style={{ color: C.orange }}>Todos os canais.</span>
      </div>

      <div
        style={{
          alignSelf: "center",
          width: 420,
          height: 240,
          borderRadius: 26,
          background: `linear-gradient(140deg, #2c3a4d, #1a2332)`,
          border: `2px solid ${C.orange}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.text,
          fontSize: 34,
          fontWeight: 700,
          opacity: cardOrigem,
          transform: `translateY(${interpolate(subir, [0, 1], [0, -30])}px) scale(${interpolate(
            cardOrigem,
            [0, 1],
            [0.8, 1],
          )})`,
          marginBottom: 42,
        }}
      >
        seu post
      </div>

      {destinos.map((d, i) => {
        const s = spring({ frame: frame - 66 - i * 20, fps, config: { damping: 16, stiffness: 140 } });
        const pulso = 1 + Math.sin((frame - i * 8) / 16) * 0.01;
        return (
          <div
            key={d.nome}
            style={{
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [70, 0])}px) scale(${pulso})`,
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderLeft: `8px solid ${C.orange}`,
              borderRadius: 22,
              padding: "30px 32px",
              marginBottom: 22,
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontSize: 40, fontWeight: 700 }}>{d.nome}</div>
              <div style={{ color: C.muted, fontSize: 26, marginTop: 4 }}>{d.detalhe}</div>
            </div>
            <div
              style={{
                color: C.green,
                fontSize: 28,
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
