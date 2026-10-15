import {
  isValidCnpj,
  isValidCpf,
  maskCpfForClienteResumo,
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

export type FinanciamentoPerfil =
  | "assalariado"
  | "autonomo"
  | "empresario"
  | "aposentado";

export type FinanciamentoFichaRow = {
  user_id: string;
  veiculo_id: string | null;
  whatsapp_from: string;
  whatsapp_contact_name?: string | null;
  cliente_nome_vitrine?: string | null;
  lgpd_aceite_em: string;
  tipo_pessoa?: "pf" | "pj" | null;
  nome_completo?: string | null;
  cpf_cnpj?: string | null;
  data_nascimento?: string | null;
  email?: string | null;
  tempo_residencia?: string | null;
  perfil?: FinanciamentoPerfil | null;
  empresa?: string | null;
  tempo_trabalho?: string | null;
  cnpj?: string | null;
  tempo_empresa?: string | null;
  possui_cnh?: boolean | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  renda_mensal?: number | null;
  referencia_nome?: string | null;
  telefone_referencia?: string | null;
  entrada?: number | null;
  prazo_meses?: number | null;
  campos_pendentes: string[];
};

export const FINANCIAMENTO_MODO_BODY =
  "Simulação de financiamento deste veículo: você pode *preencher a ficha por aqui* " +
  "ou *falar com um consultor* — como preferir?";

export const FINANCIAMENTO_LGPD_BODY =
  "Para continuar, preciso do seu consentimento (LGPD): seus dados ficam protegidos " +
  "e só a loja usa para analisar a simulação. Posso continuar?";

export const FINANCIAMENTO_PRAZO_OPTIONS = [12, 24, 36, 48, 60] as const;

export const FIN_CORRECTABLE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "nome_completo", label: "Nome completo" },
  { key: "cpf_cnpj", label: "CPF" },
  { key: "data_nascimento", label: "Data de nascimento" },
  { key: "email", label: "E-mail" },
  { key: "tempo_residencia", label: "Tempo de residência" },
  { key: "perfil", label: "Perfil profissional" },
  { key: "empresa", label: "Empresa" },
  { key: "tempo_trabalho", label: "Tempo de trabalho" },
  { key: "cnpj", label: "CNPJ (atividade)" },
  { key: "tempo_empresa", label: "Tempo de empresa" },
  { key: "cep", label: "CEP / endereço" },
  { key: "renda", label: "Renda mensal" },
  { key: "possui_cnh", label: "CNH" },
  { key: "referencia_nome", label: "Nome da referência" },
  { key: "telefone_referencia", label: "Telefone da referência" },
  { key: "entrada", label: "Entrada" },
  { key: "prazo", label: "Prazo" },
];

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
    "tempo_residencia",
    "empresa",
    "tempo_trabalho",
    "cnpj",
    "tempo_empresa",
    "cep",
    "numero",
    "complemento",
    "renda",
    "referencia_nome",
    "telefone_referencia",
    "entrada",
  ].includes(step);
}

function pendencias(form: VitrineEstoqueForm): string[] {
  return [...(form.campos_pendentes ?? [])];
}

function markPendente(
  form: VitrineEstoqueForm,
  campo: string,
): string[] {
  const set = new Set(pendencias(form));
  set.add(campo);
  return [...set];
}

function clearPendente(form: VitrineEstoqueForm, campo: string): string[] {
  return pendencias(form).filter((c) => c !== campo);
}

function afterField(
  form: VitrineEstoqueForm,
  patch: Partial<VitrineEstoqueForm>,
  nextStep: string,
  now: string,
): VitrineEstoqueForm {
  const base = { ...form, ...patch, updated_at: now };
  if (form.fin_corrigindo) {
    return { ...base, step: "resumo", fin_corrigindo: false };
  }
  return { ...base, step: nextStep };
}

