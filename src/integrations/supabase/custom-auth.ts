import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void;

type ApiUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  user: ApiUser;
};

type ErrorResponse = {
  erro?: string;
  motivo?: string;
  message?: string;
};

const STORAGE_KEY_PREFIX = "amz-custom-auth-session-v1";
const EXPIRY_MARGIN_SECONDS = 60;

class CustomAuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

const decodeJwtPayload = (token: string): Record<string, unknown> => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
};

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const buildUser = (apiUser: ApiUser, token: string): User => {
  const claims = decodeJwtPayload(token);
  const now = new Date().toISOString();

  return {
    id: apiUser.id || asString(claims.sub),
    aud: asString(claims.aud, "authenticated"),
    role: asString(claims.role, "authenticated"),
    email: apiUser.email || asString(claims.email),
    app_metadata:
      apiUser.app_metadata ??
      (claims.app_metadata as Record<string, unknown> | undefined) ??
      { provider: "email" },
    user_metadata:
      apiUser.user_metadata ??
      (claims.user_metadata as Record<string, unknown> | undefined) ??
      {},
    created_at: asString(claims.created_at, now),
    updated_at: asString(claims.updated_at, now),
  } as User;
};

const buildSession = (response: LoginResponse): Session => {
  const responseExpiresIn = Number(response.expires_in);
  const expiresIn = Number.isFinite(responseExpiresIn) && responseExpiresIn > 0
    ? responseExpiresIn
    : 3600;
  const expiresAt = Math.floor(Date.now() / 1000) +
    Math.max(0, expiresIn - EXPIRY_MARGIN_SECONDS);

  return {
    access_token: response.access_token,
    refresh_token: "",
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: expiresAt,
    user: buildUser(response.user, response.access_token),
  };
};

const readStoredSession = (storageKey: string): Session | null => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session?.access_token || !session?.user) {
      console.warn(
        "[custom-auth] Sessão salva descartada: token ou usuário ausente",
      );
      localStorage.removeItem(storageKey);
      return null;
    }
    return session;
  } catch (error) {
    console.warn(
      "[custom-auth] Sessão salva descartada: armazenamento inválido ou indisponível",
      error,
    );
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // O navegador pode bloquear completamente o localStorage.
    }
    return null;
  }
};

const errorMessage = (payload: ErrorResponse | null, status: number) => {
  if (payload?.motivo) return `${payload.erro || "Acesso bloqueado"}: ${payload.motivo}`;
  return payload?.erro || payload?.message || `Erro de autenticação (HTTP ${status})`;
};

export class CustomAuthClient {
  private session: Session | null;
  private listeners = new Set<AuthCallback>();
  private readonly storageKey: string;

  constructor(
    private readonly baseUrl: string,
    private readonly anonKey: string,
  ) {
    this.storageKey = `${STORAGE_KEY_PREFIX}:${baseUrl}`;
    this.session = readStoredSession(this.storageKey);
  }

  private persist(session: Session | null) {
    this.session = session;
    try {
      if (session) {
        localStorage.setItem(this.storageKey, JSON.stringify(session));
      } else {
        localStorage.removeItem(this.storageKey);
      }
    } catch (error) {
      console.warn(
        "[custom-auth] localStorage indisponível; mantendo sessão apenas em memória",
        error,
      );
    }
  }

  private notify(event: AuthChangeEvent, session: Session | null) {
    for (const listener of this.listeners) {
      try {
        listener(event, session);
      } catch (error) {
        console.error("[custom-auth] Erro em onAuthStateChange:", error);
      }
    }
  }

  private clearSession(reason: string, notify = true) {
    const hadSession = Boolean(this.session);
    if (hadSession) {
      console.warn(`[custom-auth] Sessão descartada: ${reason}`);
    }
    this.persist(null);
    if (notify && hadSession) this.notify("SIGNED_OUT", null);
  }

  private async parseError(response: Response) {
    const payload = (await response.json().catch(() => null)) as ErrorResponse | null;
    return new CustomAuthError(errorMessage(payload, response.status), response.status);
  }

  getAccessToken() {
    return this.session?.access_token ?? null;
  }

