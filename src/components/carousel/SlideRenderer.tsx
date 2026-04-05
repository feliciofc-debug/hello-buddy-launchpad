import React from 'react';
import type { SlideTemplateProps, TemplateKey } from './templates/types';
import { DarkPremiumCover, DarkPremiumContent, DarkPremiumCTA } from './templates/DarkPremium';
import { CleanBrightCover, CleanBrightContent, CleanBrightCTA } from './templates/CleanBright';
import { GradientVibrantCover, GradientVibrantContent, GradientVibrantCTA } from './templates/GradientVibrant';
import { ElegantSerifCover, ElegantSerifContent, ElegantSerifCTA } from './templates/ElegantSerif';
import { NeonTechCover, NeonTechContent, NeonTechCTA } from './templates/NeonTech';

const templateMap: Record<TemplateKey, Record<string, React.FC<SlideTemplateProps>>> = {
  'dark-premium': { cover: DarkPremiumCover, content: DarkPremiumContent, cta: DarkPremiumCTA },
  'clean-bright': { cover: CleanBrightCover, content: CleanBrightContent, cta: CleanBrightCTA },
  'gradient-vibrant': { cover: GradientVibrantCover, content: GradientVibrantContent, cta: GradientVibrantCTA },
  'elegant-serif': { cover: ElegantSerifCover, content: ElegantSerifContent, cta: ElegantSerifCTA },
  'neon-tech': { cover: NeonTechCover, content: NeonTechContent, cta: NeonTechCTA },
};

interface Props extends SlideTemplateProps {
  templateName: string;
}

export const SlideRenderer: React.FC<Props> = ({ templateName, ...props }) => {
  const templates = templateMap[templateName as TemplateKey] || templateMap['dark-premium'];
  const Component = templates[props.type] || templates.content;
  return <Component {...props} />;
};
