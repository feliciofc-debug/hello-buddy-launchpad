import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";

export const CTA: React.FC<{ frase: string; sub?: string }> = ({ frase, sub }) => {
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
          marginTop: 54,
          padding: "0 80px",
          color: C.text,
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
        style={{
          height: 6,
          width: 300 * linha,
          background: C.orange,
          borderRadius: 4,
          marginTop: 32,
        }}
      />

      {sub ? (
        <div style={{ marginTop: 28, color: C.muted, fontSize: 36, opacity: linha, textAlign: "center" }}>
          {sub}
        </div>
      ) : null}

      <div style={{ marginTop: 26, color: C.orange, fontSize: 40, fontWeight: 700, opacity: linha }}>
        amzofertas.com.br
      </div>
    </AbsoluteFill>
  );
};
