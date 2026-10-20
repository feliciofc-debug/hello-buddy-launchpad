export type InvokeBlockingField = {
  field?: string;
  attribute_id?: string;
  message: string;
  allowed?: string[];
};

export function blockingFieldLabels(blocking: InvokeBlockingField[] | undefined): string[] {
  if (!blocking?.length) return [];
  const labels = new Set<string>();
  for (const b of blocking) {
    const fromField = humanizeBlockingField(b.field ?? b.attribute_id);
    if (fromField) labels.add(fromField);
    else if (b.message?.trim()) labels.add(b.message.trim());
  }
  return [...labels];
}

function humanizeBlockingField(raw: string | undefined): string | null {
  const key = String(raw ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    cep: "CEP",
    localizacao: "CEP",
    location: "CEP",
    cor: "Cor",
    portas: "Portas",
    preco: "Preço",
    fotos: "Fotos",
    whatsapp_loja: "Telefone",
    seller_contact: "Telefone",
    segmento: "Segmento",
  };
  if (map[key]) return map[key];
  if (!key) return null;
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

export function formatInvokeErrorToast(input: {
  error?: string;
  blocking?: InvokeBlockingField[];
  fallback?: string;
}): string {
  const parts: string[] = [];
  if (input.error?.trim()) parts.push(input.error.trim());
  const fields = blockingFieldLabels(input.blocking);
  if (fields.length) {
    parts.push(`Campos: ${fields.join(", ")}`);
  }
  if (parts.length) return parts.join(" · ");
  return input.fallback ?? "Operação rejeitada.";
}
