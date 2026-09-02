import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { font } from "../font";
import { rgba, textoSobre } from "../templates/agente/contraste";

export type Caption = { from: number; dur: number; text: string };

const Linha: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...font, justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 150,
          maxWidth: 900,
          textAlign: "center",
          background: rgba(C.panel, 0.9),
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          padding: "20px 30px",
          color: textoSobre(C.panel),
          fontSize: 40,
          fontWeight: 600,
          lineHeight: 1.25,
          opacity: o,
          transform: `translateY(${interpolate(o, [0, 1], [16, 0])}px)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{ items: Caption[] }> = ({ items }) => (
  <>
    {items.map((c) => (
      <Sequence key={`${c.from}-${c.text}`} from={c.from} durationInFrames={c.dur}>
        <Linha text={c.text} />
      </Sequence>
    ))}
  </>
);