function skipField(
  form: VitrineEstoqueForm,
  campo: string,
  nextStep: string,
  now: string,
  clearKeys: (keyof VitrineEstoqueForm)[] = [campo as keyof VitrineEstoqueForm],
): AdvanceFinanciamentoResult {
  let next: VitrineEstoqueForm = {
    ...form,
    campos_pendentes: markPendente(form, campo),
    updated_at: now,
  };
  for (const k of clearKeys) {
    next = { ...next, [k]: undefined };
  }
  next = afterField(next, {}, nextStep, now);
  return { form: next };
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
      step: "modo",
      veiculo_id: vehicle.id,
      campos_pendentes: [],
      updated_at: now,
    },
    updated_at: now,
  };
}

export function applyFinanciamentoModo(
  form: VitrineEstoqueForm,
  modo: "preencher" | "consultor",
  now: string,
): { form: VitrineEstoqueForm; consultor: boolean } {
  if (modo === "consultor") {
    return { form, consultor: true };
  }
  return {
    form: { ...form, step: "lgpd", updated_at: now },
    consultor: false,
  };
}

function nextAfterNome(
  form: VitrineEstoqueForm,
  pending: PendingVitrineEstoque | null | undefined,
  now: string,
): VitrineEstoqueForm {
  const saved = String(pending?.cliente_nome || "").trim();
  if (saved && clienteNomeLooksComplete(saved)) {
    return afterField(
      { ...form, nome_completo: saved, campos_pendentes: clearPendente(form, "nome_completo") },
      {},
      "cpf_cnpj",
      now,
    );
  }
  return afterField(form, {}, "nome_completo", now);
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
    updated_at: now,
  };
  return { form: nextAfterNome(withLgpd, pending, now), rejected: false };
}

export function stepAfterPerfil(
  perfil: FinanciamentoPerfil,
): string {
  switch (perfil) {
    case "assalariado":
      return "empresa";
    case "autonomo":
    case "empresario":
      return "cnpj";
    default:
      return "cep";
  }
}

export function applyFinanciamentoPerfil(
  form: VitrineEstoqueForm,
  perfil: FinanciamentoPerfil,
  now: string,
): VitrineEstoqueForm {
  return afterField(
    {
      ...form,
      perfil,
      campos_pendentes: clearPendente(form, "perfil"),
    },
    {},
    stepAfterPerfil(perfil),
    now,
  );
}

export function applyFinanciamentoCnh(
  form: VitrineEstoqueForm,
  possui: boolean,
  now: string,
): VitrineEstoqueForm {
  return afterField(
    {
      ...form,
      possui_cnh: possui,
      campos_pendentes: clearPendente(form, "possui_cnh"),
    },
    {},
    "referencia_nome",
    now,
  );
}

