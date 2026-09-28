export type HookLayoutInput = {
  width: number;
  height: number;
  kicker: string;
  lines: string[];
  highlight?: string;
  sub?: string;
  hasLogo: boolean;
};

export type HookLayout = {
  lines: string[];
  titleFontSize: number;
  kickerFontSize: number;
  subFontSize: number;
  logoHeight: number;
  logoMinHeight: number;
  gapAfterLogo: number;
  gapAfterKicker: number;
  gapAfterTitle: number;
  gapAfterBar: number;
  barHeight: number;
  estimatedHeight: number;
  safeHeight: number;
  horizontalPadding: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const wordsFrom = (lines: string[]) =>
  lines.join(" ").trim().split(/\s+/).filter(Boolean);

const lineCost = (
  words: string[],
  start: number,
  end: number,
  target: number,
  isLast: boolean,
) => {
  const length = words.slice(start, end).join(" ").length;
  const count = end - start;
  const orphanPenalty = count === 1 && words.length > 2 ? target * target * 4 : 0;
  const lastPenalty = isLast && count === 1 ? target * target * 8 : 0;
  return (length - target) ** 2 + orphanPenalty + lastPenalty;
};

/**
 * Divide o título em linhas de comprimentos próximos. A penalidade forte para
 * linhas com uma única palavra evita órfãs como "casa" / "própria?".
 */
export function balanceTitleLines(lines: string[], desiredLines: number): string[] {
  const words = wordsFrom(lines);
  if (words.length <= 1) return words;
  const lineCount = clamp(desiredLines, 1, Math.max(1, words.length - 1));
  if (lineCount === 1) return [words.join(" ")];

  const target = words.join(" ").length / lineCount;
  const costs = Array.from({ length: lineCount + 1 }, () =>
    Array(words.length + 1).fill(Number.POSITIVE_INFINITY)
  );
  const breaks = Array.from({ length: lineCount + 1 }, () =>
    Array(words.length + 1).fill(-1)
  );
  costs[0][0] = 0;

  for (let line = 1; line <= lineCount; line++) {
    for (let end = line; end <= words.length; end++) {
      for (let start = line - 1; start < end; start++) {
        const remainingWords = words.length - end;
        const remainingLines = lineCount - line;
        if (remainingWords < remainingLines) continue;
        const cost = costs[line - 1][start]
          + lineCost(words, start, end, target, line === lineCount);
        if (cost < costs[line][end]) {
          costs[line][end] = cost;
          breaks[line][end] = start;
        }
      }
    }
  }

  const balanced: string[] = [];
  let end = words.length;
  for (let line = lineCount; line > 0; line--) {
    const start = breaks[line][end];
    if (start < 0) return lines;
    balanced.unshift(words.slice(start, end).join(" "));
    end = start;
  }
  return balanced;
}

function estimateSubLines(sub: string | undefined, width: number, fontSize: number) {
  if (!sub) return 0;
  const charactersPerLine = Math.max(12, Math.floor(width / (fontSize * 0.55)));
  return Math.max(1, Math.ceil(sub.length / charactersPerLine));
}

export function computeHookLayout(input: HookLayoutInput): HookLayout {
  const { width, height } = input;
  const scale = Math.min(width / 1080, height / 1920);
  const horizontalPadding = Math.round(clamp(width * 0.085, 42, 120));
  const safeWidth = width - horizontalPadding * 2;
  const safeHeight = Math.round(height * (height >= width ? 0.84 : 0.82));
  const logoMinHeight = input.hasLogo ? Math.round(clamp(92 * scale, 64, 96)) : 0;
  let logoHeight = input.hasLogo
    ? Math.round(clamp(220 * scale, logoMinHeight, 220))
    : 0;
  const kickerFontSize = Math.round(clamp(30 * scale, 20, 30));
  const subFontSize = Math.round(clamp(38 * scale, 24, 38));
  const gapAfterLogo = Math.round(clamp(34 * scale, 18, 34));
  const gapAfterKicker = Math.round(clamp(26 * scale, 14, 26));
  const gapAfterTitle = Math.round(clamp(42 * scale, 20, 42));
  const gapAfterBar = input.sub
    ? Math.round(clamp(38 * scale, 18, 38))
    : 0;
  const barHeight = Math.round(clamp(12 * scale, 7, 12));
  const maxTitleFont = Math.round(clamp(112 * scale, 58, 112));
  const minTitleFont = Math.round(clamp(48 * scale, 28, 48));
  const sourceWords = wordsFrom(input.lines);
  let titleFontSize = sourceWords.some((word) => word.length > 14)
    ? Math.round(maxTitleFont * 0.84)
    : maxTitleFont;
  let balanced = input.lines;
  let estimatedHeight = Number.POSITIVE_INFINITY;

  const measure = () => {
    const charsPerLine = Math.max(
      10,
      Math.floor(safeWidth / (titleFontSize * 0.54)),
    );
    const titleCharacters = sourceWords.join(" ").length;
    const desiredLines = clamp(
      Math.max(input.lines.length, Math.ceil(titleCharacters / charsPerLine)),
      1,
      Math.max(1, sourceWords.length - 1),
    );
    balanced = balanceTitleLines(input.lines, desiredLines);
    const titleRows = balanced.length + (input.highlight ? 1 : 0);
    const subRows = estimateSubLines(input.sub, safeWidth, subFontSize);
    estimatedHeight = (input.hasLogo ? logoHeight + gapAfterLogo : 0)
      + kickerFontSize * 1.25
      + gapAfterKicker
      + titleRows * titleFontSize * 1.04
      + gapAfterTitle
      + barHeight
      + (subRows ? gapAfterBar + subRows * subFontSize * 1.3 : 0);
  };

  measure();
  while (estimatedHeight > safeHeight && titleFontSize > minTitleFont) {
    titleFontSize = Math.max(minTitleFont, titleFontSize - 4);
    measure();
  }
  while (
    estimatedHeight > safeHeight
    && input.hasLogo
    && logoHeight > logoMinHeight
  ) {
    logoHeight = Math.max(logoMinHeight, logoHeight - 8);
    measure();
  }
  while (estimatedHeight > safeHeight && titleFontSize > 24) {
    titleFontSize = Math.max(24, titleFontSize - 2);
    measure();
  }

  return {
    lines: balanced,
    titleFontSize,
    kickerFontSize,
    subFontSize,
    logoHeight,
    logoMinHeight,
    gapAfterLogo,
    gapAfterKicker,
    gapAfterTitle,
    gapAfterBar,
    barHeight,
    estimatedHeight,
    safeHeight,
    horizontalPadding,
  };
}
