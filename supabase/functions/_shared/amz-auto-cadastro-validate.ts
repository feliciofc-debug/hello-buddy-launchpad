import { normalizeOwnerPhone } from "./owner-phone.ts";

export const AMZ_AUTO_TIPOS = ["revenda", "concessionaria", "grupo", "motos"] as const;
export type AmzAutoTipoOperacao = (typeof AMZ_AUTO_TIPOS)[number];

export type AmzAutoCadastroPayload = {
  loja_nome?: string;
  cnpj?: string;
  responsavel?: string;
  whatsapp?: string;
  email?: string;
  cidade_uf?: string;
  tipo_operacao?: string;
  qtd_lojas?: string;
  faixa_estoque?: string;
  interesse?: string;
  aceite_termos?: boolean;
  /** Honeypot — must be empty */
  website?: string;
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
  if (!email || email.includes(" ")) return false;
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
  if (raw.website && String(raw.website).trim() !== "") {
    return { ok: false, error: "Solicitação rejeitada." };
  }

  const loja_nome = (raw.loja_nome ?? "").trim();
  const responsavel = (raw.responsavel ?? "").trim();
  const cidade_uf = (raw.cidade_uf ?? "").trim();
  const qtd_lojas = (raw.qtd_lojas ?? "").trim();
  const faixa_estoque = (raw.faixa_estoque ?? "").trim();
  const interesse = (raw.interesse ?? "").trim();
  const cnpj = cnpjDigitsOnly(raw.cnpj ?? "");
  const email = (raw.email ?? "").trim().toLowerCase();

  if (!loja_nome) return { ok: false, error: "Informe o nome da loja." };
  if (!isValidCnpj(cnpj)) return { ok: false, error: "CNPJ inválido." };
  if (!responsavel) return { ok: false, error: "Informe o responsável." };
  if (!isValidEmail(email)) return { ok: false, error: "E-mail inválido." };
  if (!cidade_uf) return { ok: false, error: "Informe cidade e UF." };
  if (!qtd_lojas) return { ok: false, error: "Informe quantas lojas." };
  if (!faixa_estoque) return { ok: false, error: "Informe a faixa de estoque." };
  if (!interesse) return { ok: false, error: "Informe o interesse." };

  const tipo = (raw.tipo_operacao ?? "").trim() as AmzAutoTipoOperacao;
  if (!AMZ_AUTO_TIPOS.includes(tipo)) {
    return { ok: false, error: "Tipo de operação inválido." };
  }

  const e164 = whatsappToE164BR(raw.whatsapp ?? "");
  if (!e164) {
    return { ok: false, error: "WhatsApp inválido. Use DDD + celular." };
  }

  if (!raw.aceite_termos) {
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