export type AdvanceFinanciamentoResult = {
  form: VitrineEstoqueForm;
  reply?: string;
  readyForSave?: boolean;
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
      if (skip) {
        return skipField(form, "nome_completo", "cpf_cnpj", now);
      }
      const nome = value.slice(0, 160);
      if (nome.length < 3) {
        return { form, reply: "Informe seu nome completo ou digite *pular*." };
      }
      return {
        form: afterField(
          { ...form, nome_completo: nome, campos_pendentes: clearPendente(form, "nome_completo") },
          {},
          "cpf_cnpj",
          now,
        ),
      };
    }
    case "cpf_cnpj": {
      if (skip) {
        return skipField(form, "cpf_cnpj", "data_nascimento", now);
      }
      if (!isValidCpf(value)) {
        return { form, reply: "CPF inválido. Envie os 11 dígitos ou *pular*." };
      }
      return {
        form: afterField(
          {
            ...form,
            cpf_cnpj: normalizeCpf(value),
            campos_pendentes: clearPendente(form, "cpf_cnpj"),
          },
          {},
          "data_nascimento",
          now,
        ),
      };
    }
    case "data_nascimento": {
      if (skip) {
        return skipField(form, "data_nascimento", "email", now, ["data_nascimento"]);
      }
      const iso = parseBirthDateInput(value);
      if (!iso) {
        return { form, reply: "Data inválida. Use DD/MM/AAAA ou *pular*." };
      }
      return {
        form: afterField(
          { ...form, data_nascimento: iso, campos_pendentes: clearPendente(form, "data_nascimento") },
          {},
          "email",
          now,
        ),
      };
    }
    case "email": {
      if (skip) {
        return skipField(form, "email", "tempo_residencia", now);
      }
      if (!isValidEmail(value)) {
        return { form, reply: "E-mail inválido ou digite *pular*." };
      }
      return {
        form: afterField(
          {
            ...form,
            email: value.trim().toLowerCase(),
            campos_pendentes: clearPendente(form, "email"),
          },
          {},
          "tempo_residencia",
          now,
        ),
      };
    }
    case "tempo_residencia": {
      if (skip) {
        return skipField(form, "tempo_residencia", "perfil", now);
      }
      const tr = value.slice(0, 80);
      if (tr.length < 2) {
        return { form, reply: "Ex.: 2 anos, 6 meses… ou *pular*." };
      }
      return {
        form: afterField(
          { ...form, tempo_residencia: tr, campos_pendentes: clearPendente(form, "tempo_residencia") },
          {},
          "perfil",
          now,
        ),
      };
    }
    case "empresa": {
      if (skip) {
        return skipField(form, "empresa", "tempo_trabalho", now);
      }
      const emp = value.slice(0, 120);
      if (emp.length < 2) {
        return { form, reply: "Nome da empresa ou *pular*." };
      }
      return {
        form: afterField(
          { ...form, empresa: emp, campos_pendentes: clearPendente(form, "empresa") },
          {},
          "tempo_trabalho",
          now,
        ),
      };
    }
    case "tempo_trabalho": {
      if (skip) {
        return skipField(form, "tempo_trabalho", "cep", now);
      }
      const tt = value.slice(0, 80);
      if (tt.length < 2) {
        return { form, reply: "Tempo de trabalho (ex.: 3 anos) ou *pular*." };
      }
      return {
        form: afterField(
          { ...form, tempo_trabalho: tt, campos_pendentes: clearPendente(form, "tempo_trabalho") },
          {},
          "cep",
          now,
        ),
      };
    }
    case "cnpj": {
      if (skip) {
        return skipField(form, "cnpj", "tempo_empresa", now);
      }
      if (!isValidCnpj(value)) {
        return { form, reply: "CNPJ inválido. Confira os números ou *pular*." };
      }
      return {
        form: afterField(
          {
            ...form,
            cnpj: normalizeCnpj(value),
            campos_pendentes: clearPendente(form, "cnpj"),
          },
          {},
          "tempo_empresa",
          now,
        ),
      };
    }
    case "tempo_empresa": {
      if (skip) {
        return skipField(form, "tempo_empresa", "cep", now);
      }
      const te = value.slice(0, 80);
      if (te.length < 2) {
        return { form, reply: "Tempo de empresa ou *pular*." };
      }
      return {
        form: afterField(
          { ...form, tempo_empresa: te, campos_pendentes: clearPendente(form, "tempo_empresa") },
          {},
          "cep",
          now,
        ),
      };
    }
    case "cep": {
      if (skip) {
        return skipField(form, "cep", "renda", now, [
          "cep", "logradouro", "numero", "bairro", "cidade", "uf", "complemento",
        ]);
      }
      if (!isValidCep(value)) {
        return { form, reply: "CEP inválido. Envie 8 dígitos ou *pular*." };
      }
      return {
        form: {
          ...form,
          cep: normalizeCep(value),
          campos_pendentes: clearPendente(form, "cep"),
          updated_at: now,
        },
        needsCepLookup: true,
      };
    }
    case "numero": {
      if (skip) {
        return skipField(form, "numero", "complemento", now, ["numero"]);
      }
      const numero = value.slice(0, 20);
      if (!numero) {
        return { form, reply: "Informe o número ou *pular*." };
      }
      return {
        form: afterField(
          { ...form, numero, campos_pendentes: clearPendente(form, "numero") },
          {},
          "complemento",
          now,
        ),
      };
    }
    case "complemento": {
      if (skip) {
        return skipField(form, "complemento", "renda", now, ["complemento"]);
      }
      return {
        form: afterField(
          { ...form, complemento: value.slice(0, 80), campos_pendentes: clearPendente(form, "complemento") },
          {},
          "renda",
          now,
        ),
      };
    }
    case "renda": {
      if (skip) {
        return skipField(form, "renda", "cnh", now, ["renda_mensal"]);
      }
      const renda = parseMoneyBrl(value);
      if (renda == null) {
        return { form, reply: "Valor inválido. Ex.: 4500 ou *pular*." };
      }
      return {
        form: afterField(
          {
            ...form,
            renda_mensal: String(renda),
            campos_pendentes: clearPendente(form, "renda"),
          },
          {},
          "cnh",
          now,
        ),
      };
    }
    case "referencia_nome": {
      if (skip) {
        return skipField(form, "referencia_nome", "telefone_referencia", now);
      }
      const nome = value.slice(0, 120);
      if (nome.length < 2) {
        return { form, reply: "Nome da referência ou *pular*." };
      }
      return {
        form: afterField(
          {
            ...form,
            referencia_nome: nome,
            campos_pendentes: clearPendente(form, "referencia_nome"),
          },
          {},
          "telefone_referencia",
          now,
        ),
      };
    }
    case "telefone_referencia": {
      if (skip) {
        return skipField(form, "telefone_referencia", "entrada", now);
      }
      if (!isValidBrazilMobilePhone(value)) {
        return { form, reply: "Telefone inválido ou *pular*." };
      }
      return {
        form: afterField(
          {
            ...form,
            telefone_referencia: value.replace(/\D/g, ""),
            campos_pendentes: clearPendente(form, "telefone_referencia"),
          },
          {},
          "entrada",
          now,
        ),
      };
    }
    case "entrada": {
      if (skip) {
        return skipField(form, "entrada", "prazo", now, ["entrada"]);
      }
      const entrada = parseMoneyBrl(value);
      if (entrada == null) {
        return { form, reply: "Valor inválido ou *pular*." };
      }
      return {
        form: afterField(
          {
            ...form,
            entrada: String(entrada),
            campos_pendentes: clearPendente(form, "entrada"),
          },
          {},
          "prazo",
          now,
        ),
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
        "Não encontrei esse CEP. Confira os números, digite *pular* ou tente de novo.",
    };
  }
  const summary =
    `${addr.logradouro || "—"}, ${addr.bairro || "—"} — ${addr.localidade}/${addr.uf}`;
  const next = afterField(
    {
      ...form,
      logradouro: addr.logradouro,
      bairro: addr.bairro,
      cidade: addr.localidade,
      uf: addr.uf,
    },
    {},
    "numero",
    now,
  );
  return {
    form: next,
    reply: `Endereço: ${summary}\nQual o *número*? (ou *pular*)`,
  };
}

