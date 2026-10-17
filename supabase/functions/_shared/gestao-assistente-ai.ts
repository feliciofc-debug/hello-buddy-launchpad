export type GestaoAssistenteAction = { label: string; path: string };

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Reescreve levemente a resposta factual (números intactos). Sem IA, devolve factsReply. */
export async function gestaoAssistentePolishReply(
  userQuestion: string,
  factsReply: string,
  _actions: GestaoAssistenteAction[],
): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return factsReply;

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é o Jarvis da Gestão (revenda de veículos). Reescreva em português claro para o lojista. " +
              "NUNCA altere números, valores ou datas do bloco FACTS. Não invente funcionalidades. " +
              "Não execute ações; só oriente. Máximo 6 frases.",
          },
          {
            role: "user",
            content: `PERGUNTA: ${userQuestion}\n\nFACTS (preservar números):\n${factsReply}`,
          },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return factsReply;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : factsReply;
  } catch {
    return factsReply;
  }
}
