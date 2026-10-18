export function injectForcedFetchAsSystemContext(
  messages: Array<Record<string, unknown>>,
  blocks: string[],
): void {
  if (!blocks.length) return;
  const content = `Dados obtidos agora para responder o usuário (cotação/pesquisa web):\n\n${blocks.join("\n\n")}`;
  messages.splice(messages.length - 1, 0, { role: "system", content });
}

export function messagesHaveAssistantToolCalls(messages: unknown[]): boolean {
  return messages.some((m) => {
    const msg = m as { role?: string; tool_calls?: unknown[] };
    return msg?.role === "assistant" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
  });
}

/** Converte pares assistant.tool_calls + tool em bloco system (retry thought_signature). */
export function stripToolCallsToSystemContext(messages: unknown[]): unknown[] {
  const out: unknown[] = [];
  let i = 0;
  const list = [...messages];
  while (i < list.length) {
    const m = list[i] as {
      role?: string;
      tool_calls?: Array<{ id?: string; function?: { name?: string } }>;
      content?: unknown;
    };
    if (m?.role === "assistant" && m.tool_calls?.length) {
      const chunks: string[] = [];
      const ids = new Set(m.tool_calls.map((tc) => tc.id).filter(Boolean));
      let j = i + 1;
      while (j < list.length) {
        const tm = list[j] as { role?: string; tool_call_id?: string; content?: unknown };
        if (tm?.role !== "tool" || !ids.has(tm.tool_call_id)) break;
        const fn = m.tool_calls.find((tc) => tc.id === tm.tool_call_id)?.function?.name ?? "ferramenta";
        chunks.push(`[${fn}]\n${String(tm.content ?? "")}`);
        j++;
      }
      if (chunks.length) {
        out.push({
          role: "system",
          content: `Dados de ferramentas (histórico convertido para texto):\n\n${chunks.join("\n\n")}`,
        });
      }
      i = j;
      continue;
    }
    out.push(list[i]);
    i++;
  }
  return out;
}
