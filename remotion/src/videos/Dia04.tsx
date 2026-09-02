import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Backdrop } from "../components/Backdrop";
import { Captions } from "../components/Captions";
import { Hook } from "../scenes/Hook";
import { ChatAgente } from "../scenes/ChatAgente";
import { CTA } from "../scenes/CTA";

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 30 });

export const DIA04_FRAMES = 680;

export const Dia04: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={190}>
        <Hook
          kicker="Agente no WhatsApp"
          linhas={["Postou pelo", "WhatsApp."]}
          destaque="Sério."
          sub={"Um agente que sabe tudo\ndo seu negócio, na sua mão."}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={380}>
        <ChatAgente />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={170}>
        <CTA frase="Sua plataforma no chat." sub="Foto, áudio ou texto. Ele publica." />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Captions
      items={[
        { from: 8, dur: 130, text: "Postou pelo WhatsApp. Sério." },
        { from: 142, dur: 120, text: "Manda a foto e diz o que quer." },
        { from: 270, dur: 130, text: "Ele escreve a legenda e agenda." },
        { from: 402, dur: 120, text: "Sabe seu estoque, preço e tom de voz." },
        { from: 525, dur: 120, text: "Mandou áudio? Ele transforma em post." },
        { from: 650, dur: 60, text: "amzofertas.com.br" },
      ]}
    />
  </AbsoluteFill>
);
