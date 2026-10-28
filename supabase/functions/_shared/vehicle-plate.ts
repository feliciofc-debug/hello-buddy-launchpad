const OLD_PLATE = /^[A-Z]{3}[0-9]{4}$/;
const MERCOSUL_PLATE = /^[A-Z]{3}[0-9][A-J][0-9]{2}$/;

export function normalizeBrazilianPlate(value: unknown): string | null {
  const plate = String(value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return OLD_PLATE.test(plate) || MERCOSUL_PLATE.test(plate) ? plate : null;
}

export function oldPlateToMercosul(value: unknown): string | null {
  const plate = normalizeBrazilianPlate(value);
  if (!plate || !OLD_PLATE.test(plate)) return null;
  return `${plate.slice(0, 4)}${String.fromCharCode(65 + Number(plate[4]))}${
    plate.slice(5)
  }`;
}

export function mercosulPlateToOld(value: unknown): string | null {
  const plate = normalizeBrazilianPlate(value);
  if (!plate || !MERCOSUL_PLATE.test(plate)) return null;
  return `${plate.slice(0, 4)}${plate.charCodeAt(4) - 65}${plate.slice(5)}`;
}

export function equivalentBrazilianPlates(value: unknown): string[] {
  const plate = normalizeBrazilianPlate(value);
  if (!plate) return [];
  return Array.from(
    new Set([
      plate,
      oldPlateToMercosul(plate),
      mercosulPlateToOld(plate),
    ].filter((candidate): candidate is string => !!candidate)),
  );
}

export function brazilianPlatesEquivalent(
  left: unknown,
  right: unknown,
): boolean {
  const normalizedRight = normalizeBrazilianPlate(right);
  return !!normalizedRight &&
    equivalentBrazilianPlates(left).includes(normalizedRight);
}
