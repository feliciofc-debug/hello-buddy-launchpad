import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildLeadAoVivoOwnerMessage,
  claimLeadAoVivoDedup,
  LEAD_AO_VIVO_DEDUP_MS,
  notifyLeadAoVivoIfDue,
  shouldScheduleLeadMornoForWarmEvent,
} from "./vitrine-crm-ao-vivo.ts";
import { handleVitrineCrmAfterEvent } from "./vitrine-crm-schedule.ts";

Deno.test("buildLeadAoVivoOwnerMessage inclui emoji e linha de contato", () => {
  const msg = buildLeadAoVivoOwnerMessage({
    contactName: "Fulano",
    vehicleLabel: "BMW X6 2024",
    fromNumber: "5521999998888",
  });
  assert(msg.includes("👀 Agora: Fulano está vendo o BMW X6 2024."));
  assert(msg.includes("Cliente: Fulano"));
});

Deno.test("ao vivo: detalhe envia 1x; fotos mesmo carro não; outro carro envia de novo", async () => {
  const sends: string[] = [];
  const aoVivoRows = new Map<string, { sent_at: string }>();
  const sb = makeAoVivoSb(aoVivoRows);
  const env = { supabaseUrl: "https://x", serviceKey: "k" };
  const base = {
    userId: "u1",
    contactNumber: "5521888888888",
    contactName: "Fulano",
    veiculoId: "v1",
    vehicleLabel: "BMW X6 2024",
  };
  const sendOwner = async (_sb: unknown, input: { message: string }) => {
    sends.push(input.message);
    return true;
  };

  assertEquals(
    await notifyLeadAoVivoIfDue(sb, env, { ...base, evento: "detalhe" }, { sendOwner }),
    true,
  );
  assertEquals(sends.length, 1);

  assertEquals(
    await notifyLeadAoVivoIfDue(sb, env, { ...base, evento: "fotos" }, { sendOwner }),
    false,
  );
  assertEquals(sends.length, 1);

  assertEquals(
    await notifyLeadAoVivoIfDue(sb, env, {
      ...base,
      evento: "detalhe",
      veiculoId: "v2",
      vehicleLabel: "Audi A3",
    }, { sendOwner }),
    true,
  );
  assertEquals(sends.length, 2);
});

Deno.test("ao vivo off: não envia imediato; agenda lead morno 10 min", async () => {
  const sends: string[] = [];
  const leadAgendaUpserts: Record<string, unknown>[] = [];
  const sb = makeScheduleTestSb({
    leadAoVivo: false,
    leadMornoAtivo: true,
    onLeadAgendaUpsert: (row) => leadAgendaUpserts.push(row),
  });
  const env = { supabaseUrl: "https://x", serviceKey: "k" };
  const sendOwner = async (_sb: unknown, input: { message: string }) => {
    sends.push(input.message);
    return true;
  };

  await handleVitrineCrmAfterEvent(sb, {
    userId: "u1",
    contactNumber: "5521888888888",
    contactName: "Fulano",
    evento: "detalhe",
    veiculoId: "v1",
    vehicleLabel: "BMW X6 2024",
    notifyEnv: env,
  });

  await new Promise((r) => setTimeout(r, 20));

  assertEquals(sends.length, 0);
  assertEquals(leadAgendaUpserts.length, 1);
  assertEquals(leadAgendaUpserts[0]?.status, "pending");
  assert(shouldScheduleLeadMornoForWarmEvent({
    evento: "detalhe",
    leadMornoAtivo: true,
    leadAoVivo: false,
  }));
});

Deno.test("ao vivo on: envio imediato no detalhe e sem agenda 10 min", async () => {
  const leadAgendaUpserts: Record<string, unknown>[] = [];
  const aoVivoRows = new Map<string, { sent_at: string }>();
  const sb = makeScheduleTestSb({
    leadAoVivo: true,
    leadMornoAtivo: true,
    aoVivoRows,
    onLeadAgendaUpsert: (row) => leadAgendaUpserts.push(row),
  });
  const env = { supabaseUrl: "https://x", serviceKey: "k" };
  let ownerFetch = 0;
  const restore = stubOwnerFetch(() => {
    ownerFetch += 1;
    return jsonResponse({ success: true });
  });

  try {
    await handleVitrineCrmAfterEvent(sb, {
      userId: "u1",
      contactNumber: "5521888888888",
      contactName: "Fulano",
      evento: "detalhe",
      veiculoId: "v1",
      vehicleLabel: "BMW X6 2024",
      notifyEnv: env,
    });
    await new Promise((r) => setTimeout(r, 50));
    assertEquals(leadAgendaUpserts.length, 0);
    assertEquals(ownerFetch, 1);
  } finally {
    restore();
  }
});