export function applyFinanciamentoPrazo(
  form: VitrineEstoqueForm,
  prazoMeses: number,
  now: string,
): AdvanceFinanciamentoResult {
  let prazo = prazoMeses;
  if (!FINANCIAMENTO_PRAZO_OPTIONS.includes(prazo as typeof FINANCIAMENTO_PRAZO_OPTIONS[number])) {
    const parsed = parsePrazoMeses(String(prazoMeses));
    if (!parsed) {
      return { form, reply: "Escolha um prazo na lista." };
    }
    prazo = parsed;
  }
  return {
    form: afterField(
      {
        ...form,
        prazo_meses: String(prazo),
        campos_pendentes: clearPendente(form, "prazo"),
      },
      {},
      "resumo",
      now,
    ),
  };
}

export function beginFinanciamentoCorrecao(
  form: VitrineEstoqueForm,
  fieldKey: string,
  now: string,
): VitrineEstoqueForm {
  const step = fieldKey === "prazo" ? "prazo"
    : fieldKey === "renda" ? "renda"
    : fieldKey === "possui_cnh" ? "cnh"
    : fieldKey;
  return {
    ...form,
    step,
    fin_corrigindo: true,
    updated_at: now,
  };
}

export function perfilLabel(perfil?: string | null): string {
  switch (perfil) {
    case "assalariado": return "Assalariado";
    case "autonomo": return "Autônomo";
    case "empresario": return "Empresário";
    case "aposentado": return "Aposentado";
    default: return "—";
  }
}

