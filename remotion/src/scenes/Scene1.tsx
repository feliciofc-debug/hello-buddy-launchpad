import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1 = spring({ frame, fps, config: { damping: 200 } });
  const line2 = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const barra = spring({ frame: frame - 32, fps, config: { damping: 18, stiffness: 120 } });
  const sub = interpolate(frame, [46, 74], [0, 1], { extrapolateRight: "clamp" });
  const float = Math.sin(frame / 22) * 6;

  return (
    <AbsoluteFill
      style={{
        ...font,
        padding: "0 92px",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: C.muted,
          fontSize: 30,
          letterSpacing: 8,
          textTransform: "uppercase",
          opacity: line1,
          transform: `translateX(${interpolate(line1, [0, 1], [-40, 0])}px)`,
        }}
      >
        Plataforma AMZ
      </div>

      <div
        style={{
          marginTop: 26,
          color: C.text,
          fontSize: 124,
          fontWeight: 800,
          lineHeight: 1.02,
          letterSpacing: -3,
          transform: `translateY(${interpolate(line2, [0, 1], [70, float])}px)`,
          opacity: line2,
        }}
      >
        Seu marketing
        <br />
        no{" "}
        <span style={{ color: C.orange }}>piloto</span>
        <br />
        automático.
      </div>

      <div
        style={{
          height: 12,
          width: 420 * barra,
          background: `linear-gradient(90deg, ${C.orange}, ${C.orangeSoft})`,
          borderRadius: 8,
          marginTop: 42,
        }}
      />

      <div
        style={{
          marginTop: 40,
          color: C.muted,
          fontSize: 40,
          opacity: sub,
          transform: `translateY(${interpolate(sub, [0, 1], [24, 0])}px)`,
        }}
      >
        Conteúdo, agendamento e publicação
        <br />
        em um só lugar.
      </div>
    </AbsoluteFill>
  );
};
