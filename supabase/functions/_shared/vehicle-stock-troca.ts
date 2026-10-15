import type { TrocaVisionView } from "./vehicle-stock-troca-vision.ts";
import type {
  PendingVitrineEstoque,
  VeiculoVitrineRow,
  VitrineEstoqueForm,
} from "./vehicle-stock-whatsapp.ts";
import { vehicleTitle } from "./vehicle-stock-whatsapp.ts";

export const VITRINE_TROCA_KBB_URL = "https://www.kbb.com.br/";

export type TrocaFotoSlotId =
  | "frente"
  | "traseira"
  | "lateral"
  | "painel"
  | "hodometro";

export type TrocaFotoRegistro = {
  slot: TrocaFotoSlotId;
  url: string;
  vision_view?: TrocaVisionView;
};

export const VITRINE_TROCA_FOTO_SLOTS: Array<{
  id: TrocaFotoSlotId;
  label: string;
  prompt: string;
}> = [
  {
    id: "frente",
    label: "Frente",
    prompt:
      "Envie uma foto da *frente* do seu carro (de preferência com a placa visível).",
  },
  {
    id: "traseira",
    label: "Traseira",
    prompt: "Agora a foto da *traseira* do veículo.",
  },
  {
    id: "lateral",
    label: "Lateral",
    prompt: "Mande uma foto de *lateral* (lado do carro).",
  },
  {
    id: "painel",
    label: "Painel",
    prompt: "Foto do *painel* ligado, por favor.",
  },
  {
    id: "hodometro",
    label: "Hodômetro",
    prompt: "Por último, foto do *hodômetro* (km no painel).",
  },
];

export function buildTrocaStoragePath(
  userId: string,
  sessionId: string,
  slot: TrocaFotoSlotId,
): string {
  return `${userId}/troca/${sessionId}/${slot}.jpg`;
}

export function vitrineFormStepExpectsPhoto(step: string): boolean {
  return step === "fotos";
}

export function shouldCaptureVitrineTrocaPhoto(
  pending: PendingVitrineEstoque | null | undefined,
): boolean {
  if (!pending?.form || pending.form.flow !== "troca") return false;
  return vitrineFormStepExpectsPhoto(pending.form.step);
}

export function currentTrocaFotoSlot(
  form: VitrineEstoqueForm,
): (typeof VITRINE_TROCA_FOTO_SLOTS)[number] | null {
  const idx = form.foto_slot_index ?? 0;
  return VITRINE_TROCA_FOTO_SLOTS[idx] ?? null;
}

export function trocaFotosCompletas(form: VitrineEstoqueForm): boolean {
  return (form.fotos?.length ?? 0) >= VITRINE_TROCA_FOTO_SLOTS.length;
}

export function promptTrocaModeloAno(vehicle: VeiculoVitrineRow): string {
  return `Vamos avaliar seu carro na troca pelo ${vehicleTitle(vehicle)}.\n\nQual é o *modelo e ano* do seu veículo? (ex.: Civic 2018)`;
}

export function promptTrocaKm(): string {
  return "Qual a *quilometragem* aproximada? (só o número, ex.: 85000)";
}

export function promptTrocaPlaca(): string {
  return "Qual a *placa* do carro? (ex.: ABC1D23)";
}

export function promptTrocaObservacoes(): string {
  return "Quer acrescentar alguma *observação*? (opcional)\n\nDigite o texto ou toque em *Pular*.";
}

export function confirmacaoTrocaCliente(
  nomeEmpresa: string | null | undefined,
): string {
  const nome = String(nomeEmpresa || "").trim() || "nossa loja";
  return `Recebemos os dados e fotos do seu carro! A ${nome} vai analisar a avaliação na troca e um consultor entra em contato em breve. 😊`;
}

/** Mensagens ao cliente no fluxo troca — proibido FIPE/KBB/R$/estado do carro. */
export const TROCA_CLIENTE_FORBIDDEN_PATTERNS = [
  /\bfipe\b/i,
  /\bkbb\b/i,
  /R\$\s*\d/i,
  /\b(valor|preço|preco|avaliação|avaliacao)\b.*\b(carro|veículo|veiculo)\b/i,
  /\b(bom|ruim|conservado|detalhe|arranh|amassad)\b.*\b(estado|pintura|lataria)\b/i,
] as const;

export function trocaClienteMessageAllowed(text: string): boolean {
  const value = String(text || "");
  return !TROCA_CLIENTE_FORBIDDEN_PATTERNS.some((re) => re.test(value));
}

