/** Mensagem amigável para erros do laudo IA (edge → painel). */
export function humanizeGestaoTrocaIaErro(raw: string | null | undefined): string {
  const msg = String(raw ?? "").trim();
  if (!msg) return "A análise não pôde ser concluída. Tente novamente em instantes.";
  if (/LOVABLE_API_KEY/i.test(msg)) {
    return "Serviço de IA não configurado no servidor. Contate o suporte AMZ.";
  }
  if (/visão indisponível|Falha ao chamar visão/i.test(msg)) {
    return "Serviço de visão temporariamente indisponível. Tente novamente mais tarde.";
  }
  if (/Nenhuma foto elegível/i.test(msg)) {
    return "Envie fotos da troca (exceto CRLV) antes de analisar.";
  }
  if (/JSON inválido|Resposta não é objeto/i.test(msg)) {
    return "A IA retornou resposta inválida. Tente analisar novamente.";
  }
  if (/análise em andamento|processamento/i.test(msg)) {
    return "Já existe uma análise em andamento nesta troca.";
  }
  return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
}
