import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Gauge,
  FileSignature,
  LayoutDashboard,
  Receipt,
  Settings2,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type GestaoLucroAba =
  | "estoque"
  | "giro"
  | "vendidos"
  | "despesas"
  | "equipe"
  | "financeiro"
  | "contratos"
  | "notas"
  | "relatorios";

export const GESTAO_ABA_DEFAULT: GestaoLucroAba = "estoque";

const VALID_ABAS = new Set<string>([
  "estoque",
  "giro",
  "vendidos",
  "despesas",
  "equipe",
  "financeiro",
  "contratos",
  "notas",
  "relatorios",
]);

export function parseGestaoLucroAba(raw: string | null): GestaoLucroAba {
  if (raw && VALID_ABAS.has(raw)) return raw as GestaoLucroAba;
  return GESTAO_ABA_DEFAULT;
}

export function gestaoLucroUrl(
  aba?: GestaoLucroAba | null,
  extra?: { secao?: string },
): string {
  const params = new URLSearchParams();
  if (aba && aba !== GESTAO_ABA_DEFAULT) params.set("aba", aba);
  if (extra?.secao) params.set("secao", extra.secao);
  const q = params.toString();
  return q ? `/gestao/lucro?${q}` : "/gestao/lucro";
}

export type GestaoSidebarItem = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  matchAba?: GestaoLucroAba | null;
  matchPrefix?: string;
};

export const GESTAO_SIDEBAR_ITEMS: GestaoSidebarItem[] = [
  { id: "gestao-visao", label: "Visão geral", path: "/gestao/lucro", icon: LayoutDashboard, matchAba: "estoque" },
  { id: "gestao-operacoes", label: "Operações / OS", path: "/gestao/operacoes", icon: Wrench, matchPrefix: "/gestao/operacoes" },
  { id: "gestao-giro", label: "Giro 30-60-90", path: gestaoLucroUrl("giro"), icon: Gauge, matchAba: "giro" },
  { id: "gestao-vendas", label: "Vendas e faturamento", path: gestaoLucroUrl("vendidos"), icon: ShoppingCart, matchAba: "vendidos" },
  { id: "gestao-notas", label: "Notas fiscais", path: gestaoLucroUrl("notas"), icon: Receipt, matchAba: "notas" },
  { id: "gestao-contratos", label: "Contratos", path: gestaoLucroUrl("contratos"), icon: FileSignature, matchAba: "contratos" },
  { id: "gestao-financeiro", label: "Financeiro", path: gestaoLucroUrl("financeiro"), icon: Wallet, matchAba: "financeiro" },
  { id: "gestao-equipe", label: "Equipe e comissões", path: gestaoLucroUrl("equipe"), icon: Users, matchAba: "equipe" },
  { id: "gestao-relatorios", label: "Relatórios", path: gestaoLucroUrl("relatorios"), icon: BarChart3, matchAba: "relatorios" },
  { id: "gestao-config-fiscal", label: "Configuração fiscal", path: "/gestao/configuracao-fiscal", icon: Settings2 },
];

export type GestaoCommandAction = {
  id: string;
  label: string;
  keywords: string[];
  path: string;
};

export const GESTAO_COMMAND_ACTIONS: GestaoCommandAction[] = [
  { id: "operacoes", label: "Operações e ordens de serviço", keywords: ["os", "ordem de serviço", "oficina", "preparação", "garantia"], path: "/gestao/operacoes" },
  { id: "parceiros", label: "Parceiros e fornecedores", keywords: ["parceiro", "fornecedor", "oficina", "serviço"], path: "/gestao/parceiros" },
  { id: "giro", label: "Giro 30-60-90", keywords: ["giro", "estoque parado", "repasse", "margem", "90 dias"], path: gestaoLucroUrl("giro") },
  { id: "nota", label: "Notas fiscais", keywords: ["nota", "nfe", "fiscal", "faturar", "emitir"], path: gestaoLucroUrl("notas") },
  { id: "vendas", label: "Vendas e faturamento", keywords: ["venda", "vendidos", "faturamento", "faturar"], path: gestaoLucroUrl("vendidos") },
  { id: "contrato", label: "Contratos", keywords: ["contrato", "assinatura", "zapsign"], path: gestaoLucroUrl("contratos") },
  { id: "comissao", label: "Equipe e comissões", keywords: ["comissao", "comissão", "equipe", "vendedor", "meta"], path: gestaoLucroUrl("equipe") },
  { id: "despesa", label: "Despesas do estoque", keywords: ["despesa", "gasto", "pagar carro"], path: gestaoLucroUrl("despesas") },
  { id: "financeiro", label: "Financeiro — contas e fluxo", keywords: ["financeiro", "conta", "fluxo", "pagar", "receber"], path: gestaoLucroUrl("financeiro") },
  { id: "conciliacao", label: "Conciliação bancária", keywords: ["conciliação", "conciliacao", "extrato", "banco"], path: gestaoLucroUrl("financeiro", { secao: "conciliacao" }) },
  { id: "contador", label: "Pacote do contador", keywords: ["contador", "relatorio contador", "dre"], path: gestaoLucroUrl("financeiro", { secao: "contador" }) },
  { id: "resultado", label: "Resultado da loja (DRE)", keywords: ["resultado", "lucro loja", "dre"], path: gestaoLucroUrl("financeiro", { secao: "dre" }) },
  { id: "estoque", label: "Estoque e registrar venda", keywords: ["estoque", "carro", "registrar venda"], path: gestaoLucroUrl("estoque") },
  { id: "config-fiscal", label: "Configuração fiscal NF-e", keywords: ["cfop", "fiscal", "configuração fiscal"], path: "/gestao/configuracao-fiscal" },
  { id: "integracoes", label: "Conectar NF-e ou contratos", keywords: ["conectar", "focus", "integração"], path: "/gestao/lucro?conectar=nfe" },
];

export function isGestaoRoute(pathname: string): boolean {
  return pathname.startsWith("/gestao/");
}

export function gestaoSidebarActive(
  pathname: string,
  search: string,
  item: GestaoSidebarItem,
): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
  if (item.path === "/gestao/configuracao-fiscal") {
    return pathname === item.path;
  }
  if (!pathname.startsWith("/gestao/lucro")) return false;
  const params = new URLSearchParams(search);
  const aba = parseGestaoLucroAba(params.get("aba"));
  if (item.matchAba === "estoque") {
    return aba === "estoque" && !params.get("secao");
  }
  return item.matchAba === aba;
}

/** Ícone do grupo Gestão no menu lateral */
export const GESTAO_GROUP_ICON = TrendingUp;
