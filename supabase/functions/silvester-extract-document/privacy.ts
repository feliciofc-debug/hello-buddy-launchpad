export const SILVESTER_AI_GATEWAY_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

const TEXT_EXTRACTION_PROMPT =
  `Analise a conversa abaixo (cliente falando com o Silvester sobre consórcio) e extraia SÓ os dados que o CLIENTE mencionou explicitamente. Devolva JSON puro:

{
  "nome_completo": "...",
  "cpf": "...",
  "data_nascimento": "YYYY-MM-DD",
  "estado_civil": "solteiro|casado|divorciado|viuvo|uniao_estavel",
  "profissao": "...",
  "renda_mensal": 0,
  "email": "...",
  "telefone_alternativo": "...",
  "endereco_cidade": "...",
  "endereco_estado": "UF",
  "interesse_bem": "auto|imovel|servico|moto|caminhao",
  "interesse_valor_carta": 0,
  "interesse_prazo_meses": 0,
  "interesse_aceita_lance": true|false,
  "interesse_observacoes": "..."
}

Regras:
- OMITA chaves que o cliente não mencionou (não invente, não deduza).
- renda_mensal e interesse_valor_carta em número puro (sem R$).
- Devolva JSON PURO. Nada mais.

CONVERSA:
`;

export async function extractSilvesterConversationText(input: {
  text: string;
  apiKey: string;
  fetchFn?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const body = {
    model: "google/gemini-2.5-flash",
    messages: [{
      role: "user",
      content: TEXT_EXTRACTION_PROMPT + input.text,
    }],
  };
  const serialized = JSON.stringify(body);
  if (
    /data:[^;,]+;base64,/i.test(serialized) ||
    /"(?:image_url|file_data|inline_data|inlineData|media)"\s*:/i.test(
      serialized,
    )
  ) {
    throw new Error("silvester_media_payload_blocked");
  }
  const response = await (input.fetchFn ?? fetch)(SILVESTER_AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: serialized,
  });
  if (!response.ok) return {};
  const data = await response.json();
  const raw = String(data?.choices?.[0]?.message?.content ?? "{}");
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
