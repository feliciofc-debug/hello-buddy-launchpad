import { normalizeOwnerPhone } from "./owner-phone.ts";

export const AMZ_AUTO_TIPOS = ["revenda", "concessionaria", "grupo", "motos"] as const;
export type AmzAutoTipoOperacao = (typeof AMZ_AUTO_TIPOS)[number];

export const AMZ_AUTO_QTD_LOJAS_OPTIONS = [
  "1 loja",
  "2 a 3 lojas",
  "4 ou mais",
] as const;

export const AMZ_AUTO_FAIXA_ESTOQUE_OPTIONS = [
  "Até 30",
  "31 a 80",
  "81 a 200",
  "Mais de 200",
] as const;

export const AMZ_AUTO_INTERESSE_OPTIONS = [
  "Atendimento no WhatsApp",
  "Publicar estoque e gerar mídia",
  "Gestão completa da loja",
  "Tudo",
] as const;

export type AmzAutoCadastroPayload = {
  loja_nome?: unknown;
  cnpj?: unknown;
  responsavel?: unknown;
  whatsapp?: unknown;
  email?: unknown;
  cidade_uf?: unknown;
  tipo_operacao?: unknown;
  qtd_lojas?: unknown;
  faixa_estoque?: unknown;
  interesse?: unknown;
  aceite_termos?: unknown;
  /** Honeypot — must be empty */
  website?: unknown;
};

export type AmzAutoCadastroNormalized = {
  loja_nome: string;
  cnpj: string;
  responsavel: string;
  whatsapp_e164: string;
  email: string;
  cidade_uf: string;
  tipo_operacao: AmzAutoTipoOperacao;
  qtd_lojas: string;
  faixa_estoque: string;
  interesse: string;
  aceite_termos_at: string;
};

const MAX_LOJA_NOME = 120;
const MAX_RESPONSAVEL = 120;
const MAX_CIDADE_UF = 80;
const MAX_EMAIL = 254;

function requireString(
  value: unknown,
  fieldLabel: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: true, value: "" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${fieldLabel} inválido.` };
  }
  return { ok: true, value };
}

export function cnpjDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCnpj(value: string): boolean {
  const digits = cnpjDigitsOnly(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits.slice(0, 12), w1);
  const d2 = calc(digits.slice(0, 12) + String(d1), w2);
  return digits[12] === String(d1) && digits[13] === String(d2);
}

export function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (!email || email.includes(" ") || email.length > MAX_EMAIL) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function whatsappToE164BR(value: string): string | null {
  const normalized = normalizeOwnerPhone(value);
  if (!normalized.startsWith("55")) return null;
  const national = normalized.slice(2);
  if (national.length !== 10 && national.length !== 11) return null;
  if (national.length === 11 && national[2] !== "9") return null;
  return `+${normalized}`;
}

export function validateAmzAutoCadastro(
  raw: AmzAutoCadastroPayload,
): { ok: true; data: AmzAutoCadastroNormalized } | { ok: false; error: string } {
  const website = requireString(raw.website, "website");
  if (!website.ok) return website;
  if (website.value.trim() !== "") {
    return { ok: false, error: "Solicitação rejeitada." };
  }

  const fields: Array<[keyof AmzAutoCadastroPayload, string]> = [
    ["loja_nome", "Nome da loja"],
    ["cnpj", "CNPJ"],
    ["responsavel", "Responsável"],
    ["whatsapp", "WhatsApp"],
    ["email", "E-mail"],
    ["cidade_uf", "Cidade / UF"],
    ["tipo_operacao", "Tipo de operação"],
    ["qtd_lojas", "Quantas lojas"],
    ["faixa_estoque", "Faixa de estoque"],
    ["interesse", "Interesse"],
  ];

  const parsed: Record<string, string> = {};
  for (const [key, label] of fields) {
    const r = requireString(raw[key], label);
    if (!r.ok) return r;
    parsed[key] = r.value.trim();
  }

  const loja_nome = parsed.loja_nome;
  const responsavel = parsed.responsavel;
  const cidade_uf = parsed.cidade_uf;
  const qtd_lojas = parsed.qtd_lojas;
  const faixa_estoque = parsed.faixa_estoque;
  const interesse = parsed.interesse;
  const cnpj = cnpjDigitsOnly(parsed.cnpj);
  const email = parsed.email.toLowerCase();

  if (!loja_nome) return { ok: false, error: "Informe o nome da loja." };
  if (loja_nome.length > MAX_LOJA_NOME) {
    return { ok: false, error: "Nome da loja muito longo." };
  }
  if (!isValidCnpj(cnpj)) return { ok: false, error: "CNPJ inválido." };
  if (!responsavel) return { ok: false, error: "Informe o responsável." };
  if (responsavel.length > MAX_RESPONSAVEL) {
    return { ok: false, error: "Nome do responsável muito longo." };
  }
  if (!isValidEmail(email)) return { ok: false, error: "E-mail inválido." };
  if (!cidade_uf) return { ok: false, error: "Informe cidade e UF." };
  if (cidade_uf.length > MAX_CIDADE_UF) {
    return { ok: false, error: "Cidade / UF muito longo." };
  }

  if (!(AMZ_AUTO_QTD_LOJAS_OPTIONS as readonly string[]).includes(qtd_lojas)) {
    return { ok: false, error: "Opção de lojas inválida." };
  }
  if (!(AMZ_AUTO_FAIXA_ESTOQUE_OPTIONS as readonly string[]).includes(faixa_estoque)) {
    return { ok: false, error: "Faixa de estoque inválida." };
  }
  if (!(AMZ_AUTO_INTERESSE_OPTIONS as readonly string[]).includes(interesse)) {
    return { ok: false, error: "Interesse inválido." };
  }

  const tipo = parsed.tipo_operacao as AmzAutoTipoOperacao;
  if (!AMZ_AUTO_TIPOS.includes(tipo)) {
    return { ok: false, error: "Tipo de operação inválido." };
  }

  const e164 = whatsappToE164BR(parsed.whatsapp);
  if (!e164) {
    return { ok: false, error: "WhatsApp inválido. Use DDD + celular." };
  }

  if (raw.aceite_termos !== true) {
    return { ok: false, error: "É necessário aceitar os termos." };
  }

  return {
    ok: true,
    data: {
      loja_nome,
      cnpj,
      responsavel,
      whatsapp_e164: e164,
      email,
      cidade_uf,
      tipo_operacao: tipo,
      qtd_lojas,
      faixa_estoque,
      interesse,
      aceite_termos_at: new Date().toISOString(),
    },
  };
}
