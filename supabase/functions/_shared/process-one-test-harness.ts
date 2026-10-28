type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

type Filter = (row: Row) => boolean;

class MemoryQuery implements PromiseLike<{ data: any; error: null; count?: number }> {
  private filters: Filter[] = [];
  private operation: "select" | "insert" | "update" | "upsert" | "delete" =
    "select";
  private payload: Row | Row[] | null = null;
  private maximum: number | null = null;
  private selected = false;

  constructor(
    private readonly db: ProcessOneMemorySupabase,
    private readonly table: string,
  ) {}

  select(_columns = "*", options?: { count?: string; head?: boolean }) {
    this.selected = true;
    if (options?.head) this.maximum = 0;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: Row | Row[], _options?: unknown) {
    this.operation = "upsert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  contains(column: string, value: unknown) {
    this.filters.push((row) => {
      const current = row[column];
      if (Array.isArray(current) && Array.isArray(value)) {
        return value.every((item) => current.includes(item));
      }
      return true;
    });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push((row) => row[column] > value);
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((row) => row[column] <= value);
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push((row) => row[column] < value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*");
    const regex = new RegExp(`^${escaped}$`, "i");
    this.filters.push((row) => regex.test(String(row[column] ?? "")));
    return this;
  }

  like(column: string, pattern: string) {
    return this.ilike(column, pattern);
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === "is") this.filters.push((row) => row[column] !== value);
    return this;
  }

  or(_expression: string) {
    // The audit seeds are unambiguous; compound PostgREST filters do not
    // affect which seeded row is selected.
    return this;
  }

  order(_column: string, _options?: unknown) {
    return this;
  }

  limit(value: number) {
    this.maximum = value;
    return this;
  }

  range(from: number, to: number) {
    this.maximum = Math.max(0, to - from + 1);
    return this;
  }

  private matchingRows(): Row[] {
    return (this.db.tables[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => filter(row))
    );
  }

  private execute() {
    this.db.operations.push({
      table: this.table,
      operation: this.operation,
      payload: structuredClone(this.payload),
    });
    const table = this.db.tables[this.table] ??= [];
    let rows = this.matchingRows();

    if (this.operation === "insert" || this.operation === "upsert") {
      const payloads = Array.isArray(this.payload)
        ? this.payload
        : [this.payload ?? {}];
      rows = payloads.map((payload) => {
        const row = {
          id: payload.id ?? `${this.table}-${this.db.nextId++}`,
          ...structuredClone(payload),
        };
        table.push(row);
        return row;
      });
    } else if (this.operation === "update") {
      for (const row of rows) {
        for (const [key, value] of Object.entries(this.payload ?? {})) {
          if (value !== undefined) row[key] = structuredClone(value);
        }
      }
    } else if (this.operation === "delete") {
      const doomed = new Set(rows);
      this.db.tables[this.table] = table.filter((row) => !doomed.has(row));
    }

    if (this.maximum != null) rows = rows.slice(0, this.maximum);
    return {
      data: this.selected || this.operation === "select"
        ? rows.map((row) => structuredClone(row))
        : null,
      error: null,
      count: rows.length,
    };
  }

  maybeSingle() {
    const result = this.execute();
    return Promise.resolve({
      data: Array.isArray(result.data) ? result.data[0] ?? null : null,
      error: null,
      count: result.count,
    });
  }

  single() {
    return this.maybeSingle();
  }

  then<TResult1 = { data: any; error: null; count?: number }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: null; count?: number }) =>
        TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export class ProcessOneMemorySupabase {
  nextId = 1;
  readonly operations: Array<{
    table: string;
    operation: string;
    payload: unknown;
  }> = [];
  readonly storageObjects = new Map<string, Uint8Array>();
  readonly rpcResults = new Map<string, unknown>();

  constructor(public tables: Tables) {}

  from(table: string) {
    return new MemoryQuery(this, table);
  }

  rpc(name: string, _params?: unknown) {
    return Promise.resolve({
      data: this.rpcResults.get(name) ?? null,
      error: null,
    });
  }

  functions = {
    invoke: (_name: string, _options?: unknown) =>
      Promise.resolve({ data: { ok: true }, error: null }),
  };

  storage = {
    from: (bucket: string) => ({
      download: (path: string) => {
        const bytes = this.storageObjects.get(`${bucket}/${path}`);
        return Promise.resolve({
          data: bytes ? new Blob([bytes]) : null,
          error: bytes ? null : { message: "not_found" },
        });
      },
      upload: (path: string, body: Blob | Uint8Array) => {
        const bytes = body instanceof Uint8Array ? body : new Uint8Array();
        this.storageObjects.set(`${bucket}/${path}`, bytes);
        return Promise.resolve({ data: { path }, error: null });
      },
      remove: (paths: string[]) => {
        for (const path of paths) this.storageObjects.delete(`${bucket}/${path}`);
        return Promise.resolve({ data: paths, error: null });
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://storage.test/${bucket}/${path}` },
      }),
      createSignedUrl: (path: string) =>
        Promise.resolve({
          data: { signedUrl: `https://storage.test/${bucket}/${path}` },
          error: null,
        }),
    }),
  };
}

