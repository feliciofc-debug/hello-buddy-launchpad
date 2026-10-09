export function hasExplicitSceneDescription(request: string): boolean {
  const text = String(request || "").trim();
  if (
    !/\b(cen[aá]rio|ambiente|fundo|mesa|cozinha|sala|quarto|praia|campo|escrit[oó]rio|caf[eé])\b/i
      .test(text)
  ) {
    return false;
  }
  const detail = text
    .replace(
      /^.*?\b(?:cen[aá]rio|ambiente|fundo)\b\s*(?:desta\s+foto)?\s*[:=-]?\s*/i,
      "",
    )
    .trim();
  return detail.length >= 8;
}

export function sceneEditDirective(request: string): string {
  const clean = String(request || "").trim();
  if (hasExplicitSceneDescription(clean)) {
    return `PEDIDO DE CENÁRIO DO USUÁRIO — INSTRUÇÃO PRINCIPAL E OBRIGATÓRIA:
"${clean}"
- Recrie exatamente o ambiente descrito acima.
- Não substitua a descrição por estúdio, showroom ou fundo genérico.
- Preserve o produto principal idêntico: mesmo formato, cores, marca, rótulo, textos, detalhes e quantidade.`;
  }
  return `CENÁRIO PADRÃO (somente porque o usuário não descreveu um ambiente):
- Use um set comercial limpo, com fundo sofisticado e iluminação suave.
- Preserve o produto principal idêntico: mesmo formato, cores, marca, rótulo, textos, detalhes e quantidade.`;
}
