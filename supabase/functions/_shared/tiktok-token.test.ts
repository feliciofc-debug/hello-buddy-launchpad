import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getValidTikTokAccessToken,
  TIKTOK_RECONNECT_MESSAGE,
} from "./tiktok-token.ts";

type Row = Record<string, any>;

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private updateValue: Row | null = null;

  constructor(private database: FakeSupabase) {}

  select(_columns = "*") {
    return this;
  }

  update(value: Row) {
    this.updateValue = value;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  private matchingRows() {
    return this.database.rows.filter((row) =>
      this.filters.every(([column, value]) => row[column] === value)
    );
  }

  private execute() {
    const matches = this.matchingRows();
    if (this.updateValue) {
      for (const row of matches) Object.assign(row, this.updateValue);
    }
    return { data: matches.map((row) => ({ ...row })), error: null };
  }

  maybeSingle() {
    const result = this.execute();
    return Promise.resolve({ data: result.data[0] ?? null, error: null });
  }

  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
}

class FakeSupabase {
  constructor(public rows: Row[]) {}
  from(table: string) {
    if (table !== "integrations") throw new Error(`unexpected table ${table}`);
    return new FakeQuery(this);
  }
}

const now = new Date("2026-09-27T12:00:00.000Z");
const baseRow = (overrides: Row = {}) => ({
  id: "integration-1",
  user_id: "user-1",
  platform: "tiktok",
  access_token: "access-old",
  refresh_token: "refresh-old",
  token_expires_at: "2026-09-27T13:00:00.000Z",
  is_active: true,
  updated_at: "2026-09-27T10:00:00.000Z",
  ...overrides,
});

function setCredentials() {
  Deno.env.set("TIKTOK_ENV", "production");
  Deno.env.set("TIKTOK_CLIENT_KEY", "client-key");
  Deno.env.set("TIKTOK_CLIENT_SECRET", "client-secret");
}

Deno.test("token válido não é renovado", async () => {
  setCredentials();
  const supabase = new FakeSupabase([baseRow()]);
  let fetchCount = 0;
  const result = await getValidTikTokAccessToken(supabase, "user-1", {
    now,
    fetcher: (() => {
      fetchCount += 1;
      throw new Error("não deveria chamar");
    }) as typeof fetch,
  });
  assertEquals(result.ok, true);
  assertEquals(result.ok && result.accessToken, "access-old");
  assertEquals(fetchCount, 0);
});

Deno.test("token perto de expirar é renovado e gravado", async () => {
  setCredentials();
  const supabase = new FakeSupabase([baseRow({
    token_expires_at: "2026-09-27T12:05:00.000Z",
  })]);
  const result = await getValidTikTokAccessToken(supabase, "user-1", {
    now,
    fetcher: (() => Promise.resolve(new Response(JSON.stringify({
      access_token: "access-new",
      refresh_token: "refresh-new",
      expires_in: 86400,
    }), { status: 200 }))) as typeof fetch,
  });
  assertEquals(result.ok, true);
  assertEquals(result.ok && result.refreshed, true);
  assertEquals(supabase.rows[0].access_token, "access-new");
  assertEquals(supabase.rows[0].refresh_token, "refresh-new");
  assertEquals(supabase.rows[0].token_expires_at, "2026-09-28T12:00:00.000Z");
});

Deno.test("falha de renovação exige reconexão", async () => {
  setCredentials();
  const supabase = new FakeSupabase([baseRow({
    token_expires_at: "2026-09-27T11:59:00.000Z",
  })]);
  const result = await getValidTikTokAccessToken(supabase, "user-1", {
    now,
    waiter: () => Promise.resolve(),
    fetcher: (() => Promise.resolve(new Response(JSON.stringify({
      error: "invalid_grant",
    }), { status: 400 }))) as typeof fetch,
  });
  assertEquals(result, {
    ok: false,
    error: "tiktok_reconnect_required",
    message: TIKTOK_RECONNECT_MESSAGE,
    integration: baseRow({
      token_expires_at: "2026-09-27T11:59:00.000Z",
    }),
  });
  assertEquals(supabase.rows[0].is_active, false);
});

