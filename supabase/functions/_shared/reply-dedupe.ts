function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sameBlock(values: string[], left: number, right: number, size: number): boolean {
  for (let offset = 0; offset < size; offset++) {
    if (normalized(values[left + offset]) !== normalized(values[right + offset])) return false;
  }
  return true;
}

function dedupeConsecutiveUnits(values: string[]): string[] {
  const output: string[] = [];
  for (let index = 0; index < values.length;) {
    let repeatedSize = 0;
    for (let size = Math.floor((values.length - index) / 2); size >= 1; size--) {
      if (sameBlock(values, index, index + size, size)) {
        repeatedSize = size;
        break;
      }
    }
    if (!repeatedSize) {
      output.push(values[index]);
      index++;
      continue;
    }

    output.push(...values.slice(index, index + repeatedSize));
    index += repeatedSize;
    while (
      index + repeatedSize <= values.length
      && sameBlock(values, index - repeatedSize, index, repeatedSize)
    ) index += repeatedSize;
  }
  return output;
}

function dedupeRepeatedSentenceSequence(text: string): string {
  const sentences = text.match(/\s*[^.!?]+[.!?]+|\s*[^.!?]+$/g) ?? [];
  if (sentences.length < 2) return text;
  const deduped = dedupeConsecutiveUnits(sentences);
  return deduped.length === sentences.length ? text : deduped.join("").trim();
}

export function dedupeConsecutiveReplyText(reply: string): string {
  const parts = String(reply || "").split("<<SPLIT>>");
  const outputParts: string[] = [];
  for (const part of parts) {
    const paragraphs = part.split(/\n{2,}/)
      .map((item) => dedupeRepeatedSentenceSequence(item))
      .filter((item) => item.trim());
    const cleanPart = dedupeConsecutiveUnits(paragraphs).join("\n\n").trim();
    if (
      cleanPart &&
      normalized(outputParts.at(-1) || "") !== normalized(cleanPart)
    ) outputParts.push(cleanPart);
  }
  return outputParts.join("<<SPLIT>>");
}