export function buildRecadoTrocaAvaliacao(input: {
  contactName?: string | null;
  fromNumber: string;
  vehicleEstoque: VeiculoVitrineRow;
  form: VitrineEstoqueForm;
}): string {
  const nome = (input.contactName || "").trim() || "Cliente";
  const tituloEstoque = vehicleTitle(input.vehicleEstoque);
  const fotos = input.form.fotos ?? [];
  const linhasFotos = fotos.map((f, i) => {
    const slot = VITRINE_TROCA_FOTO_SLOTS.find((s) => s.id === f.slot);
    const label = slot?.label ?? f.slot;
    const visao = f.vision_view ? ` (visão: ${f.vision_view})` : "";
    return `${i + 1}. ${label}: ${f.url}${visao}`;
  });
  const obs = (input.form.observacoes || "").trim() || "—";
  return [
    `Nome: ${nome}`,
    `Telefone: ${input.fromNumber}`,
    `Cliente ${nome} (${input.fromNumber}) pediu avaliação na troca.`,
    `Veículo de interesse (estoque): ${tituloEstoque} (id ${input.vehicleEstoque.id})`,
    `Carro na troca: ${input.form.modelo_ano ?? "—"} | km ${input.form.km ?? "—"} | placa ${input.form.placa ?? "—"}`,
    "Fotos (ordem):",
    ...(linhasFotos.length ? linhasFotos : ["—"]),
    `Observações do cliente: ${obs}`,
    `Referência manual (sem consulta automática): ${VITRINE_TROCA_KBB_URL}`,
    "Ação: avaliar e retornar contato ao cliente.",
  ].join("\n");
}

export function mergePendingForTrocaStart(
  pending: PendingVitrineEstoque | null | undefined,
  vehicle: VeiculoVitrineRow,
  sessionId: string,
  now: string,
): PendingVitrineEstoque {
  return {
    stage: pending?.stage ?? "detalhe",
    marca: pending?.marca ?? vehicle.marca,
    faixa: pending?.faixa ?? null,
    filtro_tipo: pending?.filtro_tipo ?? null,
    offset: pending?.offset ?? 0,
    marca_offset: pending?.marca_offset ?? 0,
    veiculo_id: vehicle.id,
    carousel_ids: pending?.carousel_ids ?? null,
    carousel_index: pending?.carousel_index ?? null,
    form: {
      flow: "troca",
      step: "modelo_ano",
      veiculo_id: vehicle.id,
      troca_sessao_id: sessionId,
      foto_slot_index: 0,
      fotos: [],
      updated_at: now,
    },
    updated_at: now,
  };
}

export function advanceTrocaAfterText(
  form: VitrineEstoqueForm,
  userText: string,
  now: string,
): { form: VitrineEstoqueForm; reply: string; done?: boolean } {
  const text = userText.trim();
  if (form.step === "modelo_ano") {
    return {
      form: {
        ...form,
        modelo_ano: text,
        step: "km",
        updated_at: now,
      },
      reply: promptTrocaKm(),
    };
  }
  if (form.step === "km") {
    return {
      form: {
        ...form,
        km: text,
        step: "placa",
        updated_at: now,
      },
      reply: promptTrocaPlaca(),
    };
  }
  if (form.step === "placa") {
    const slot = VITRINE_TROCA_FOTO_SLOTS[0];
    return {
      form: {
        ...form,
        placa: text,
        step: "fotos",
        foto_slot_index: 0,
        updated_at: now,
      },
      reply: slot.prompt,
    };
  }
  if (form.step === "observacoes") {
    return {
      form: {
        ...form,
        observacoes: text,
        step: "concluido",
        updated_at: now,
      },
      reply: "",
      done: true,
    };
  }
  return { form, reply: "Não entendi esta etapa. Digite *cancelar* para sair." };
}

export function advanceTrocaAfterPhoto(input: {
  form: VitrineEstoqueForm;
  slot: TrocaFotoSlotId;
  url: string;
  visionView?: TrocaVisionView;
  now: string;
}): { form: VitrineEstoqueForm; reply: string; readyToFinalize: boolean } {
  const prev: TrocaFotoRegistro[] = (input.form.fotos ?? []).map((f) => ({
    slot: f.slot as TrocaFotoSlotId,
    url: f.url,
    vision_view: f.vision_view as TrocaVisionView | undefined,
  }));
  const fotos: TrocaFotoRegistro[] = [
    ...prev,
    {
      slot: input.slot,
      url: input.url,
      vision_view: input.visionView,
    },
  ];
  const nextIndex = (input.form.foto_slot_index ?? 0) + 1;
  if (nextIndex >= VITRINE_TROCA_FOTO_SLOTS.length) {
    return {
      form: {
        ...input.form,
        fotos,
        foto_slot_index: nextIndex,
        step: "observacoes",
        updated_at: input.now,
      },
      reply: promptTrocaObservacoes(),
      readyToFinalize: false,
    };
  }
  const nextSlot = VITRINE_TROCA_FOTO_SLOTS[nextIndex];
  return {
    form: {
      ...input.form,
      fotos,
      foto_slot_index: nextIndex,
      step: "fotos",
      updated_at: input.now,
    },
    reply: nextSlot.prompt,
    readyToFinalize: false,
  };
}

export function skipTrocaObservacoes(
  form: VitrineEstoqueForm,
  now: string,
): VitrineEstoqueForm {
  return {
    ...form,
    observacoes: form.observacoes ?? "",
    step: "concluido",
    updated_at: now,
  };
}