Deno.test("HTTP 200 com invalid_grant exige reconexão", async () => {
  setCredentials();
  const supabase = new FakeSupabase([baseRow({
    token_expires_at: "2026-09-27T11:59:00.000Z",
  })]);
  const result = await getValidTikTokAccessToken(supabase, "user-1", {
    now,
    waiter: () => Promise.resolve(),
    fetcher: (() => Promise.resolve(new Response(JSON.stringify({
      error: "invalid_grant",
      error_description: "The refresh token has expired.",
    }), { status: 200 }))) as typeof fetch,
  });
  assertEquals(!result.ok && result.error, "tiktok_reconnect_required");
  assertEquals(supabase.rows[0].is_active, false);
});

Deno.test("falha de rede é transitória e não desativa a integração", async () => {
  setCredentials();
  const supabase = new FakeSupabase([baseRow({
    token_expires_at: "2026-09-27T11:59:00.000Z",
  })]);
  const result = await getValidTikTokAccessToken(supabase, "user-1", {
    now,
    fetcher: (() => Promise.reject(new TypeError("network down"))) as typeof fetch,
  });
  assertEquals(!result.ok && result.error, "tiktok_temporarily_unavailable");
  assertEquals(supabase.rows[0].is_active, true);
});

for (const status of [500, 429]) {
  Deno.test(`HTTP ${status} é transitório e não desativa a integração`, async () => {
    setCredentials();
    const supabase = new FakeSupabase([baseRow({
      token_expires_at: "2026-09-27T11:59:00.000Z",
    })]);
    const result = await getValidTikTokAccessToken(supabase, "user-1", {
      now,
      waiter: () => Promise.resolve(),
      fetcher: (() => Promise.resolve(new Response(JSON.stringify({
        error: status === 429 ? "rate_limit_exceeded" : "server_error",
      }), { status }))) as typeof fetch,
    });
    assertEquals(!result.ok && result.error, "tiktok_temporarily_unavailable");
    assertEquals(supabase.rows[0].is_active, true);
  });
}

Deno.test("credenciais OAuth ausentes são erro transitório e não desativam", async () => {
  Deno.env.set("TIKTOK_ENV", "production");
  Deno.env.delete("TIKTOK_CLIENT_KEY");
  Deno.env.delete("TIKTOK_CLIENT_SECRET");
  const supabase = new FakeSupabase([baseRow({
    token_expires_at: "2026-09-27T11:59:00.000Z",
  })]);
  const result = await getValidTikTokAccessToken(supabase, "user-1", { now });
  assertEquals(!result.ok && result.error, "tiktok_temporarily_unavailable");
  assertEquals(supabase.rows[0].is_active, true);
  setCredentials();
});

Deno.test("integração sem refresh_token exige reconexão", async () => {
  setCredentials();
  const supabase = new FakeSupabase([baseRow({
    refresh_token: null,
    token_expires_at: "2026-09-27T11:59:00.000Z",
  })]);
  const result = await getValidTikTokAccessToken(supabase, "user-1", { now });
  assertEquals(result.ok, false);
  assertEquals(!result.ok && result.error, "tiktok_reconnect_required");
  assertEquals(supabase.rows[0].is_active, false);
});

Deno.test("renovação concorrente relê o token gravado pela outra chamada", async () => {
  setCredentials();
  const supabase = new FakeSupabase([baseRow({
    token_expires_at: "2026-09-27T11:59:00.000Z",
  })]);
  let waited = false;
  const result = await getValidTikTokAccessToken(supabase, "user-1", {
    now,
    waiter: () => {
      if (!waited) {
        waited = true;
        Object.assign(supabase.rows[0], {
          access_token: "access-from-other-call",
          token_expires_at: "2026-09-28T12:00:00.000Z",
          is_active: true,
        });
      }
      return Promise.resolve();
    },
    fetcher: (() => Promise.resolve(new Response(JSON.stringify({
      error: "invalid_grant",
    }), { status: 400 }))) as typeof fetch,
  });
  assertEquals(result.ok, true);
  assertEquals(result.ok && result.accessToken, "access-from-other-call");
  assertEquals(supabase.rows[0].is_active, true);
});