export type MetaInteractiveKind =
  | "interactive.button_reply"
  | "interactive.list_reply"
  | "button.payload";

export function metaInteractivePayload(
  kind: MetaInteractiveKind,
  id: string,
  title: string,
  profileName = "Dono Teste",
): Row {
  const payload: Row = {
    profile: { name: profileName },
    contacts: [{ profile: { name: profileName } }],
  };
  if (kind === "interactive.button_reply") {
    payload.interactive = {
      type: "button_reply",
      button_reply: { id, title },
    };
  } else if (kind === "interactive.list_reply") {
    payload.interactive = {
      type: "list_reply",
      list_reply: { id, title, description: "" },
    };
  } else {
    payload.button = { payload: id, text: title };
  }
  return payload;
}

export function baseProcessOneTables(options: {
  interactiveId: string;
  title: string;
  kind?: MetaInteractiveKind;
  ownerPhone?: string;
  fromPhone?: string;
  agentState?: Row;
  messageType?: string;
}): Tables {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const ownerPhone = options.ownerPhone ?? "5511999999999";
  const fromPhone = options.fromPhone ?? ownerPhone;
  return {
    whatsapp_cloud_inbound_queue: [{
      id: "queue-1",
      wamid: "wamid-in-1",
      user_id: tenantId,
      phone_number_id: "phone-id-1",
      from_number: fromPhone,
      message_type: options.messageType ?? "interactive",
      payload: metaInteractivePayload(
        options.kind ?? "interactive.button_reply",
        options.interactiveId,
        options.title,
      ),
      status: "received",
      attempts: 0,
      created_at: new Date().toISOString(),
    }],
    whatsapp_config: [{
      user_id: tenantId,
      access_token: "wa-token",
      connection_method: "cloud",
      phone_number_id: "phone-id-1",
      business_name: "Loja Teste",
      is_active: true,
    }],
    whatsapp_cloud_agent_config: [{
      id: "agent-1",
      user_id: tenantId,
      is_active: true,
      owner_phone: ownerPhone,
      owner_name: "Dono Teste",
      owner_alt_phones: [],
      agent_name: "Jarvis",
      business_name: "Loja Teste",
      segment: "automotivo",
      handoff_rules: null,
    }],
    whatsapp_cloud_conversations: [{
      id: "conv-1",
      user_id: tenantId,
      contact_number: fromPhone,
      contact_name: "Dono Teste",
      status: "active",
      agent_state: options.agentState ?? {},
      last_message_at: new Date().toISOString(),
    }],
    whatsapp_cloud_messages: [],
    jarvis_menu_config: [{
      user_id: tenantId,
      menu_enabled: true,
      vendedor_enabled: false,
      recent_enabled: true,
    }],
    profiles: [{
      id: tenantId,
      full_name: "Dono Teste",
      business_name: "Loja Teste",
      segmento: "automotivo",
    }],
    empresa_config: [{
      user_id: tenantId,
      segmento: "revenda de veículos",
    }],
    gestao_config: [{
      user_id: tenantId,
      owner_phone: ownerPhone,
      gestores: [],
    }],
    integrations: [],
    ai_messages_quota: [{
      user_id: tenantId,
      is_enabled: true,
      used_count: 0,
      monthly_limit: 10_000,
      reset_at: "2099-01-01T00:00:00.000Z",
    }],
    contatos_comerciais: [],
    contatos: [],
    crm_contacts: [],
    veiculos_estoque: [],
  };
}

export function installProcessOneFetchRecorder() {
  const previous = globalThis.fetch;
  const calls: Array<{ url: string; body: any }> = [];
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input instanceof Request ? input.url : input);
    let body: any = init?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // Preserve non-JSON request bodies for the report.
      }
    }
    calls.push({ url, body });
    if (url.includes("graph.facebook.com")) {
      return Response.json({ messages: [{ id: `wamid-out-${calls.length}` }] });
    }
    if (url.includes("whatsapp-send-message")) {
      return Response.json({
        success: true,
        message_id: `wamid-out-${calls.length}`,
        wamid: `wamid-out-${calls.length}`,
      });
    }
    return Response.json({ ok: true, data: {}, candidates: [] });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = previous;
    },
  };
}
