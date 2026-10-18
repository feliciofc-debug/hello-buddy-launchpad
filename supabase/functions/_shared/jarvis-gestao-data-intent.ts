function normalize(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Pergunta sobre dados internos da loja (gestão) — não deve ir para pesquisa web. */
export function isGestaoLojaDataQuestion(text: string): boolean {
  const t = normalize(text);
  if (!t || t.length < 4) return false;
  if (/\b(procura|pesquisa|pesquisar|google|internet|noticia|clima|dolar|bitcoin)\b/.test(t)) {
    return false;
  }
  const gestao =
    /\b(loja|gestao|gestão|faturamento|lucro|margem|dre|meta|comissao|comissão)\b/.test(t) ||
    /\b(vend(a|as|ido|idos|emos|eu|eu)|vendedor|vendedores|equipe|ranking)\b/.test(t) ||
    /\b(estoque|veiculo|veículo|veiculos|veículos|carro|carros|automoveis|automóveis)\b/.test(t) ||
    /\b(despesa|despesas|gastei|paguei|conta|contas|pagar|receber|venc|concili)\b/.test(t) ||
    /\b(lead|leads|conversa|conversas|atendiment|whatsapp)\b/.test(t) ||
    /\b(nfe|nota fiscal|notas fiscais)\b/.test(t) ||
    /\b(quais|quantos|quantas|quanto|lista|listar|mostra|mostre|relatorio|relatório)\b/.test(t);
  return gestao;
}
