import type { LucideIcon } from "lucide-react";

export type AppSidebarItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  highlight?: boolean;
};

/** Itens de menu / atalhos ocultos no modo AMZ Auto (catálogo genérico AMZ Ofertas). */
export const AMZ_AUTO_HIDDEN_MENU_IDS = [
  "produtos",
  "ebook-presente",
  "contatos-comerciais",
] as const;

const AMZ_AUTO_HIDDEN_IDS = new Set<string>(AMZ_AUTO_HIDDEN_MENU_IDS);

/** Relatório UX-1.5 — UI de produtos escondida fora do escopo veículos. */
export const AMZ_AUTO_HIDDEN_PRODUTOS_UI_REPORT: readonly string[] = [
  "Menu lateral: item «produtos» (/meus-produtos)",
  "Menu lateral: item «ebook-presente» (/pj/ebook-presente)",
  "Menu lateral: item «contatos-comerciais» (/pj/contatos-comerciais)",
  "Dashboard: atalho «Criar campanha» que levava a /meus-produtos (redireciona para /ia-marketing)",
];

export function isAmzAutoProdutosPath(pathname: string): boolean {
  return (
    pathname === "/produtos" ||
    pathname === "/meus-produtos" ||
    pathname.startsWith("/admin/produtos") ||
    pathname.startsWith("/afiliado/produtos")
  );
}

/** Ordem do menu no modo AMZ Auto (demais ids ficam no fim, se existirem). */
const AMZ_AUTO_ORDER = [
  "dashboard",
  "veiculos",
  "financiamentos",
  "gestao-lucro",
  "whatsapp",
  "whatsapp-templates",
  "leads",
  "midias",
  "ia-marketing",
  "redes-sociais",
  "anuncios-meta",
  "integracoes-portais",
  "clientes-segmentos",
  "minha-marca",
  "minha-empresa",
  "configuracoes",
  "admin",
] as const;

function orderIndex(id: string): number {
  const idx = AMZ_AUTO_ORDER.indexOf(id as (typeof AMZ_AUTO_ORDER)[number]);
  return idx === -1 ? AMZ_AUTO_ORDER.length + 1 : idx;
}

export function applyAmzAutoMenuFilter(
  fullMenu: readonly AppSidebarItem[],
  extras?: {
    leadsItem?: AppSidebarItem;
    integracoesPortaisItem?: AppSidebarItem;
  },
): AppSidebarItem[] {
  const byId = new Map<string, AppSidebarItem>();
  for (const item of fullMenu) {
    if (!AMZ_AUTO_HIDDEN_IDS.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  if (extras?.leadsItem && !byId.has("leads")) {
    byId.set("leads", extras.leadsItem);
  }
  if (extras?.integracoesPortaisItem && !byId.has("integracoes-portais")) {
    byId.set("integracoes-portais", extras.integracoesPortaisItem);
  }

  return [...byId.values()].sort(
    (a, b) => orderIndex(a.id) - orderIndex(b.id),
  );
}
