import {
  isValidCnpj,
  isValidCpf,
  normalizeCnpj,
  normalizeCpf,
} from "./brazil-person-doc.ts";
import {
  isValidBrazilMobilePhone,
  isValidCep,
  isValidEmail,
  normalizeCep,
  parseBirthDateInput,
  parseMoneyBrl,
  parsePrazoMeses,
} from "./contact-validators.ts";
import type { ViaCepAddress } from "./viacep-client.ts";
import type {
  PendingVitrineEstoque,
  VeiculoVitrineRow,
  VitrineEstoqueForm,
} from "./vehicle-stock-whatsapp.ts";
import { formatRecadoClienteLine } from "./vehicle-stock-cliente-nome.ts";
import { vehicleTitle as vehicleTitleFn } from "./vehicle-stock-whatsapp.ts";

export type FinanciamentoTipoPessoa = "pf" | "pj";

export type FinanciamentoFichaRow = {
  user_id: string;
  veiculo_id: string;
  whatsapp_from: string;
  whatsapp_contact_name?: string | null;
  cliente_nome_vitrine?: string | null;
  lgpd_aceite_em: string;
  tipo_pessoa: FinanciamentoTipoPessoa;
  nome_completo: string;
  cpf_cnpj: string;
  data_nascimento?: string | null;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  renda_mensal: number;
  telefone_referencia: string;
  entrada?: number | null;
  prazo_meses: number;
};

export const FINANCIAMENTO_LGPD_BODY =
  "Para simular o financiamento, preciso registrar alguns dados com segurança (LGPD). " +
  "Eles ficam protegidos e só a loja analisa a simulação. Posso continuar?";

export const FINANCIAMENTO_PRAZO_OPTIONS = [12, 24, 36, 48, 60] as const;

export function clienteNomeLooksComplete(name: string): boolean {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2;
}

export function financiamentoFormStepExpectsText(step: string): boolean {
  return [
    "nome_completo",
    "cpf_cnpj",
    "data_nascimento",
    "email",
    "cep",
    "numero",
    "complemento",
    "renda",
    "telefone_referencia",
    "entrada",
  ].includes(step);
}

export function mergePendingForFinanciamentoStart(
  pending: PendingVitrineEstoque | null | undefined,
  vehicle: VeiculoVitrineRow,
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
    cliente_nome: pending?.cliente_nome ?? null,
    form: {
      flow: "financiamento",
      step: "lgpd",
      veiculo_id: vehicle.id,
      updated_at: now,
    },
    updated_at: now,
  };
}

function nextAfterNome(
  form: VitrineEstoqueForm,
  pending: PendingVitrineEstoque | null | undefined,
  now: string,
): VitrineEstoqueForm {
  const saved = String(pending?.cliente_nome || "").trim();
  if (saved && clienteNomeLooksComplete(saved)) {
    return {
      ...form,
      step: "cpf_cnpj",
      nome_completo: saved,
      updated_at: now,
    };
  }
  if (saved) {
    return { ...form, step: "nome_completo", updated_at: now };
  }
  return { ...form, step: "nome_completo", updated_at: now };
}

export function applyFinanciamentoLgpdChoice(
  form: VitrineEstoqueForm,
  accept: boolean,
  pending: PendingVitrineEstoque | null | undefined,
  now: string,
): { form: VitrineEstoqueForm; rejected: boolean } {
  if (!accept) {
    return { form, rejected: true };
  }
  const withLgpd = {
    ...form,
    lgpd_aceite_em: now,
    step: "tipo_pessoa",
    updated_at: now,
  };
  return { form: withLgpd, rejected: false };
}

export function applyFinanciamentoTipoPessoa(
  form: VitrineEstoqueForm,
  tipo: FinanciamentoTipoPessoa,
  pending: PendingVitrineEstoque | null | undefined,
  now: string,
): VitrineEstoqueForm {
  const base = {
    ...form,
    tipo_pessoa: tipo,
    updated_at: now,
  };
  return nextAfterNome(base, pending, now);
}

export type AdvanceFinanciamentoResult = {
  form: VitrineEstoqueForm;
  reply?: string;
  done?: boolean;
  needsCepLookup?: boolean;
};

