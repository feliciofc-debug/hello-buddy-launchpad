import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BG, C } from "../theme";

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;

  return (
    <AbsoluteFill style={{ background: BG }}>
      <AbsoluteFill
        style={{
          opacity: 0.35,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          transform: `translateY(${(frame * 0.35) % 72 - 72}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          left: -320 + drift,
          top: 980,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.orange}44 0%, transparent 65%)`,
          filter: "blur(30px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          right: -260 - drift,
          top: -180,
          borderRadius: "50%",
          background: `radial-gradient(circle, #3b6ea533 0%, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};
