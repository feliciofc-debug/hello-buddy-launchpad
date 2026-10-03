import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  logOutboundMessage,
  outboundLogSender,
  processorSkipOutboundLog,
  shouldLogOutboundMessage,
} from "./cloud-log.ts";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private inserted: Row | null = null;

  constructor(
    private readonly db: FakeSupabase,
    private readonly table: string,
  ) {}

  select(_fields?: string) {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push([field, value]);
    return this;
  }

  limit(_value: number) {
    return this;
  }

  maybeSingle() {
    const row = this.db.rows[this.table]?.find((candidate) =>
      this.filters.every(([field, value]) => candidate[field] === value)
    ) ?? null;
    return Promise.resolve({ data: row, error: null });
  }

  insert(payload: Row) {
    const row = {
      id: payload.id || `${this.table}-${this.db.nextId++}`,
      ...payload,
    };
    this.db.rows[this.table] ??= [];
    this.db.rows[this.table].push(row);
    if (this.table === "whatsapp_cloud_messages") {
      this.db.messageInserts.push(row);
    }
    this.inserted = row;
    return this;
  }

  update(_payload: Row) {
    return this;
  }

  single() {
    return Promise.resolve({ data: this.inserted, error: null });
  }
}

class FakeSupabase {
  nextId = 1;
  messageInserts: Row[] = [];

  constructor(
    public rows: Record<string, Row[]>,
  ) {}

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

Deno.test("processor com skip_log não pede segundo registro", () => {
  const skipLog = processorSkipOutboundLog();
  assertEquals(skipLog, true);
  assertEquals(shouldLogOutboundMessage(skipLog), false);
});

Deno.test("processor registra uma vez envio auxiliar ainda não gravado", async () => {
  const skipLog = processorSkipOutboundLog(false);
  assertEquals(skipLog, false);
  assertEquals(shouldLogOutboundMessage(skipLog), true);
  assertEquals(outboundLogSender("agent"), "agent");
  assertEquals(outboundLogSender(undefined), "campanha");

  const sb = new FakeSupabase({
    whatsapp_cloud_conversations: [{
      id: "conv-1",
      user_id: "tenant-1",
      contact_number: "5521999999999",
    }],
    whatsapp_cloud_messages: [],
  });
  await logOutboundMessage(sb, {
    userId: "tenant-1",
    phone: "21999999999",
    content: "Card 1 de 3",
    wamid: "wamid-card-1",
    sender: outboundLogSender("agent"),
  });
  assertEquals(sb.messageInserts.length, 1);
  assertEquals(sb.messageInserts[0].sender, "agent");
});

Deno.test("campanha sem skip_log continua registrando sender campanha", async () => {
  const sb = new FakeSupabase({
    whatsapp_cloud_conversations: [{
      id: "conv-1",
      user_id: "tenant-1",
      contact_number: "5521999999999",
    }],
    whatsapp_cloud_messages: [],
  });

  assertEquals(shouldLogOutboundMessage(undefined), true);
  await logOutboundMessage(sb, {
    userId: "tenant-1",
    phone: "21999999999",
    content: "Campanha",
    wamid: "wamid-campanha",
    sender: "campanha",
  });

  assertEquals(sb.messageInserts.length, 1);
  assertEquals(sb.messageInserts[0].sender, "campanha");
  assertEquals(sb.messageInserts[0].wamid, "wamid-campanha");
});

Deno.test("logOutboundMessage não duplica wamid já existente", async () => {
  const sb = new FakeSupabase({
    whatsapp_cloud_conversations: [{
      id: "conv-1",
      user_id: "tenant-1",
      contact_number: "5521999999999",
    }],
    whatsapp_cloud_messages: [{
      id: "msg-agent",
      user_id: "tenant-1",
      conversation_id: "conv-1",
      wamid: "wamid-repetido",
      sender: "agent",
    }],
  });

  await logOutboundMessage(sb, {
    userId: "tenant-1",
    phone: "21999999999",
    content: "Resposta repetida",
    wamid: "wamid-repetido",
    sender: "campanha",
  });

  assertEquals(sb.messageInserts.length, 0);
  assertEquals(sb.rows.whatsapp_cloud_messages.length, 1);
});
