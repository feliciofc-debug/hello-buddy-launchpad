import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { font } from "../font";
import { Phone } from "../components/Phone";

type Msg = { de: "dono" | "agente"; texto: string; from: number };

const msgs: Msg[] = [
  { de: "dono", texto: "posta essa foto no reels e no story hoje 19h", from: 20 },
  { de: "agente", texto: "Fechado. Escrevi a legenda com o tom da sua loja e agendei para 19:00.", from: 62 },
  { de: "dono", texto: "quanto de estoque tem do modelo novo?", from: 118 },
  { de: "agente", texto: "12 unidades. Já preparei um post de urgência para amanhã.", from: 158 },
  { de: "dono", texto: "manda por áudio que eu tô dirigindo", from: 214 },
  { de: "agente", texto: "Recebi seu áudio, transcrevi e transformei em post. Quer publicar?", from: 250 },
];

const Bolha: React.FC<{ m: Msg }> = ({ m }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - m.from, fps, config: { damping: 18, stiffness: 150 } });
  const dono = m.de === "dono";
  return (
    <div
      style={{
        alignSelf: dono ? "flex-end" : "flex-start",
        maxWidth: "84%",
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
        background: dono ? `linear-gradient(135deg, ${C.orange}, ${C.orangeSoft})` : C.bg2,
        color: dono ? "#151515" : C.text,
        border: dono ? "none" : `1px solid ${C.line}`,
        borderRadius: 22,
        borderBottomRightRadius: dono ? 6 : 22,
        borderBottomLeftRadius: dono ? 22 : 6,
        padding: "22px 24px",
        fontSize: 30,
        lineHeight: 1.3,
        fontWeight: dono ? 700 : 400,
      }}
    >
      {m.texto}
    </div>
  );
};

export const ChatAgente: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const titulo = interpolate(frame, [6, 26], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 116,
          left: 84,
          right: 84,
          color: C.text,
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: -1,
          lineHeight: 1.08,
          opacity: titulo,
          transform: `translateY(${interpolate(titulo, [0, 1], [30, 0])}px)`,
        }}
      >
        Marketing pelo <span style={{ color: C.orange }}>WhatsApp</span>
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
        <div style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18 }}>
          {msgs.map((m) => (
            <Bolha key={m.texto} m={m} />
          ))}
        </div>
      </Phone>
    </AbsoluteFill>
  );
};
