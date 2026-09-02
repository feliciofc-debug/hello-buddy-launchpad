import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { font } from "../font";
import { rgba, textoSobre } from "../templates/agente/contraste";

export type Caption = { from: number; dur: number; text: string };
export type CaptionPalette = { panel: string; line: string };

const Linha: React.FC<{ text: string; palette: CaptionPalette }> = ({ text, palette }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...font, justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 150,
          maxWidth: 900,
          textAlign: "center",
          background: rgba(palette.panel, 0.9),
          border: `1px solid ${palette.line}`,
          borderRadius: 20,
          padding: "20px 30px",
          color: textoSobre(palette.panel),
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

export const Captions: React.FC<{ items: Caption[]; palette?: CaptionPalette }> = ({ items, palette }) => {
  const colors = palette ?? { panel: C.panel, line: C.line };
  return (
    <>
      {items.map((c) => (
        <Sequence key={`${c.from}-${c.text}`} from={c.from} durationInFrames={c.dur}>
          <Linha text={c.text} palette={colors} />
        </Sequence>
      ))}
    </>
  );
};