export function buildFinanciamentoResumoText(form: VitrineEstoqueForm): string {
  const lines: string[] = [
    "*Revise sua ficha de financiamento:*",
    "",
    `Nome: ${form.nome_completo ?? "— (pendente)"}`,
    `CPF: ${form.cpf_cnpj ? maskCpfForClienteResumo(form.cpf_cnpj) : "— (pendente)"}`,
    `Nascimento: ${form.data_nascimento ?? "— (pendente)"}`,
    `E-mail: ${form.email ?? "— (pendente)"}`,
    `Tempo de residência: ${form.tempo_residencia ?? "— (pendente)"}`,
    `Perfil: ${perfilLabel(form.perfil)}`,
  ];
  if (form.perfil === "assalariado") {
    lines.push(`Empresa: ${form.empresa ?? "— (pendente)"}`);
    lines.push(`Tempo de trabalho: ${form.tempo_trabalho ?? "— (pendente)"}`);
  }
  if (form.perfil === "autonomo" || form.perfil === "empresario") {
    lines.push(`CNPJ: ${form.cnpj ? "Informado" : "— (pendente)"}`);
    lines.push(`Tempo de empresa: ${form.tempo_empresa ?? "— (pendente)"}`);
  }
  const endereco = form.cep
    ? `${form.logradouro ?? ""}, ${form.numero ?? "s/n"} — ${form.bairro ?? ""}, ${form.cidade ?? ""}/${form.uf ?? ""} · CEP ${form.cep}`
    : "— (pendente)";
  lines.push(`Endereço: ${endereco}`);
  lines.push(`Renda: ${form.renda_mensal ? "Informada (consultor verá no painel)" : "— (pendente)"}`);
  lines.push(`CNH: ${
    form.possui_cnh === true ? "Sim" : form.possui_cnh === false ? "Não" : "— (pendente)"
  }`);
  lines.push(`Referência: ${form.referencia_nome ?? "—"} · ${form.telefone_referencia ?? "—"}`);
  lines.push(`Entrada: ${form.entrada ? "Informada" : "— (pendente)"}`);
  lines.push(`Prazo: ${form.prazo_meses ? `${form.prazo_meses} meses` : "— (pendente)"}`);
  const pend = form.campos_pendentes ?? [];
  if (pend.length) {
    lines.push("");
    lines.push(`_Campos para o consultor completar: ${pend.join(", ")}_`);
  }
  lines.push("");
  lines.push("Está tudo certo?");
  return lines.join("\n");
}