function makeAoVivoSb(rows: Map<string, { sent_at: string }>) {
  return {
    from(table: string) {
      if (table !== "vitrine_lead_ao_vivo_enviados") {
        throw new Error(`unexpected table ${table}`);
      }
      return aoVivoChain(rows);
    },
  };
}

function aoVivoChain(rows: Map<string, { sent_at: string }>) {
  let mode: "select" | "upsert" = "select";
  const filters: Record<string, string> = {};
  return {
    select(_cols: string) {
      mode = "select";
      return this;
    },
    eq(col: string, val: string) {
      filters[col] = val;
      return this;
    },
    maybeSingle: async () => {
      const key = `${filters.user_id}|${filters.contact_number}|${filters.veiculo_id}`;
      const row = rows.get(key);
      return { data: row ? { sent_at: row.sent_at } : null };
    },
    upsert(row: Record<string, unknown>, _opts?: { onConflict?: string }) {
      mode = "upsert";
      const key = `${row.user_id}|${row.contact_number}|${row.veiculo_id}`;
      rows.set(key, { sent_at: String(row.sent_at) });
      return Promise.resolve({ error: null });
    },
  };
}

function makeScheduleTestSb(opts: {
  leadAoVivo: boolean;
  leadMornoAtivo: boolean;
  aoVivoRows?: Map<string, { sent_at: string }>;
  onLeadAgendaUpsert?: (row: Record<string, unknown>) => void;
}) {
  const aoVivoRows = opts.aoVivoRows ?? new Map<string, { sent_at: string }>();
  return {
    from(table: string) {
      if (table === "profiles") {
        return profileChain();
      }
      if (table === "empresa_config") {
        return empresaConfigChain(opts);
      }
      if (table === "vitrine_eventos") {
        return eventosChain();
      }
      if (table === "vitrine_lead_morno_agenda") {
        return leadAgendaChain(opts.onLeadAgendaUpsert);
      }
      if (table === "vitrine_lead_ao_vivo_enviados") {
        return aoVivoChain(aoVivoRows);
      }
      if (table === "whatsapp_cloud_agent_config") {
        return agentConfigChain();
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function profileChain() {
  return {
    select(_c: string) {
      return this;
    },
    eq(_a: string, _v: string) {
      return this;
    },
    maybeSingle: async () => ({ data: { tipo: "revenda_veiculos" } }),
  };
}

function empresaConfigChain(opts: { leadAoVivo: boolean; leadMornoAtivo: boolean }) {
  return {
    select(_c: string) {
      return this;
    },
    eq(_a: string, _v: string) {
      return this;
    },
    maybeSingle: async () => ({
      data: {
        segmento: "revenda de veículos",
        sobre_negocio: "loja",
        vitrine_veiculos_demo: false,
        vitrine_lead_morno_ativo: opts.leadMornoAtivo,
        vitrine_lead_ao_vivo: opts.leadAoVivo,
        vitrine_resumo_diario_ativo: true,
        vitrine_retomada_ativa: false,
        vitrine_resumo_ultimo_dia_sp: null,
      },
    }),
  };
}

function eventosChain() {
  return {
    insert(_row: Record<string, unknown>) {
      return Promise.resolve({ error: null });
    },
  };
}

function agentConfigChain() {
  return {
    select(_c: string) {
      return this;
    },
    eq(_a: string, _v: string) {
      return this;
    },
    maybeSingle: async () => ({
      data: { owner_phone: "5521777777777", owner_name: "Dono", owner_alt_phones: [] },
    }),
  };
}

function leadAgendaChain(onUpsert?: (row: Record<string, unknown>) => void) {
  return {
    upsert(row: Record<string, unknown>, _opts?: { onConflict?: string }) {
      onUpsert?.(row);
      return Promise.resolve({ error: null });
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubOwnerFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/functions/v1/whatsapp-send-message")) {
      return Promise.resolve(handler(url, init));
    }
    return original(input, init);
  };
  return () => {
    globalThis.fetch = original;
  };
}

Deno.test("claimLeadAoVivoDedup respeita janela 30 min", async () => {
  const rows = new Map<string, { sent_at: string }>();
  const sb = makeAoVivoSb(rows);
  const now = Date.parse("2026-10-16T18:00:00.000Z");
  assertEquals(await claimLeadAoVivoDedup(sb, {
    userId: "u1",
    contactNumber: "5521888888888",
    veiculoId: "v1",
    nowMs: now,
  }), true);
  assertEquals(await claimLeadAoVivoDedup(sb, {
    userId: "u1",
    contactNumber: "5521888888888",
    veiculoId: "v1",
    nowMs: now + 60_000,
  }), false);
  assertEquals(await claimLeadAoVivoDedup(sb, {
    userId: "u1",
    contactNumber: "5521888888888",
    veiculoId: "v1",
    nowMs: now + LEAD_AO_VIVO_DEDUP_MS + 1,
  }), true);
});
