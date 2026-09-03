import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { Dia01, DIA01_FRAMES } from "./videos/Dia01";
import { Dia02, DIA02_FRAMES } from "./videos/Dia02";
import { Dia03, DIA03_FRAMES } from "./videos/Dia03";
import { Dia04, DIA04_FRAMES } from "./videos/Dia04";
import { Dia05, DIA05_FRAMES } from "./videos/Dia05";
import {
  TemplateAgente,
  PROPS_EXEMPLO,
  framesTemplateAgente,
  type TemplateAgenteProps,
} from "./templates/agente/Template";
import {
  TemplateProduto,
  PROPS_PRODUTO_EXEMPLO,
  framesTemplateProduto,
  type TemplateProdutoProps,
} from "./templates/produto/Template";


const base = { fps: 30, width: 1080, height: 1920 } as const;

export const RemotionRoot = () => (
  <>
    <Composition id="main" component={MainVideo} durationInFrames={620} {...base} />
    <Composition id="dia01" component={Dia01} durationInFrames={DIA01_FRAMES} {...base} />
    <Composition id="dia02" component={Dia02} durationInFrames={DIA02_FRAMES} {...base} />
    <Composition id="dia03" component={Dia03} durationInFrames={DIA03_FRAMES} {...base} />
    <Composition id="dia04" component={Dia04} durationInFrames={DIA04_FRAMES} {...base} />
    <Composition id="dia05" component={Dia05} durationInFrames={DIA05_FRAMES} {...base} />

    {/* Template paramétrico usado pela plataforma (props vêm do job) */}
    <Composition
      id="template-agente"
      component={TemplateAgente}
      durationInFrames={framesTemplateAgente(PROPS_EXEMPLO)}
      defaultProps={PROPS_EXEMPLO}
      calculateMetadata={({ props }) => ({
        durationInFrames: framesTemplateAgente(props as TemplateAgenteProps),
      })}
      {...base}
    />

    {/* Template de produto (foto -> vídeo vertical), custo zero por render */}
    <Composition
      id="template-produto"
      component={TemplateProduto}
      durationInFrames={framesTemplateProduto(PROPS_PRODUTO_EXEMPLO)}
      defaultProps={PROPS_PRODUTO_EXEMPLO}
      calculateMetadata={({ props }) => ({
        durationInFrames: framesTemplateProduto(props as TemplateProdutoProps),
      })}
      {...base}
    />
  </>
);

