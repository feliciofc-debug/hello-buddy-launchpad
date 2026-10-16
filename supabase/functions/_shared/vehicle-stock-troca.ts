import type { TrocaVisionAnalysis } from "./vehicle-stock-troca-vision.ts";
import type {
  PendingVitrineEstoque,
  VeiculoVitrineRow,
  VitrineEstoqueForm,
} from "./vehicle-stock-whatsapp.ts";
import {
  buildVitrineRecadoAcao,
  buildVitrineRecadoHeader,
} from "./vehicle-stock-vitrine-recado.ts";
import { formatPrecoBrl } from "./vehicle-stock-whatsapp.ts";
import { vehicleTitle } from "./vehicle-stock-whatsapp.ts";

export const VITRINE_TROCA_KBB_URL = "https://www.kbb.com.br/";
export const TROCA_MAX_VISION_RETRIES_PER_SLOT = 2;

export type TrocaFotoSlotId =
  | "frente"
  | "traseira"
  | "lateral_esquerda"
  | "lateral_direita"
  | "painel"
  | "bancos_interior"
  | "pneus"
  | "motor";

export type TrocaFotoVisionMeta = {
  view?: string | null;
  nitida?: boolean | null;
  km_lido?: number | null;
  luzes_alerta?: boolean | null;
  avarias?: string | null;
  visao_indisponivel?: boolean;
  nota_avaliador?: string | null;
};

export type TrocaFotoRegistro = {
  slot: TrocaFotoSlotId;
  url: string;
  vision?: TrocaFotoVisionMeta;
};

export const VITRINE_TROCA_FOTO_SLOTS: Array<{
  id: TrocaFotoSlotId;
  label: string;
  prompt: string;
  optional?: boolean;
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
    id: "lateral_esquerda",
    label: "Lateral esquerda",
    prompt: "Mande uma foto da *lateral esquerda* (lado do motorista).",
  },
  {
    id: "lateral_direita",
    label: "Lateral direita",
    prompt: "Agora a foto da *lateral direita* (lado do passageiro).",
  },
  {
    id: "painel",
    label: "Painel (carro ligado)",
    prompt:
      "Foto do *painel com o carro ligado*, com a *quilometragem visível* no display.",
  },
  {
    id: "bancos_interior",
    label: "Bancos / interior",
    prompt: "Envie uma foto dos *bancos* ou *interior* do veículo.",
  },
  {
    id: "pneus",
    label: "Pneus",
    optional: true,
    prompt: "Se puder, mande uma foto dos *pneus* (ou toque em *Pular*).",
  },
  {
    id: "motor",
    label: "Motor",
    optional: true,
    prompt: "Por fim, foto do *motor* (opcional — toque em *Pular* se preferir).",
  },
];

const VIEW_ALIASES: Record<string, string> = {
  frente: "frente",
  traseira: "traseira",
  "lateral esquerda": "lateral_esquerda",
  "lateral direita": "lateral_direita",
  lateral: "lateral",
  painel: "painel",
  interior: "bancos_interior",
  bancos: "bancos_interior",
  pneus: "pneus",
  rodas: "pneus",
  motor: "motor",
  veículo: "veiculo",
  veiculo: "veiculo",
};

export function trocaSlotLabel(slotId: TrocaFotoSlotId): string {
  return VITRINE_TROCA_FOTO_SLOTS.find((s) => s.id === slotId)?.label ?? slotId;
}

export function trocaSlotById(slotId: TrocaFotoSlotId) {
  return VITRINE_TROCA_FOTO_SLOTS.find((s) => s.id === slotId);
}

