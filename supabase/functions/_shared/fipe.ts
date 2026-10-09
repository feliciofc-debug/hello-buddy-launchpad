import { parseNumericEnvFileKey } from "./env-file-key.ts";

const DEFAULT_BASE_URL = "https://fipe.parallelum.com.br/api/v2";
const LIST_TTL_MS = 12 * 60 * 60 * 1000;
const FIPE_TOKEN_KEY = "FIPE_API_TOKEN";
const FIPE_ENV_FILE = "/root/amz-functions.env";
let cachedFileToken: string | undefined;

export type FipeListItem = { code: string; name: string };
export type FipeReference = { code: string; month: string };
export type FipePrice = {
  brand: string;
  model: string;
  modelYear: number | string;
  fuel: string;
  price: string;
  referenceMonth: string;
  codeFipe: string;
};

type FetchLike = typeof fetch;
type CacheEntry<T> = { value: T; expiresAt: number };

export type FipeClient = ReturnType<typeof createFipeClient>;

export function normalizeFipeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(query: string, candidate: string): number {
  const q = normalizeFipeText(query);
  const c = normalizeFipeText(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1000;
  let score = c.includes(q) ? 500 - Math.max(0, c.length - q.length) : 0;
  const queryTokens = q.split(" ").filter((token) => token.length > 1);
  const candidateTokens = new Set(c.split(" "));
  const matched =
    queryTokens.filter((token) => candidateTokens.has(token)).length;
  score += matched * 50;
  if (matched === queryTokens.length) score += 100;
  return score;
}

export function rankFipeItems(
  items: FipeListItem[],
  query: string,
): FipeListItem[] {
  return items
    .map((item) => ({ item, score: similarity(query, item.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map(({ item }) => item);
}

export function fipeListRows(
  items: FipeListItem[],
  prefix: "fipe_model" | "fipe_year",
): Array<{ id: string; title: string; description?: string }> {
  return items.slice(0, 10).map((item, index) => ({
    id: `${prefix}:${index}`,
    title: item.name.length > 24
      ? `${item.name.slice(0, 23).trimEnd()}…`
      : item.name,
    description: item.name.length > 24 ? item.name.slice(0, 72) : undefined,
  }));
}

export function fipeModelPageRows(
  items: FipeListItem[],
  offset = 0,
): Array<{ id: string; title: string; description?: string }> {
  const remaining = Math.max(0, items.length - offset);
  const pageSize = remaining > 10 ? 9 : 10;
  const rows = items.slice(offset, offset + pageSize).map((item, pageIndex) => ({
    id: `fipe_model:${offset + pageIndex}`,
    title: item.name.length > 24
      ? `${item.name.slice(0, 23).trimEnd()}…`
      : item.name,
    description: item.name.length > 24 ? item.name.slice(0, 72) : undefined,
  }));
  const nextOffset = offset + pageSize;
  if (nextOffset < items.length) {
    rows.push({
      id: `fipe_model:more:${nextOffset}`,
      title: "Ver mais versões",
      description: `${items.length - nextOffset} opção(ões) restante(s)`,
    });
  }
  return rows;
}

function readFipeTokenFromFile(): string | null {
  if (cachedFileToken) return cachedFileToken;
  try {
    const contents = Deno.readTextFileSync(FIPE_ENV_FILE);
    const numericValue = parseNumericEnvFileKey(contents, FIPE_TOKEN_KEY);
    if (numericValue) return cachedFileToken = numericValue;
    for (const rawLine of contents.split(/\r?\n/)) {
      const match = rawLine.trim().match(
        /^(?:export\s+)?FIPE_API_TOKEN\s*=\s*(.*)$/,
      );
      if (!match) continue;
      const rawValue = match[1].trim();
      const quoted = rawValue.match(/^(['"])(.*?)\1(?:\s+#.*)?$/);
      const value = (quoted
        ? quoted[2]
        : rawValue.replace(/\s+#.*$/, "")).trim();
      if (/^[A-Za-z0-9._-]{5,512}$/.test(value)) {
        return cachedFileToken = value;
      }
    }
  } catch {
    // Edge Functions não possuem necessariamente o arquivo do servidor.
  }
  return null;
}

function resolveFipeToken(explicitToken: string | null | undefined): string | null {
  if (explicitToken !== undefined) return explicitToken;
  return Deno.env.get(FIPE_TOKEN_KEY) || readFipeTokenFromFile();
}

export function fipePhotoSuggestionMessage(input: {
  brand: string;
  model: string;
  earliestYear?: number | string | null;
}): string {
  const year = input.earliestYear
    ? ` (vendido no Brasil a partir de ${input.earliestYear})`
    : "";
  return `Parece um ${input.brand} ${input.model}${year}. Confirma o ano/modelo e a versão?`;
}

export function fipePriceRetryButtons() {
  return {
    body: "A consulta do preço demorou mais que o esperado.",
    buttons: [{
      id: "fipe_price:retry",
      title: "🔄 Tentar de novo",
    }],
  };
}

export function createFipeClient(options: {
  fetcher?: FetchLike;
  now?: () => number;
  token?: string | null;
  baseUrl?: string;
  timeoutMs?: number;
} = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const listCache = new Map<string, CacheEntry<unknown>>();
  const priceCache = new Map<string, FipePrice>();

  async function request<T>(
    path: string,
    stage: "marcas" | "modelos" | "anos" | "preço",
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? 25_000,
      );
      try {
        const token = resolveFipeToken(options.token);
        const response = await fetcher(`${baseUrl}${path}`, {
          headers: token ? { "X-Subscription-Token": token } : undefined,
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = new Error(`fipe_http_${response.status}`);
          if (response.status < 500 || attempt === 1) throw error;
          lastError = error;
          continue;
        }
        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[fipe][${stage}] tentativa ${attempt + 1}/2: ${lastError.message}`,
        );
        if (attempt === 1 || /fipe_http_4\d\d/.test(lastError.message)) {
          throw lastError;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("fipe_request_failed");
  }

  async function cachedList<T>(
    key: string,
    path: string,
    stage: "marcas" | "modelos" | "anos" | "preço",
  ): Promise<T> {
    const cached = listCache.get(key);
    if (cached && cached.expiresAt > now()) return cached.value as T;
    const value = await request<T>(path, stage);
    listCache.set(key, { value, expiresAt: now() + LIST_TTL_MS });
    return value;
  }

  async function references(): Promise<FipeReference[]> {
    return await cachedList("references", "/references", "preço");
  }

  async function listarMarcas(): Promise<FipeListItem[]> {
    return await cachedList<FipeListItem[]>(
      "brands",
      "/cars/brands",
      "marcas",
    );
  }

  async function buscarMarca(nome: string): Promise<FipeListItem | null> {
    const brands = await listarMarcas();
    return rankFipeItems(brands, nome)[0] ?? null;
  }

  async function listarModelos(
    brandId: string,
    filtroTexto = "",
  ): Promise<FipeListItem[]> {
    const models = await cachedList<FipeListItem[]>(
      `models:${brandId}`,
      `/cars/brands/${encodeURIComponent(brandId)}/models`,
      "modelos",
    );
    return filtroTexto.trim() ? rankFipeItems(models, filtroTexto) : models;
  }

  async function listarAnosMarca(brandId: string): Promise<FipeListItem[]> {
    return await cachedList<FipeListItem[]>(
      `brand-years:${brandId}`,
      `/cars/brands/${encodeURIComponent(brandId)}/years`,
      "anos",
    );
  }

  async function listarModelosPorAno(
    brandId: string,
    requestedYear: string,
    filtroTexto = "",
  ): Promise<FipeListItem[]> {
    const yearCodes = (await listarAnosMarca(brandId))
      .filter((item) => {
        const year = String(item.name).match(/\b(?:19|20)\d{2}\b/)?.[0] ||
          String(item.code).match(/^(?:19|20)\d{2}/)?.[0];
        return year === requestedYear;
      });
    const lists = await Promise.all(
      yearCodes.map((year) =>
        cachedList<FipeListItem[]>(
          `year-models:${brandId}:${year.code}`,
          `/cars/brands/${encodeURIComponent(brandId)}/years/${
            encodeURIComponent(year.code)
          }/models`,
          "modelos",
        )
      ),
    );
    const unique = new Map<string, FipeListItem>();
    for (const item of lists.flat()) unique.set(item.code, item);
    const models = [...unique.values()];
    const matching = filtroTexto.trim()
      ? rankFipeItems(models, filtroTexto)
      : models;
    return matching.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async function listarAnos(
    brandId: string,
    modelId: string,
    filtroTexto = "",
  ): Promise<FipeListItem[]> {
    const years = await cachedList<FipeListItem[]>(
      `years:${brandId}:${modelId}`,
      `/cars/brands/${encodeURIComponent(brandId)}/models/${
        encodeURIComponent(modelId)
      }/years`,
      "anos",
    );
    return filtroTexto.trim() ? rankFipeItems(years, filtroTexto) : years;
  }

  async function consultarPreco(input: {
    brandId?: string;
    modelId?: string;
    yearId: string;
    codeFipe?: string;
  }): Promise<FipePrice> {
    const refs = await references();
    const referenceCode = refs[0]?.code ?? "current";
    const identity = input.codeFipe
      ? `code:${input.codeFipe}`
      : `model:${input.brandId}:${input.modelId}`;
    const cacheKey = `${referenceCode}:${identity}:${input.yearId}`;
    const cached = priceCache.get(cacheKey);
    if (cached) return cached;
    const path = input.codeFipe
      ? `/cars/${encodeURIComponent(input.codeFipe)}/years/${
        encodeURIComponent(input.yearId)
      }`
      : `/cars/brands/${encodeURIComponent(input.brandId || "")}/models/${
        encodeURIComponent(input.modelId || "")
      }/years/${encodeURIComponent(input.yearId)}`;
    const value = await request<FipePrice>(path, "preço");
    priceCache.set(cacheKey, value);
    return value;
  }

  return {
    buscarMarca,
    listarMarcas,
    listarModelos,
    listarAnosMarca,
    listarModelosPorAno,
    listarAnos,
    consultarPreco,
    references,
  };
}

const defaultClient = createFipeClient();

export const buscarMarca = defaultClient.buscarMarca;
export const listarMarcas = defaultClient.listarMarcas;
export const listarModelos = defaultClient.listarModelos;
export const listarAnosMarca = defaultClient.listarAnosMarca;
export const listarModelosPorAno = defaultClient.listarModelosPorAno;
export const listarAnos = defaultClient.listarAnos;
export const consultarPreco = defaultClient.consultarPreco;
