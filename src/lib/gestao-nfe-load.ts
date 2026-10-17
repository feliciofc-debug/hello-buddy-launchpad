import { supabase } from "@/integrations/supabase/client";
import type { GestaoNfeOperacaoKey, GestaoNfeOperacoesJson } from "../../supabase/functions/_shared/gestao-nfe-config-default.ts";

export type GestaoNfeRow = {
  id: string;
  veiculo_id: string | null;
  tipo_operacao: GestaoNfeOperacaoKey;
  status: string;
  valor_total: number | null;
  numero: number | null;
  serie: number | null;
  chave_acesso: string | null;
  danfe_url: string | null;
  xml_url: string | null;
  mensagem_status: string | null;
  created_at: string;
  authorized_at: string | null;
};

export type GestaoNfeConfigRow = {
  cnpj: string;
  inscricao_estadual: string;
  regime_tributario: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  operacoes_json: GestaoNfeOperacoesJson;
};

export async function loadGestaoNfeList(userId: string): Promise<GestaoNfeRow[]> {
  const { data } = await supabase.from("gestao_nfe" as "veiculos_estoque")
    .select(
      "id, veiculo_id, tipo_operacao, status, valor_total, numero, serie, chave_acesso, danfe_url, xml_url, mensagem_status, created_at, authorized_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as GestaoNfeRow[];
}

export async function fetchGestaoNfeConfig(): Promise<GestaoNfeConfigRow | null> {
  const { data, error } = await supabase.functions.invoke("gestao-nfe-config-get");
  if (error || !data?.success) return null;
  return data.config as GestaoNfeConfigRow;
}

export async function saveGestaoNfeConfig(config: GestaoNfeConfigRow) {
  return supabase.functions.invoke("gestao-nfe-config-save", { body: config });
}
