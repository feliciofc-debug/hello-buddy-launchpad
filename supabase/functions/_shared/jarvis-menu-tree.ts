import {
  JARVIS_AJUDA_CATALOGO,
  JARVIS_MENU_LISTS,
  type JarvisAjudaItem,
  type JarvisMenuList,
} from "./jarvis-ajuda-catalogo.ts";

export type JarvisMenuTreeRow = {
  id: string;
  title: string;
  description: string;
  kind: "recent" | "list" | "item" | "back";
  order: number;
  item?: JarvisAjudaItem;
  list?: JarvisMenuList;
};

function recentDescriptions(list: JarvisMenuList): [string, string] {
  if (list.id === "marketing") {
    return [
      "Última ação de Marketing usada neste WhatsApp.",
      "Segunda ação recente de Marketing.",
    ];
  }
  if (list.id === "gestao") {
    return [
      "Última ação de Gestão usada neste WhatsApp.",
      "Segunda ação recente de Gestão.",
    ];
  }
  if (list.id === "vistoria_troca") {
    return [
      "Última ação de Vistoria e Troca usada.",
      "Segunda ação recente desta lista.",
    ];
  }
  return [
    "Atalho recente desta lista.",
    "Segundo atalho recente desta lista.",
  ];
}

export function jarvisMenuRows(listId: string): JarvisMenuTreeRow[] {
  const list = JARVIS_MENU_LISTS.find((candidate) => candidate.id === listId);
  if (!list) throw new Error(`Lista de menu inexistente: ${listId}`);

  const rows: JarvisMenuTreeRow[] = [];
  if (list.recentSlots === 2) {
    const descriptions = recentDescriptions(list);
    rows.push(
      {
        id: `${list.id}:recent:1`,
        title: "Usado recentemente 1",
        description: descriptions[0],
        kind: "recent",
        order: -20,
      },
      {
        id: `${list.id}:recent:2`,
        title: "Usado recentemente 2",
        description: descriptions[1],
        kind: "recent",
        order: -10,
      },
    );
  }

  for (
    const child of JARVIS_MENU_LISTS.filter((candidate) =>
      candidate.parentId === list.id
    )
  ) {
    rows.push({
      id: `list:${child.id}`,
      title: child.title,
      description: child.description,
      kind: "list",
      order: child.order,
      list: child,
    });
  }

  for (
    const item of JARVIS_AJUDA_CATALOGO.filter((candidate) =>
      candidate.menu.visible && candidate.menu.parentId === list.id
    )
  ) {
    rows.push({
      id: item.id,
      title: item.menu.title,
      description: item.menu.description,
      kind: "item",
      order: item.menu.order,
      item,
    });
  }

  if (list.parentId) {
    rows.push({
      id: `back:${list.parentId}`,
      title: list.backTitle ?? "Voltar",
      description: list.backDescription ?? "Retorne à lista anterior.",
      kind: "back",
      order: 1_000,
    });
  }

  return rows.sort((a, b) =>
    a.order - b.order || a.title.localeCompare(b.title, "pt-BR")
  );
}

function audiencesLabel(item: JarvisAjudaItem): string {
  return item.menu.audiences.join(", ");
}

function destinationLabel(row: JarvisMenuTreeRow): string {
  if (row.kind === "recent") return "Dinâmico (B7)";
  if (row.kind === "list") return `Lista \`${row.list!.id}\``;
  if (row.kind === "back") return "Lista anterior";
  const item = row.item!;
  if (item.route.type === "panel") {
    return `[link](${item.route.href}) + ${item.route.path}`;
  }
  if (item.route.type === "llm_tool") {
    return `WhatsApp · tool \`${item.route.name}\``;
  }
  if (item.route.type === "gestao_intent") {
    return `WhatsApp · intent \`${item.route.kind}\``;
  }
  if (item.route.type === "owner_media") {
    return `WhatsApp · mídia \`${item.route.action}\``;
  }
  return `WhatsApp · handler \`${item.route.name}\``;
}

function markdownTitle(raw: string): string {
  return raw.replace(/[📣📊🔍]/gu, "").replace(/\s*›\s*$/u, "").trim();
}

export function renderJarvisMenuTreeMarkdown(): string {
  const rootLists = JARVIS_MENU_LISTS.filter((list) => !list.parentId)
    .sort((a, b) => a.order - b.order);
  const lines = [
    "# Árvore do menu do Jarvis",
    "",
    "> Gerado de `jarvis-ajuda-catalogo.ts`. Não editar manualmente.",
    "> Os dois atalhos recentes são slots do B7 e contam no limite de 10 linhas.",
    "",
    "## Abertura",
    "",
    ...rootLists.map((list, index) =>
      `${index + 1}. **${list.title}** — ${list.description}`
    ),
    "",
  ];

  for (const list of JARVIS_MENU_LISTS) {
    lines.push(
      `${list.parentId ? "###" : "##"} ${markdownTitle(list.title)}`,
      "",
      `ID da lista: \`${list.id}\``,
      "",
      "| # | Título | Descrição | Destino | Audiências |",
      "|---:|---|---|---|---|",
    );
    jarvisMenuRows(list.id).forEach((row, index) => {
      const audiences = row.item
        ? audiencesLabel(row.item)
        : row.list?.audiences.join(", ") ?? "herdada";
      lines.push(
        `| ${index + 1} | ${row.title} | ${row.description} | ${
          destinationLabel(row)
        } | ${audiences} |`,
      );
    });
    lines.push("");
  }

  const notes = JARVIS_AJUDA_CATALOGO.filter((item) =>
    item.menu.visible && item.menu.availability.nota
  );
  lines.push("## Notas de capacidade", "");
  for (const item of notes) {
    lines.push(`- **${item.menu.title}:** ${item.menu.availability.nota}`);
  }
  lines.push("");
  return lines.join("\n");
}
