import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Backdrop } from "../components/Backdrop";
import { Captions } from "../components/Captions";
import { Hook } from "../scenes/Hook";
import { Resultados } from "../scenes/Resultados";
import { CTA } from "../scenes/CTA";

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 30 });

export const DIA05_FRAMES = 670;

export const Dia05: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={180}>
        <Hook
          kicker="Resultados"
          linhas={["Isso é 30 dias", "no piloto"]}
          destaque="automático."
          sub={"Você dorme.\nEla continua publicando."}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={380}>
        <Resultados />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={170}>
        <CTA frase="Frequência não se improvisa." sub="90 posts por mês, no automático." />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Captions
      items={[
        { from: 8, dur: 130, text: "Isso é 30 dias no piloto automático." },
        { from: 142, dur: 110, text: "4 posts por mês virou 90." },
        { from: 258, dur: 130, text: "Frequência todo dia, sem esforço." },
        { from: 392, dur: 130, text: "E o lead chega às 22h." },
        { from: 526, dur: 110, text: "Você acorda com o trabalho feito." },
        { from: 640, dur: 60, text: "amzofertas.com.br" },
      ]}
    />
  </AbsoluteFill>
);