export function promptFinanciamentoStep(
  form: VitrineEstoqueForm,
  pending: PendingVitrineEstoque | null | undefined,
): string {
  switch (form.step) {
    case "nome_completo":
      return String(pending?.cliente_nome || "").trim()
        ? "Qual seu *nome completo* (como no documento)? (ou *pular*)"
        : "Qual seu *nome completo*? (ou *pular*)";
    case "cpf_cnpj":
      return "Qual seu *CPF*? (ou *pular*)";
    case "data_nascimento":
      return "Data de *nascimento* (DD/MM/AAAA) ou *pular*";
    case "email":
      return "Qual seu *e-mail*? (ou *pular*)";
    case "tempo_residencia":
      return "Há quanto tempo mora nesse endereço/cidade? (ou *pular*)";
    case "empresa":
      return "Onde você trabalha? (nome da empresa) ou *pular*";
    case "tempo_trabalho":
      return "Há quanto tempo nessa empresa? (ou *pular*)";
    case "cnpj":
      return "CNPJ da sua atividade/empresa (ou *pular*)";
    case "tempo_empresa":
      return "Há quanto tempo nessa atividade? (ou *pular*)";
    case "cep":
      return "Qual o *CEP*? (ou *pular*)";
    case "numero":
      return "Número do endereço (ou *pular*)";
    case "complemento":
      return "Complemento (ou *pular*)";
    case "renda":
      return "Renda mensal aproximada (ou *pular*)";
    case "referencia_nome":
      return "Nome da *referência pessoal* (ou *pular*)";
    case "telefone_referencia":
      return "Telefone da referência (DDD + número) ou *pular*";
    case "entrada":
      return "Valor de *entrada* desejada (ou *pular*)";
    case "prazo":
      return "Escolha o *prazo* em meses:";
    default:
      return "Digite *cancelar* para sair.";
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
  if (!f.lgpd_aceite_em) return null;
  const renda = f.renda_mensal ? parseMoneyBrl(f.renda_mensal) : null;
  const prazo = f.prazo_meses ? parsePrazoMeses(f.prazo_meses) : null;
  const entrada = f.entrada ? parseMoneyBrl(f.entrada) : null;
  return {
    user_id: input.userId,
    veiculo_id: f.veiculo_id ?? null,
    whatsapp_from: input.fromNumber,
    whatsapp_contact_name: input.contactName ?? null,
    cliente_nome_vitrine: input.pending?.cliente_nome ?? null,
    lgpd_aceite_em: f.lgpd_aceite_em,
    tipo_pessoa: "pf",
    nome_completo: f.nome_completo ?? null,
    cpf_cnpj: f.cpf_cnpj ?? null,
    data_nascimento: f.data_nascimento ?? null,
    email: f.email ?? null,
    tempo_residencia: f.tempo_residencia ?? null,
    perfil: (f.perfil as FinanciamentoPerfil) ?? null,
    empresa: f.empresa ?? null,
    tempo_trabalho: f.tempo_trabalho ?? null,
    cnpj: f.cnpj ?? null,
    tempo_empresa: f.tempo_empresa ?? null,
    possui_cnh: f.possui_cnh ?? null,
    cep: f.cep ?? null,
    logradouro: f.logradouro ?? null,
    numero: f.numero ?? null,
    complemento: f.complemento ?? null,
    bairro: f.bairro ?? null,
    cidade: f.cidade ?? null,
    uf: f.uf ?? null,
    renda_mensal: renda,
    referencia_nome: f.referencia_nome ?? null,
    telefone_referencia: f.telefone_referencia ?? null,
    entrada,
    prazo_meses: prazo,
    campos_pendentes: f.campos_pendentes ?? [],
  };
}

export function buildRecadoFinanciamentoFichaSemPii(input: {
  clienteNome: string;
  contactName?: string | null;
  fromNumber: string;
  vehicle: VeiculoVitrineRow;
  fichaId: string;
  camposPendentes?: string[];
}): string {
  const titulo = vehicleTitleFn(input.vehicle);
  const clienteLine = formatRecadoClienteLine({
    clienteNome: input.clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
  });
  const pend = input.camposPendentes?.length
    ? `Pendências para consultor: ${input.camposPendentes.join(", ")}.`
    : null;
  return [
    clienteLine,
    `Enviou ficha de financiamento do ${titulo}.`,
    `Veículo (estoque): ${input.vehicle.id}`,
    `Ficha (painel): ${input.fichaId}`,
    pend,
    "Dados sensíveis só no painel /veiculos/financiamento — não replicar por WhatsApp.",
    "Ação: analisar simulação e retornar contato.",
  ].filter(Boolean).join("\n");
}

export function skipFinanciamentoInteractiveStep(
  form: VitrineEstoqueForm,
  step: string,
  now: string,
): AdvanceFinanciamentoResult {
  if (step === "perfil") {
    return skipField(form, "perfil", "cep", now, ["perfil"]);
  }
  if (step === "cnh") {
    return skipField(form, "possui_cnh", "referencia_nome", now, ["possui_cnh"]);
  }
  return { form };
}

export function confirmacaoFinanciamentoFicha(nomeEmpresa?: string | null): string {
  const nome = String(nomeEmpresa || "").trim() || "nossa loja";
  return (
    `Recebi sua ficha de financiamento! A equipe da ${nome} vai analisar e retorna em breve. ` +
    "Obrigado pela confiança."
  );
}
