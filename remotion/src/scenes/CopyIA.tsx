import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";
import { Phone } from "../components/Phone";

const TEXTO =
  "Chegou a linha nova. Estoque limitado e entrega no mesmo dia. Fale com a gente agora.";

export const CopyIA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const titulo = interpolate(frame, [6, 26], [0, 1], { extrapolateRight: "clamp" });

  const chars = Math.floor(interpolate(frame, [34, 150], [0, TEXTO.length], { extrapolateRight: "clamp" }));
  const escrevendo = chars < TEXTO.length;

  const grid = spring({ frame: frame - 150, fps, config: { damping: 200 } });
  const escolhida = interpolate(frame, [190, 206], [0, 1], { extrapolateRight: "clamp" });
  const clique = spring({ frame: frame - 226, fps, config: { damping: 12, stiffness: 220 } });
  const ok = interpolate(frame, [244, 264], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 92,
          right: 92,
          color: C.text,
          fontSize: 58,
          fontWeight: 800,
          letterSpacing: -1,
          opacity: titulo,
          transform: `translateY(${interpolate(titulo, [0, 1], [30, 0])}px)`,
        }}
      >
        A IA escreve a <span style={{ color: C.orange }}>legenda</span>
      </div>

      <Phone
        style={{
          transform: `translateY(${interpolate(entrada, [0, 1], [220, 110])}px) scale(${interpolate(
            entrada,
            [0, 1],
            [0.92, 1],
          )})`,
        }}
      >
        <div style={{ padding: 30, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: C.muted, fontSize: 24, letterSpacing: 3, textTransform: "uppercase" }}>
            Legenda gerada por IA
          </div>
          <div
            style={{
              minHeight: 250,
              background: C.bg2,
              border: `1px solid ${C.line}`,
              borderRadius: 22,
              padding: 26,
              color: C.text,
              fontSize: 32,
              lineHeight: 1.35,
            }}
          >
            {TEXTO.slice(0, chars)}
            {escrevendo && Math.floor(frame / 6) % 2 === 0 ? (
              <span style={{ color: C.orange }}>|</span>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
              opacity: grid,
              transform: `translateY(${interpolate(grid, [0, 1], [30, 0])}px)`,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 150,
                  borderRadius: 18,
                  background: `linear-gradient(${140 + i * 40}deg, #26313f, #1a2332)`,
                  border: i === 1 ? `3px solid ${C.orange}` : `1px solid ${C.line}`,
                  transform: `scale(${i === 1 ? 1 + escolhida * 0.04 : 1})`,
                  display: "flex",
                  alignItems: "flex-end",
                  padding: 12,
                  color: i === 1 ? C.orange : C.muted,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {i === 1 && escolhida > 0.4 ? "escolhida" : ""}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 6,
              borderRadius: 24,
              background: `linear-gradient(90deg, ${C.orange}, ${C.orangeSoft})`,
              color: "#151515",
              fontWeight: 800,
              fontSize: 34,
              textAlign: "center",
              padding: "28px 0",
              transform: `scale(${1 - clique * 0.06 + Math.max(0, clique - 0.6) * 0.06})`,
            }}
          >
            Agendar publicação
          </div>

          <div
            style={{
              opacity: ok,
              color: C.green,
              fontSize: 30,
              fontWeight: 600,
              textAlign: "center",
              transform: `translateY(${interpolate(ok, [0, 1], [16, 0])}px)`,
            }}
          >
            ✓ Agendado para hoje, 19:30
          </div>
        </div>
      </Phone>
    </AbsoluteFill>
  );
};
