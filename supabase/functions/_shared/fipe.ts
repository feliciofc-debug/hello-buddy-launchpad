const DEFAULT_BASE_URL = "https://fipe.parallelum.com.br/api/v2";
const LIST_TTL_MS = 12 * 60 * 60 * 1000;

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

export function createFipeClient(options: {
  fetcher?: FetchLike;
  now?: () => number;
  token?: string | null;
  baseUrl?: string;
} = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const listCache = new Map<string, CacheEntry<unknown>>();
  const priceCache = new Map<string, FipePrice>();

  async function request<T>(path: string): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const token = options.token ?? Deno.env.get("FIPE_API_TOKEN");
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
        if (attempt === 1 || /fipe_http_4\d\d/.test(lastError.message)) {
          throw lastError;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("fipe_request_failed");
  }

  async function cachedList<T>(key: string, path: string): Promise<T> {
    const cached = listCache.get(key);
    if (cached && cached.expiresAt > now()) return cached.value as T;
    const value = await request<T>(path);
    listCache.set(key, { value, expiresAt: now() + LIST_TTL_MS });
    return value;
  }

  async function references(): Promise<FipeReference[]> {
    return await cachedList("references", "/references");
  }

  async function buscarMarca(nome: string): Promise<FipeListItem | null> {
    const brands = await cachedList<FipeListItem[]>("brands", "/cars/brands");
    return rankFipeItems(brands, nome)[0] ?? null;
  }

  async function listarModelos(
    brandId: string,
    filtroTexto = "",
  ): Promise<FipeListItem[]> {
    const models = await cachedList<FipeListItem[]>(
      `models:${brandId}`,
      `/cars/brands/${encodeURIComponent(brandId)}/models`,
    );
    return filtroTexto.trim() ? rankFipeItems(models, filtroTexto) : models;
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
    const value = await request<FipePrice>(path);
    priceCache.set(cacheKey, value);
    return value;
  }

  return {
    buscarMarca,
    listarModelos,
    listarAnos,
    consultarPreco,
    references,
  };
}

const defaultClient = createFipeClient();

export const buscarMarca = defaultClient.buscarMarca;
export const listarModelos = defaultClient.listarModelos;
export const listarAnos = defaultClient.listarAnos;
export const consultarPreco = defaultClient.consultarPreco;