function normalizeViewToken(view: string | null | undefined): string {
  return String(view || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function trocaViewMatchesSlot(
  slotId: TrocaFotoSlotId,
  view: string | null | undefined,
): boolean {
  const v = normalizeViewToken(view);
  if (!v) return false;
  const mapped = VIEW_ALIASES[v] ?? v.replace(/\s+/g, "_");
  if (mapped === slotId) return true;
  if (slotId === "frente" && (v.includes("frente") || v === "3/4")) return true;
  if (slotId === "traseira" && v.includes("traseira")) return true;
  if (slotId === "lateral_esquerda" && (v.includes("lateral esquerda") || mapped === "lateral_esquerda")) {
    return true;
  }
  if (slotId === "lateral_direita" && (v.includes("lateral direita") || mapped === "lateral_direita")) {
    return true;
  }
  if (slotId === "painel" && (v.includes("painel") || v.includes("hodometro") || v.includes("odometro"))) {
    return true;
  }
  if (slotId === "bancos_interior" && (v.includes("interior") || v.includes("banco"))) {
    return true;
  }
  if (slotId === "pneus" && (v.includes("pneu") || v.includes("roda"))) return true;
  if (slotId === "motor" && v.includes("motor")) return true;
  return false;
}

export function buildTrocaRepromptMessage(
  slotId: TrocaFotoSlotId,
  view: string | null | undefined,
  nitida: boolean | null,
): string {
  const label = trocaSlotLabel(slotId).toLowerCase();
  if (nitida === false) {
    return `A foto ficou um pouco escura ou tremida 😊 Pode mandar de novo a ${label}?`;
  }
  const v = normalizeViewToken(view);
  if (v.includes("traseira") && slotId === "frente") {
    return "Essa parece ser a traseira 🙂 Pode me mandar a *frente* do carro?";
  }
  if (v.includes("frente") && slotId === "traseira") {
    return "Essa parece ser a frente 🙂 Pode me mandar a *traseira*?";
  }
  if (v.includes("lateral") && slotId.startsWith("lateral_")) {
    const lado = slotId === "lateral_esquerda" ? "esquerda" : "direita";
    return `Preciso da lateral *${lado}* 🙂 Pode enviar outra foto?`;
  }
  return `Preciso de uma foto da ${label} 🙂 Pode tentar de novo?`;
}

export type TrocaPhotoVisionDecision =
  | { action: "reprompt"; clientMessage: string; form: VitrineEstoqueForm }
  | {
    action: "accept";
    form: VitrineEstoqueForm;
    visionMeta: TrocaFotoVisionMeta;
    internalNotes: string[];
  };

export function parseKmInformado(km: string | undefined): number | null {
  if (!km) return null;
  const digits = String(km).replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function kmDivergenciaObservacao(
  kmInformado: number | null,
  kmLido: number | null,
): string | null {
  if (kmInformado == null || kmLido == null || kmInformado <= 0) return null;
  const diff = Math.abs(kmLido - kmInformado) / kmInformado;
  if (diff > 0.1) {
    return `Km informado (${kmInformado.toLocaleString("pt-BR")}) vs painel (${kmLido.toLocaleString("pt-BR")}) — divergência >10%.`;
  }
  return null;
}

export function evaluateTrocaPhotoVision(input: {
  form: VitrineEstoqueForm;
  slotId: TrocaFotoSlotId;
  analysis: TrocaVisionAnalysis;
  now: string;
}): TrocaPhotoVisionDecision {
  const retries = input.form.foto_slot_retries ?? 0;
  const internalFromVision = collectInternalVisionNotes(
    input.slotId,
    input.analysis,
    input.form.km,
  );

  if (input.analysis.unavailable || !input.analysis.ok) {
    const visionMeta: TrocaFotoVisionMeta = {
      visao_indisponivel: true,
      nota_avaliador: "visão indisponível",
    };
    return {
      action: "accept",
      form: resetSlotRetries(input.form, input.now),
      visionMeta,
      internalNotes: ["Visão indisponível nesta foto."],
    };
  }

  const viewOk = trocaViewMatchesSlot(input.slotId, input.analysis.view);
  const nitidaOk = input.analysis.nitida !== false;
  const needsReprompt = !viewOk || !nitidaOk;

  if (needsReprompt && retries < TROCA_MAX_VISION_RETRIES_PER_SLOT) {
    return {
      action: "reprompt",
      clientMessage: buildTrocaRepromptMessage(
        input.slotId,
        input.analysis.view,
        input.analysis.nitida,
      ),
      form: {
        ...input.form,
        foto_slot_retries: retries + 1,
        updated_at: input.now,
      },
    };
  }

  const visionMeta: TrocaFotoVisionMeta = {
    view: input.analysis.view,
    nitida: input.analysis.nitida,
    km_lido: input.analysis.km_lido,
    luzes_alerta: input.analysis.luzes_alerta,
    avarias: input.analysis.avarias,
  };
  const internalNotes = [...internalFromVision];
  if (needsReprompt) {
    visionMeta.nota_avaliador =
      `Foto aceita após ${retries + 1} tentativa(s); visão=${input.analysis.view ?? "?"} nitida=${String(input.analysis.nitida)}`;
    internalNotes.push(visionMeta.nota_avaliador);
  }

  return {
    action: "accept",
    form: resetSlotRetries(input.form, input.now),
    visionMeta,
    internalNotes,
  };
}

function resetSlotRetries(
  form: VitrineEstoqueForm,
  now: string,
): VitrineEstoqueForm {
  return { ...form, foto_slot_retries: 0, updated_at: now };
}

function collectInternalVisionNotes(
  slotId: TrocaFotoSlotId,
  analysis: TrocaVisionAnalysis,
  kmInformado?: string,
): string[] {
  const notes: string[] = [];
  if (slotId === "painel") {
    const obs = kmDivergenciaObservacao(
      parseKmInformado(kmInformado),
      analysis.km_lido,
    );
    if (obs) notes.push(obs);
  }
  if (analysis.luzes_alerta === true) {
    notes.push("Luzes de alerta visíveis no painel (informar avaliador).");
  }
  if (analysis.avarias) {
    notes.push(`Avarias visíveis (avaliador): ${analysis.avarias}`);
  }
  return notes;
}

export function appendTrocaInternalNotes(
  form: VitrineEstoqueForm,
  notes: string[],
  now: string,
): VitrineEstoqueForm {
  if (!notes.length) return form;
  const prev = form.troca_observacoes_internas ?? [];
  return {
    ...form,
    troca_observacoes_internas: [...prev, ...notes],
    updated_at: now,
  };
}

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

export const TROCA_CLIENTE_FORBIDDEN_PATTERNS = [
  /\bfipe\b/i,
  /\bkbb\b/i,
  /R\$\s*\d/i,
  /\b(valor|preço|preco|avaliação|avaliacao)\b.*\b(carro|veículo|veiculo)\b/i,
  /\b(bom|ruim|conservado|detalhe|arranh|amassad)\b.*\b(estado|pintura|lataria)\b/i,
  /\bluz(es)?\s+de\s+alerta/i,
  /\bavaria(s)?\b/i,
  /\bkm_lido\b/i,
] as const;

export function trocaClienteMessageAllowed(text: string): boolean {
  const value = String(text || "");
  return !TROCA_CLIENTE_FORBIDDEN_PATTERNS.some((re) => re.test(value));
}

export function buildRecadoTrocaAvaliacao(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
  vehicleEstoque: VeiculoVitrineRow;
  form: VitrineEstoqueForm;
}): string {
  const tituloEstoque = vehicleTitle(input.vehicleEstoque);
  const precoEstoque = formatPrecoBrl(input.vehicleEstoque.preco);
  const fotos = input.form.fotos ?? [];
  const linhasFotos = fotos.map((f, i) => {
    const slot = VITRINE_TROCA_FOTO_SLOTS.find((s) => s.id === f.slot);
    const label = slot?.label ?? f.slot;
    const v = f.vision;
    const parts: string[] = [];
    if (v?.view) parts.push(`visão: ${v.view}`);
    if (v?.visao_indisponivel) parts.push("visão indisponível");
    if (v?.nota_avaliador) parts.push(v.nota_avaliador);
    if (v?.km_lido != null) parts.push(`km lido: ${v.km_lido}`);
    if (v?.luzes_alerta === true) parts.push("luzes alerta: sim");
    if (v?.avarias) parts.push(`avarias: ${v.avarias}`);
    const extra = parts.length ? ` (${parts.join("; ")})` : "";
    return `${i + 1}. ${label}: ${f.url}${extra}`;
  });
  const obs = (input.form.observacoes || "").trim() || "—";
  const internas = (input.form.troca_observacoes_internas ?? []).filter(Boolean);
  return [
    buildVitrineRecadoHeader("troca", input),
    `🚗 Interesse: ${tituloEstoque} · ${precoEstoque}`,
    `🔁 Carro na troca: ${input.form.modelo_ano ?? "—"} · km ${input.form.km ?? "—"} · placa ${input.form.placa ?? "—"}`,
    "📷 Fotos (ordem):",
    ...(linhasFotos.length ? linhasFotos : ["—"]),
    `💬 Observações do cliente: ${obs}`,
    ...(internas.length
      ? ["🔍 Observações internas (visão):", ...internas.map((n) => `• ${n}`)]
      : []),
    `🔗 Referência manual: ${VITRINE_TROCA_KBB_URL}`,
    buildVitrineRecadoAcao("troca"),
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
      foto_slot_retries: 0,
      fotos: [],
      troca_observacoes_internas: [],
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
      form: { ...form, modelo_ano: text, step: "km", updated_at: now },
      reply: promptTrocaKm(),
    };
  }
  if (form.step === "km") {
    return {
      form: { ...form, km: text, step: "placa", updated_at: now },
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
        foto_slot_retries: 0,
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
  vision?: TrocaFotoVisionMeta;
  now: string;
}): {
  form: VitrineEstoqueForm;
  reply: string;
  nextSlot: (typeof VITRINE_TROCA_FOTO_SLOTS)[number] | null;
} {
  const prev: TrocaFotoRegistro[] = (input.form.fotos ?? []).map((f) => ({
    slot: f.slot as TrocaFotoSlotId,
    url: f.url,
    vision: f.vision as TrocaFotoVisionMeta | undefined,
  }));
  const fotos: TrocaFotoRegistro[] = [
    ...prev,
    { slot: input.slot, url: input.url, vision: input.vision },
  ];
  const nextIndex = (input.form.foto_slot_index ?? 0) + 1;
  if (nextIndex >= VITRINE_TROCA_FOTO_SLOTS.length) {
    return {
      form: {
        ...input.form,
        fotos,
        foto_slot_index: nextIndex,
        foto_slot_retries: 0,
        step: "observacoes",
        updated_at: input.now,
      },
      reply: promptTrocaObservacoes(),
      nextSlot: null,
    };
  }
  const nextSlot = VITRINE_TROCA_FOTO_SLOTS[nextIndex];
  return {
    form: {
      ...input.form,
      fotos,
      foto_slot_index: nextIndex,
      foto_slot_retries: 0,
      step: "fotos",
      updated_at: input.now,
    },
    reply: nextSlot.prompt,
    nextSlot,
  };
}

export function advanceTrocaSkipOptionalSlot(
  form: VitrineEstoqueForm,
  slotId: TrocaFotoSlotId,
  now: string,
): {
  form: VitrineEstoqueForm;
  reply: string;
  nextSlot: (typeof VITRINE_TROCA_FOTO_SLOTS)[number] | null;
} | null {
  const idx = form.foto_slot_index ?? 0;
  const current = VITRINE_TROCA_FOTO_SLOTS[idx];
  if (!current || current.id !== slotId || !current.optional) return null;
  const nextIndex = idx + 1;
  if (nextIndex >= VITRINE_TROCA_FOTO_SLOTS.length) {
    return {
      form: {
        ...form,
        foto_slot_index: nextIndex,
        foto_slot_retries: 0,
        step: "observacoes",
        updated_at: now,
      },
      reply: promptTrocaObservacoes(),
      nextSlot: null,
    };
  }
  const nextSlot = VITRINE_TROCA_FOTO_SLOTS[nextIndex];
  return {
    form: {
      ...form,
      foto_slot_index: nextIndex,
      foto_slot_retries: 0,
      step: "fotos",
      updated_at: now,
    },
    reply: nextSlot.prompt,
    nextSlot,
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
