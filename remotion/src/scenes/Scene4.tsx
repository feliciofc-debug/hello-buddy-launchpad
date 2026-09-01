import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const texto = interpolate(frame, [16, 34], [0, 1], { extrapolateRight: "clamp" });
  const linha = interpolate(frame, [30, 56], [0, 1], { extrapolateRight: "clamp" });
  const float = Math.sin(frame / 20) * 5;

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: 52,
          background: `linear-gradient(135deg, ${C.orange}, ${C.orangeSoft})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#151515",
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: -2,
          transform: `scale(${logo}) translateY(${float}px)`,
          boxShadow: `0 40px 90px ${C.orange}44`,
        }}
      >
        AMZ
      </div>

      <div
        style={{
          marginTop: 56,
          color: C.text,
          fontSize: 66,
          fontWeight: 800,
          textAlign: "center",
          letterSpacing: -1.5,
          opacity: texto,
          transform: `translateY(${interpolate(texto, [0, 1], [30, 0])}px)`,
        }}
      >
        Comece hoje.
      </div>

      <div
        style={{
          height: 6,
          width: 300 * linha,
          background: C.orange,
          borderRadius: 4,
          marginTop: 34,
        }}
      />

      <div
        style={{
          marginTop: 34,
          color: C.muted,
          fontSize: 38,
          opacity: linha,
        }}
      >
        amzofertas.com.br
      </div>
    </AbsoluteFill>
  );
};
