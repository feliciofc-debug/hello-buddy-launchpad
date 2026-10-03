export function normalizeOwnerPhone(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Número nacional: DDD + 8 ou 9 dígitos. Mesmo quando o DDD é 55,
  // o tamanho diferencia o número nacional do E.164 já completo.
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  if (
    !digits.startsWith("55")
    || (digits.length !== 12 && digits.length !== 13)
  ) {
    return "";
  }
  return digits;
}

export function ownerPhoneVariants(value: unknown): string[] {
  const phone = normalizeOwnerPhone(value);
  if (!phone) return [];

  const variants = new Set([phone]);
  const subscriber = phone.slice(4);
  if (subscriber.length === 9 && subscriber.startsWith("9")) {
    variants.add(`${phone.slice(0, 4)}${subscriber.slice(1)}`);
  } else if (subscriber.length === 8) {
    variants.add(`${phone.slice(0, 4)}9${subscriber}`);
  }
  return [...variants];
}

export function ownerPhonesEquivalent(a: unknown, b: unknown): boolean {
  const aVariants = ownerPhoneVariants(a);
  if (!aVariants.length) return false;
  const bVariants = new Set(ownerPhoneVariants(b));
  return aVariants.some((phone) => bVariants.has(phone));
}

export function brazilianPhoneKey(value: unknown): string {
  const phone = normalizeOwnerPhone(value);
  if (!phone) return "";
  const subscriber = phone.slice(4);
  return subscriber.length === 9 && subscriber.startsWith("9")
    ? `${phone.slice(0, 4)}${subscriber.slice(1)}`
    : phone;
}

export function brazilianPhoneLookupVariants(value: unknown): string[] {
  const variants = new Set<string>();
  for (const phone of ownerPhoneVariants(value)) {
    variants.add(phone);
    variants.add(phone.slice(2));
  }
  return [...variants];
}
