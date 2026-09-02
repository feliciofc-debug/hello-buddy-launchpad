import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Backdrop } from "../components/Backdrop";
import { Captions } from "../components/Captions";
import { Hook } from "../scenes/Hook";
import { MultiCanal } from "../scenes/MultiCanal";
import { CTA } from "../scenes/CTA";

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 30 });

export const DIA03_FRAMES = 660;

export const Dia03: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={190}>
        <Hook
          kicker="Multi-plataforma"
          linhas={["Um conteúdo.", "Quatro"]}
          destaque="lugares."
          sub={"Sem copiar, colar\nnem repetir trabalho."}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={360}>
        <MultiCanal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={170}>
        <CTA frase="Presença em todo canal." sub="Um clique publica em todos." />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Captions
      items={[
        { from: 8, dur: 130, text: "Um conteúdo. Quatro lugares." },
        { from: 142, dur: 120, text: "Você publica uma vez." },
        { from: 270, dur: 120, text: "Instagram: Reels, Stories e Feed." },
        { from: 392, dur: 110, text: "Facebook e LinkedIn juntos." },
        { from: 504, dur: 120, text: "E o WhatsApp levando ao cliente certo." },
        { from: 630, dur: 60, text: "amzofertas.com.br" },
      ]}
    />
  </AbsoluteFill>
);