export function advanceFinanciamentoAfterText(
  form: VitrineEstoqueForm,
  text: string,
  now: string,
  ctx: { pending?: PendingVitrineEstoque | null; skipOptional?: boolean },
): AdvanceFinanciamentoResult {
  const value = String(text || "").trim();
  const skip = ctx.skipOptional === true;

  switch (form.step) {
    case "nome_completo": {
      const nome = value.slice(0, 160);
      if (nome.length < 3) {
        return { form, reply: "Informe seu nome completo, por favor." };
      }
      return {
        form: { ...form, nome_completo: nome, step: "cpf_cnpj", updated_at: now },
      };
    }
    case "cpf_cnpj": {
      const tipo = form.tipo_pessoa ?? "pf";
      if (tipo === "pf") {
        if (!isValidCpf(value)) {
          return { form, reply: "CPF inválido. Envie os 11 dígitos, por favor." };
        }
        return {
          form: {
            ...form,
            cpf_cnpj: normalizeCpf(value),
            step: "data_nascimento",
            updated_at: now,
          },
        };
      }
      if (!isValidCnpj(value)) {
        return { form, reply: "CNPJ inválido. Confira os números e tente de novo." };
      }
      return {
        form: {
          ...form,
          cpf_cnpj: normalizeCnpj(value),
          step: "email",
          updated_at: now,
        },
      };
    }
    case "data_nascimento": {
      if (skip) {
        return {
          form: { ...form, step: "email", updated_at: now },
        };
      }
      const iso = parseBirthDateInput(value);
      if (!iso) {
        return {
          form,
          reply: "Data inválida. Use DD/MM/AAAA (ex.: 15/03/1990).",
        };
      }
      return {
        form: {
          ...form,
          data_nascimento: iso,
          step: "email",
          updated_at: now,
        },
      };
    }
    case "email": {
      if (!isValidEmail(value)) {
        return { form, reply: "E-mail inválido. Pode enviar de novo?" };
      }
      return {
        form: { ...form, email: value.trim().toLowerCase(), step: "cep", updated_at: now },
      };
    }
    case "cep": {
      if (!isValidCep(value)) {
        return { form, reply: "CEP inválido. Envie 8 dígitos." };
      }
      return {
        form: { ...form, cep: normalizeCep(value), updated_at: now },
        needsCepLookup: true,
      };
    }
    case "numero": {
      const numero = value.slice(0, 20) || (skip ? "S/N" : "");
      if (!numero) {
        return { form, reply: "Informe o número ou digite *pular* se não houver." };
      }
      return {
        form: { ...form, numero, step: "complemento", updated_at: now },
      };
    }
    case "complemento": {
      const complemento = skip ? "" : value.slice(0, 80);
      return {
        form: {
          ...form,
          complemento,
          step: "renda",
          updated_at: now,
        },
      };
    }
    case "renda": {
      const renda = parseMoneyBrl(value);
      if (renda == null) {
        return {
          form,
          reply: "Valor inválido. Ex.: 4500 ou 4.500,00",
        };
      }
      return {
        form: {
          ...form,
          renda_mensal: String(renda),
          step: "telefone_referencia",
          updated_at: now,
        },
      };
    }
    case "telefone_referencia": {
      if (!isValidBrazilMobilePhone(value)) {
        return {
          form,
          reply: "Telefone inválido. Envie DDD + número (10 ou 11 dígitos).",
        };
      }
      return {
        form: {
          ...form,
          telefone_referencia: value.replace(/\D/g, ""),
          step: "entrada",
          updated_at: now,
        },
      };
    }
    case "entrada": {
      if (skip) {
        return {
          form: { ...form, entrada: "", step: "prazo", updated_at: now },
        };
      }
      const entrada = parseMoneyBrl(value);
      if (entrada == null) {
        return {
          form,
          reply: "Valor inválido ou digite *pular* para simular sem entrada.",
        };
      }
      return {
        form: {
          ...form,
          entrada: String(entrada),
          step: "prazo",
          updated_at: now,
        },
      };
    }
    default:
      return { form };
  }
}

export function applyFinanciamentoCepLookup(
  form: VitrineEstoqueForm,
  addr: ViaCepAddress | null,
  now: string,
): AdvanceFinanciamentoResult {
  if (!addr) {
    return {
      form,
      reply:
        "Não encontrei esse CEP agora. Confira os números ou tente de novo em instantes.",
    };
  }
  const summary =
    `${addr.logradouro || "—"}, ${addr.bairro || "—"} — ${addr.localidade}/${addr.uf}`;
  return {
    form: {
      ...form,
      logradouro: addr.logradouro,
      bairro: addr.bairro,
      cidade: addr.localidade,
      uf: addr.uf,
      step: "numero",
      updated_at: now,
    },
    reply: `Endereço: ${summary}\nQual o *número*? (ou digite *pular*)`,
  };
}

