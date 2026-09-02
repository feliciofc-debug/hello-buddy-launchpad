import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Backdrop } from "../components/Backdrop";
import { Captions } from "../components/Captions";
import { Hook } from "../scenes/Hook";
import { CopyIA } from "../scenes/CopyIA";
import { CTA } from "../scenes/CTA";

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 30 });

export const DIA02_FRAMES = 670;

export const Dia02: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={190}>
        <Hook
          kicker="Copy com IA"
          linhas={["Você não", "escreve mais"]}
          destaque="legenda."
          sub={"A IA conhece seu produto,\nseu preço e o seu tom."}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={370}>
        <CopyIA />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={170}>
        <CTA frase="Três toques. Publicado." sub="Da ideia ao agendamento em segundos." />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Captions
      items={[
        { from: 8, dur: 130, text: "Você não escreve mais legenda." },
        { from: 142, dur: 120, text: "A IA já sabe o que você vende." },
        { from: 270, dur: 140, text: "Ela escreve a copy na sua voz." },
        { from: 415, dur: 120, text: "Escolhe a melhor imagem." },
        { from: 540, dur: 100, text: "E agenda no melhor horário." },
        { from: 645, dur: 55, text: "amzofertas.com.br" },
      ]}
    />
  </AbsoluteFill>
);
