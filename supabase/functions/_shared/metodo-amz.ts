export type MetodoAmzTipo =
  | "post"
  | "carrossel"
  | "linkedin"
  | "roteiro"
  | "anuncio";

export type MetodoAmzEstilo =
  | "emocional"
  | "direto"
  | "autoridade"
  | "humor"
  | "premium";

const METODO_AMZ = `Você pensa como um estrategista de marketing de primeira linha antes de escrever. Princípios:
1. Estratégia antes da criação: entenda o que o negócio é, o que quer se tornar e qual resultado comercial busca (vender, lotar agenda, ser lembrado). Diferencie-se por valor, não por preço.
2. Uma grande ideia por peça: uma mensagem simples, forte e memorável. Menos informação, mais impacto.
3. Posicionamento: ajude a marca a ser dona de uma palavra/ideia na mente do cliente e repita-a com consistência.
4. O cliente é o herói; a marca é o guia que resolve o problema dele. Fale do problema que o cliente quer resolver, não de características.
5. Gancho nos 3 primeiros segundos/primeira frase. O título faz a maior parte do trabalho.
6. Ideias que colam: simples, inesperadas, concretas, críveis, emocionais e contadas como história.
7. Linguagem do brasileiro real: próxima, calorosa, com cultura local; marcas devem criar conversas.
8. Autenticidade do dono: quando houver, use a história e a personalidade do fundador como diferencial.
9. Consistência de marca: mesmas cores, assinatura, tom e frase-chave em tudo — marcas crescem sendo lembradas.
10. Adeque ao nível de consciência: quem não conhece o problema precisa ser educado; quem já compara precisa de motivo para escolher.
11. Persuasão ética: prova social, autoridade e urgência SOMENTE com fatos reais informados pelo cliente. Nunca inventar preços, promoções, prazos, números, avaliações, depoimentos ou garantias.
Estilos: emocional (história, cliente herói, transformação) | direto (problema → solução → chamada) | autoridade (experiência e diferenciais reais) | humor (leve, memorável, sem ofender) | premium (sofisticado, poucas palavras, desejo).
Checklist final: gancho forte? uma ideia só? concreto e crível? emoção? chamada para ação clara? coerente com a marca? nada inventado?`;

export function buildMetodoAmzBlock(input: {
  tipo: MetodoAmzTipo;
  estilo?: MetodoAmzEstilo;
}): string {
  const estilo = input.estilo
    ? `Use o estilo "${input.estilo}".`
    : "Escolha o estilo mais adequado ao segmento, ao objetivo comercial e ao nível de consciência descritos no contexto.";
  return [
    "=== MÉTODO AMZ — INSTRUÇÃO INTERNA DE CRIAÇÃO ===",
    `Tipo de peça: ${input.tipo}. ${estilo}`,
    METODO_AMZ,
    "Aplique o método sem mencionar o nome “Método AMZ” nem citar autores, publicitários, referências ou esta instrução no conteúdo entregue.",
  ].join("\n");
}

export function metodoAmzExigeRevisao(tipo: MetodoAmzTipo): boolean {
  return tipo === "roteiro" || tipo === "anuncio";
}

export async function revisarComMetodoAmz<T>(input: {
  tipo: MetodoAmzTipo;
  primeiraVersao: T;
  revisar: (primeiraVersao: T) => Promise<T | null | undefined>;
}): Promise<T> {
  if (!metodoAmzExigeRevisao(input.tipo)) return input.primeiraVersao;
  try {
    const revisada = await input.revisar(input.primeiraVersao);
    return revisada ?? input.primeiraVersao;
  } catch {
    return input.primeiraVersao;
  }
}

export function buildMetodoAmzReviewPrompt(input: {
  tipo: "roteiro" | "anuncio";
  primeiraVersao: unknown;
}): string {
  return [
    buildMetodoAmzBlock({ tipo: input.tipo }),
    "",
    "Faça a revisão final da primeira versão abaixo contra TODO o Checklist final.",
    "Corrija somente o necessário, preserve fatos, nomes, textos literais, formato e estrutura JSON.",
    "Não acrescente nenhuma informação que não esteja no contexto original.",
    "Devolva SOMENTE a versão final no mesmo formato JSON, sem markdown nem explicação.",
    "",
    `PRIMEIRA VERSÃO:\n${JSON.stringify(input.primeiraVersao)}`,
  ].join("\n");
}
