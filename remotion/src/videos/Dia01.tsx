import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Backdrop } from "../components/Backdrop";
import { Captions } from "../components/Captions";
import { Hook } from "../scenes/Hook";
import { CopyIA } from "../scenes/CopyIA";
import { MultiCanal } from "../scenes/MultiCanal";
import { CTA } from "../scenes/CTA";

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 30 });

export const DIA01_FRAMES = 770;

export const Dia01: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={180}>
        <Hook
          kicker="Plataforma AMZ"
          linhas={["Sua IA de", "marketing"]}
          destaque="chegou."
          sub={"Ela escreve, escolhe a imagem\ne publica no seu lugar."}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={290}>
        <CopyIA />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={220}>
        <MultiCanal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={170}>
        <CTA frase="Comece hoje." sub="Presença todo dia, sem operacional." />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Captions
      items={[
        { from: 8, dur: 120, text: "Sua IA de marketing chegou." },
        { from: 130, dur: 130, text: "Você diz o que quer. Ela faz o resto." },
        { from: 270, dur: 130, text: "A legenda se escreve sozinha." },
        { from: 400, dur: 120, text: "E a imagem? Ela também escolhe." },
        { from: 530, dur: 140, text: "Um post. Instagram, Facebook, LinkedIn e WhatsApp." },
        { from: 675, dur: 90, text: "amzofertas.com.br" },
      ]}
    />
  </AbsoluteFill>
);
