import {
  createFipeClient,
  type FipeListItem,
} from "../supabase/functions/_shared/fipe.ts";
import {
  filterFipeYearCandidates,
  parseFipeRequestTextWithBrands,
} from "../supabase/functions/_shared/fipe-input.ts";
import { filterFipeModelsByYear } from "../supabase/functions/_shared/fipe-routing.ts";

const TARGET_CASES = 30;
const MIN_YEAR = 2005;
const MAX_YEAR = new Date().getFullYear();
const client = createFipeClient();

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function itemYear(item: FipeListItem): number | null {
  const value = Number(item.name.match(/\b(?:19|20)\d{2}\b/)?.[0]);
  return Number.isInteger(value) ? value : null;
}

type SmokeResult = {
  request: string;
  ok: boolean;
  detail?: string;
};

async function buildAndCheckCase(
  brand: FipeListItem,
): Promise<SmokeResult | null> {
  const availableYears = (await client.listarAnosMarca(brand.code))
    .filter((item) => {
      const year = itemYear(item);
      return year !== null && year >= MIN_YEAR && year <= MAX_YEAR;
    });
  if (availableYears.length === 0) return null;

  const selectedYear = shuffle(availableYears)[0];
  const year = String(itemYear(selectedYear));
  const models = await client.listarModelosPorAno(brand.code, year);
  if (models.length === 0) return null;
  const selectedModel = shuffle(models)[0];
  const request = `fipe ${brand.name} ${selectedModel.name} ${year}`;
  const input = parseFipeRequestTextWithBrands(request, [brand]);
  if (input.ano_modelo !== year || !input.modelo) {
    return {
      request,
      ok: false,
      detail: `identificação=${JSON.stringify(input)}`,
    };
  }

  const menu = await client.listarModelosPorAno(
    brand.code,
    year,
    input.modelo,
  );
  if (!menu.some((item) => item.code === selectedModel.code)) {
    return {
      request,
      ok: false,
      detail: `versão ${selectedModel.code} ausente do menu`,
    };
  }

  const filtered = await filterFipeModelsByYear(
    [selectedModel],
    year,
    (modelId) => client.listarAnos(brand.code, modelId),
    { concurrency: 1, timeoutMs: 25_000 },
  );
  if (
    filtered.status !== "filtered" ||
    !filtered.models.some((item) => item.code === selectedModel.code)
  ) {
    return {
      request,
      ok: false,
      detail: "filtro por ano removeu uma versão válida",
    };
  }
  const selectedModelYears = await client.listarAnos(
    brand.code,
    selectedModel.code,
  );
  const offeredYears = filterFipeYearCandidates(selectedModelYears, year);
  if (
    offeredYears.length === 0 ||
    offeredYears.some((item) => itemYear(item) !== Number(year))
  ) {
    return {
      request,
      ok: false,
      detail: `anos oferecidos=${offeredYears.map((item) => item.name).join(",")}`,
    };
  }
  return { request, ok: true };
}

const brands = shuffle(await client.listarMarcas());
const results: SmokeResult[] = [];
let nextBrand = 0;

async function worker() {
  while (results.length < TARGET_CASES && nextBrand < brands.length) {
    const brand = brands[nextBrand++];
    try {
      const result = await buildAndCheckCase(brand);
      if (result) results.push(result);
    } catch (error) {
      results.push({
        request: `marca ${brand.name}`,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

await Promise.all([worker(), worker()]);
const sample = results.slice(0, TARGET_CASES);
const failures = sample.filter((result) => !result.ok);
if (sample.length === TARGET_CASES && failures.length === 0) {
  console.log(`FIPE_SMOKE_OK ${TARGET_CASES}/${TARGET_CASES}`);
} else {
  console.error(
    `FIPE_SMOKE_FALHOU ${sample.length - failures.length}/${TARGET_CASES}`,
  );
  for (const failure of failures) {
    console.error(`- ${failure.request}: ${failure.detail}`);
  }
  if (sample.length < TARGET_CASES) {
    console.error(`- apenas ${sample.length} combinações válidas encontradas`);
  }
  Deno.exit(1);
}
