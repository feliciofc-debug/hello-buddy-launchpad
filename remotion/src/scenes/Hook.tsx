import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";

export const Hook: React.FC<{
  kicker: string;
  linhas: string[];
  destaque?: string;
  sub?: string;
}> = ({ kicker, linhas, destaque, sub }) => {
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
          color: C.muted,
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
          color: C.text,
          fontSize: 116,
          fontWeight: 800,
          lineHeight: 1.03,
          letterSpacing: -3,
          opacity: t,
          transform: `translateY(${interpolate(t, [0, 1], [70, float])}px)`,
        }}
      >
        {linhas.map((l) => (
          <div key={l}>{l}</div>
        ))}
        {destaque ? <div style={{ color: C.orange }}>{destaque}</div> : null}
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

      {sub ? (
        <div
          style={{
            marginTop: 38,
            color: C.muted,
            fontSize: 38,
            lineHeight: 1.3,
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
