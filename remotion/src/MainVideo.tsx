import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Backdrop } from "./components/Backdrop";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene3 } from "./scenes/Scene3";
import { Scene4 } from "./scenes/Scene4";

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 30 });

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={165}>
        <Scene1 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={215}>
        <Scene2 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={185}>
        <Scene3 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={145}>
        <Scene4 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