  rejectSession(reason: string) {
    this.clearSession(reason);
  }

  async signInWithPassword(credentials: { email: string; password: string }) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          apikey: this.anonKey,
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        return {
          data: { user: null, session: null },
          error: await this.parseError(response),
        };
      }

      const payload = (await response.json()) as LoginResponse;
      if (!payload.access_token || !payload.user?.id) {
        return {
          data: { user: null, session: null },
          error: new CustomAuthError("Resposta de login inválida", 502),
        };
      }

      const session = buildSession(payload);
      this.persist(session);
      this.notify("SIGNED_IN", session);
      return { data: { user: session.user, session }, error: null };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: error instanceof Error ? error : new CustomAuthError(String(error)),
      };
    }
  }

  async signOut() {
    this.clearSession("logout solicitado");
    return { error: null };
  }

  async getSession() {
    return { data: { session: this.session }, error: null };
  }

  async getUser() {
    const token = this.getAccessToken();
    if (!token) {
      return {
        data: { user: null },
        error: new CustomAuthError("Sessão ausente", 401),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/user`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          apikey: this.anonKey,
        },
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        if (response.status === 401) {
          this.clearSession("servidor rejeitou o token em /auth/v1/user");
        }
        return { data: { user: null }, error };
      }

      const payload = (await response.json()) as
        | ApiUser
        | { user?: ApiUser }
        | null;
      const raw: ApiUser | null = payload && "user" in payload
        ? payload.user ?? null
        : payload as ApiUser | null;
      if (!raw?.id) {
        return {
          data: { user: null },
          error: new CustomAuthError(
            "Resposta de usuário inválida: campo id ausente",
            502,
          ),
        };
      }
      const user = buildUser(raw, token);
      if (this.session) {
        this.persist({ ...this.session, user });
      }
      return { data: { user }, error: null };
    } catch (error) {
      return {
        data: { user: null },
        error: error instanceof Error ? error : new CustomAuthError(String(error)),
      };
    }
  }

  onAuthStateChange(callback: AuthCallback) {
    this.listeners.add(callback);
    queueMicrotask(() => {
      if (this.listeners.has(callback)) callback("INITIAL_SESSION", this.session);
    });

    return {
      data: {
        subscription: {
          id: crypto.randomUUID?.() || String(Date.now()),
          callback,
          unsubscribe: () => this.listeners.delete(callback),
        },
      },
    };
  }

  async refreshSession() {
    this.clearSession("refresh não suportado pelo auth próprio");
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
    return {
      data: { user: null, session: null },
      error: new CustomAuthError("Sessão expirada. Faça login novamente.", 401),
    };
  }

  async updateUser(attributes: { password?: string }) {
    const token = this.getAccessToken();
    if (!token) {
      return {
        data: { user: null },
        error: new CustomAuthError("Sessão ausente", 401),
      };
    }
    if (!attributes.password) {
      return {
        data: { user: this.session?.user ?? null },
        error: new CustomAuthError("A nova senha é obrigatória"),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/user/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          apikey: this.anonKey,
        },
        body: JSON.stringify({ password: attributes.password }),
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        if (response.status === 401) {
          this.clearSession(
            "servidor rejeitou o token em /auth/v1/user/password",
          );
        }
        return { data: { user: null }, error };
      }

      const payload = (await response.json()) as { user?: ApiUser };
      const user = payload.user
        ? buildUser({ ...this.session!.user, ...payload.user }, token)
        : this.session!.user;
      this.persist({ ...this.session!, user });
      this.notify("USER_UPDATED", this.session);
      return { data: { user }, error: null };
    } catch (error) {
      return {
        data: { user: null },
        error: error instanceof Error ? error : new CustomAuthError(String(error)),
      };
    }
  }

  async signUp() {
    return {
      data: { user: null, session: null },
      error: new CustomAuthError("Cadastro não disponível neste ambiente", 501),
    };
  }

  async resetPasswordForEmail() {
    return {
      data: {},
      error: new CustomAuthError("Recuperação de senha não disponível neste ambiente", 501),
    };
  }

  async setSession(): Promise<never> {
    throw new CustomAuthError("Tokens externos não são aceitos neste ambiente", 403);
  }
}
