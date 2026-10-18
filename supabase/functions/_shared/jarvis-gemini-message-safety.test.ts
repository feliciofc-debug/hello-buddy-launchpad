import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  injectForcedFetchAsSystemContext,
  messagesHaveAssistantToolCalls,
  stripToolCallsToSystemContext,
} from "./jarvis-gemini-message-safety.ts";

Deno.test("injectForcedFetchAsSystemContext não usa tool_calls", () => {
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: "base" },
    { role: "user", content: "oi" },
  ];
  injectForcedFetchAsSystemContext(messages, ["Cotação USD-BRL: 5.10"]);
  assertEquals(messagesHaveAssistantToolCalls(messages), false);
  assertEquals(messages.length, 3);
  assertEquals(messages[1].role, "system");
  assertEquals(String(messages[1].content).includes("Cotação"), true);
  assertEquals(messages[2].role, "user");
});

Deno.test("stripToolCallsToSystemContext remove assistant tool_calls", () => {
  const converted = stripToolCallsToSystemContext([
    { role: "user", content: "q" },
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "t1", function: { name: "pesquisar_web" } }],
    },
    { role: "tool", tool_call_id: "t1", content: "resultado" },
  ]);
  assertEquals(messagesHaveAssistantToolCalls(converted), false);
  assertEquals((converted[1] as { role: string }).role, "system");
});