export function applyFinanciamentoPrazo(
  form: VitrineEstoqueForm,
  prazoMeses: number,
  now: string,
): AdvanceFinanciamentoResult {
  if (!FINANCIAMENTO_PRAZO_OPTIONS.includes(prazoMeses as typeof FINANCIAMENTO_PRAZO_OPTIONS[number])) {
    const parsed = parsePrazoMeses(String(prazoMeses));
    if (!parsed) {
      return { form, reply: "Escolha um prazo na lista ou envie meses entre 6 e 84." };
    }
    prazoMeses = parsed;
  }
  return {
    form: { ...form, prazo_meses: String(prazoMeses), step: "concluido", updated_at: now },
    done: true,
  };
}

export function promptFinanciamentoStep(
  form: VitrineEstoqueForm,
  pending: PendingVitrineEstoque | null | undefined,
): string {
  switch (form.step) {
    case "nome_completo":
      if (String(pending?.cliente_nome || "").trim()) {
        return "Qual seu *nome completo* (como no documento)?";
      }
      return "Qual seu *nome completo*?";
    case "cpf_cnpj":
      return form.tipo_pessoa === "pj"
        ? "Qual o *CNPJ* da empresa?"
        : "Qual seu *CPF*?";
    case "data_nascimento":
      return "Qual sua *data de nascimento*? (DD/MM/AAAA)";
    case "email":
      return "Qual seu *e-mail*?";
    case "cep":
      return "Qual o *CEP* do endereço?";
    case "numero":
      return "Qual o *número* do endereço? (ou digite *pular*)";
    case "complemento":
      return "Tem *complemento*? (apto, bloco…) ou digite *pular*";
    case "renda":
      return "Qual a *renda mensal* aproximada? (ex.: 4500)";
    case "telefone_referencia":
      return "Telefone de *referência* (DDD + número)?";
    case "entrada":
      return "Valor de *entrada* desejada? (ou digite *pular*)";
    case "prazo":
      return "Em quantos *meses* prefere parcelar? Escolha abaixo.";
    default:
      return "Pode continuar preenchendo ou digite *cancelar*.";
  }
}

export function buildFinanciamentoFichaRow(input: {
  userId: string;
  form: VitrineEstoqueForm;
  fromNumber: string;
  contactName?: string | null;
  pending?: PendingVitrineEstoque | null;
}): FinanciamentoFichaRow | null {
  const f = input.form;
  if (
    !f.lgpd_aceite_em || !f.tipo_pessoa || !f.nome_completo || !f.cpf_cnpj ||
    !f.email || !f.cep || !f.logradouro || !f.numero || !f.bairro ||
    !f.cidade || !f.uf || !f.renda_mensal || !f.telefone_referencia ||
    !f.prazo_meses
  ) {
    return null;
  }
  const renda = parseMoneyBrl(f.renda_mensal);
  const prazo = parsePrazoMeses(f.prazo_meses);
  if (renda == null || prazo == null) return null;
  const entrada = f.entrada ? parseMoneyBrl(f.entrada) : null;
  return {
    user_id: input.userId,
    veiculo_id: f.veiculo_id,
    whatsapp_from: input.fromNumber,
    whatsapp_contact_name: input.contactName ?? null,
    cliente_nome_vitrine: input.pending?.cliente_nome ?? null,
    lgpd_aceite_em: f.lgpd_aceite_em,
    tipo_pessoa: f.tipo_pessoa as FinanciamentoTipoPessoa,
    nome_completo: f.nome_completo,
    cpf_cnpj: f.cpf_cnpj,
    data_nascimento: f.data_nascimento ?? null,
    email: f.email,
    cep: f.cep,
    logradouro: f.logradouro,
    numero: f.numero,
    complemento: f.complemento ?? null,
    bairro: f.bairro,
    cidade: f.cidade,
    uf: f.uf,
    renda_mensal: renda,
    telefone_referencia: f.telefone_referencia,
    entrada,
    prazo_meses: prazo,
  };
}

export function buildRecadoFinanciamentoFichaSemPii(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
  vehicle: VeiculoVitrineRow;
  fichaId: string;
}): string {
  const titulo = vehicleTitleFn(input.vehicle);
  const clienteLine = formatRecadoClienteLine({
    clienteNome: input.clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
  });
  return [
    clienteLine,
    `Enviou ficha de financiamento do ${titulo}.`,
    `Veículo (estoque): ${input.vehicle.id}`,
    `Ficha (painel): ${input.fichaId}`,
    "Dados sensíveis só no painel /veiculos/financiamento — não replicar por WhatsApp.",
    "Ação: analisar simulação e retornar contato.",
  ].join("\n");
}

export function confirmacaoFinanciamentoFicha(nomeEmpresa?: string | null): string {
  const nome = String(nomeEmpresa || "").trim() || "nossa loja";
  return (
    `Recebi sua ficha de financiamento! A equipe da ${nome} vai analisar e retorna em breve. ` +
    "Obrigado pela confiança."
  );
}
