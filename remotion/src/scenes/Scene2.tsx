import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";
import { Phone } from "../components/Phone";

const linhas = [
  "Novo post • Instagram + Facebook",
  "Legenda gerada por IA",
  "Melhor horário: 19:30",
];

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const titulo = interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" });
  const cursorX = interpolate(frame, [60, 112], [180, 372], { extrapolateRight: "clamp" });
  const cursorY = interpolate(frame, [60, 112], [520, 880], { extrapolateRight: "clamp" });
  const clique = spring({ frame: frame - 116, fps, config: { damping: 12, stiffness: 220 } });
  const ok = interpolate(frame, [128, 148], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 130,
          left: 92,
          right: 92,
          color: C.text,
          fontSize: 62,
          fontWeight: 800,
          letterSpacing: -1,
          opacity: titulo,
          transform: `translateY(${interpolate(titulo, [0, 1], [30, 0])}px)`,
        }}
      >
        Agende em <span style={{ color: C.orange }}>3 toques</span>
      </div>

      <Phone
        style={{
          transform: `translateY(${interpolate(entrada, [0, 1], [220, 120])}px) scale(${interpolate(
            entrada,
            [0, 1],
            [0.92, 1],
          )})`,
        }}
      >
        <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
          {linhas.map((t, i) => {
            const s = spring({ frame: frame - 20 - i * 14, fps, config: { damping: 20, stiffness: 160 } });
            return (
              <div
                key={t}
                style={{
                  opacity: s,
                  transform: `translateX(${interpolate(s, [0, 1], [50, 0])}px)`,
                  background: C.bg2,
                  border: `1px solid ${C.line}`,
                  borderRadius: 20,
                  padding: "26px 24px",
                  color: C.text,
                  fontSize: 27,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    background: i === 1 ? C.orange : C.muted,
                  }}
                />
                {t}
              </div>
            );
          })}

          <div
            style={{
              marginTop: 10,
              borderRadius: 24,
              background: `linear-gradient(90deg, ${C.orange}, ${C.orangeSoft})`,
              color: "#151515",
              fontWeight: 800,
              fontSize: 32,
              textAlign: "center",
              padding: "30px 0",
              transform: `scale(${1 - clique * 0.06 + Math.max(0, clique - 0.6) * 0.06})`,
            }}
          >
            Agendar publicação
          </div>

          <div
            style={{
              opacity: ok,
              transform: `translateY(${interpolate(ok, [0, 1], [18, 0])}px)`,
              color: C.green,
              fontSize: 30,
              fontWeight: 600,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            ✓ Agendado para hoje, 19:30
          </div>
        </div>
      </Phone>

      <div
        style={{
          position: "absolute",
          left: cursorX,
          top: cursorY,
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: `4px solid ${C.text}`,
          background: `${C.orange}66`,
          opacity: interpolate(frame, [54, 64, 140, 152], [0, 1, 1, 0]),
          transform: `scale(${1 + clique * 0.9})`,
        }}
      />
    </AbsoluteFill>
  );
};
