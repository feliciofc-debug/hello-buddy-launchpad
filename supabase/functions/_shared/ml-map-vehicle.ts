import {
  ML_API_BASE,
  ML_DEFAULT_CAR_CATEGORY,
  ML_LISTING_TYPE_SILVER,
  ML_MAX_PICTURES_DEFAULT,
  ML_SITE_ID,
} from "./ml-config.ts";
import { hasPublishableMlLocation, mlLocationForItem } from "./ml-location.ts";
import type { MlCategoryAttribute, MlMapResult, VeiculoEstoqueRow } from "./ml-vehicle-types.ts";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function vehicleTitle(v: VeiculoEstoqueRow): string {
  const parts = [v.marca, v.modelo, v.versao, v.ano_modelo ?? v.ano_fabricacao].filter(Boolean);
  return parts.join(" ").slice(0, 60);
}

function matchAttrValue(attr: MlCategoryAttribute, raw: string): { id?: string; name: string } | null {
  const v = String(raw || "").trim();
  if (!v) return null;
  const values = attr.values ?? [];
  const exact = values.find((x) => norm(x.name) === norm(v));
  if (exact) return { id: exact.id, name: exact.name };
  const partial = values.find((x) => norm(x.name).includes(norm(v)) || norm(v).includes(norm(x.name)));
  if (partial) return { id: partial.id, name: partial.name };
  if (attr.value_type === "string" || !values.length) return { name: v };
  return { name: v };
}

export function mapStockFieldToMlAttributeId(field: string): string | null {
  const m: Record<string, string> = {
    marca: "BRAND",
    modelo: "MODEL",
    versao: "TRIM",
    ano_modelo: "VEHICLE_YEAR",
    km: "KILOMETERS",
    combustivel: "FUEL_TYPE",
    cambio: "TRANSMISSION",
    portas: "DOORS",
    cor: "COLOR",
    cilindrada_cc: "ENGINE_DISPLACEMENT",
  };
  return m[field] ?? null;
}

export function buildMlAttributes(
  v: VeiculoEstoqueRow,
  attrs: MlCategoryAttribute[],
): {
  attributes: Array<Record<string, unknown>>;
  blocking: Array<{ field: string; attribute_id: string; message: string; allowed?: string[] }>;
} {
  const blocking: Array<{ field: string; attribute_id: string; message: string; allowed?: string[] }> = [];
  const stockMap: Record<string, string | number | null | undefined> = {
    marca: v.marca,
    modelo: v.modelo,
    versao: v.versao,
    ano_modelo: v.ano_modelo ?? v.ano_fabricacao,
    km: v.km,
    combustivel: v.combustivel,
    cambio: v.cambio,
    portas: v.portas,
    cor: v.cor,
    cilindrada_cc: v.cilindrada_cc,
  };

  const required = attrs.filter((a) => a.tags?.required || a.tags?.catalog_required);
  const out: Array<Record<string, unknown>> = [];

  for (const attr of attrs) {
    let stockKey = Object.keys(stockMap).find((k) => mapStockFieldToMlAttributeId(k) === attr.id);
    if (!stockKey) {
      if (attr.id === "BRAND") stockKey = "marca";
      if (attr.id === "MODEL") stockKey = "modelo";
      if (attr.id === "TRIM") stockKey = "versao";
    }
    const raw = stockKey ? stockMap[stockKey] : null;
    if (raw == null || raw === "") {
      if (required.some((r) => r.id === attr.id)) {
        blocking.push({
          field: stockKey ?? attr.id,
          attribute_id: attr.id,
          message: `Preencha ${attr.name} no estoque AMZ`,
          allowed: (attr.values ?? []).slice(0, 8).map((x) => x.name),
        });
      }
      continue;
    }
    const matched = matchAttrValue(attr, String(raw));
    if (!matched) {
      blocking.push({
        field: stockKey!,
        attribute_id: attr.id,
        message: `Valor inválido para ${attr.name}`,
        allowed: (attr.values ?? []).slice(0, 8).map((x) => x.name),
      });
      continue;
    }
    const row: Record<string, unknown> = { id: attr.id };
    if (matched.id) row.value_id = matched.id;
    row.value_name = matched.name;
    out.push(row);
  }

  return { attributes: out, blocking };
}

export function mapVehicleToMlItem(input: {
  vehicle: VeiculoEstoqueRow;
  categoryId: string;
  categoryAttributes: MlCategoryAttribute[];
  mlLocationJson: unknown;
  sellerContact: Record<string, string>;
  listingTypeId?: string;
  maxPictures?: number;
}): MlMapResult {
  const blocking: Array<{ field: string; attribute_id: string; message: string; allowed?: string[] }> = [];

  if (!hasPublishableMlLocation(input.mlLocationJson)) {
    blocking.push({
      field: "localizacao",
      attribute_id: "location",
      message: "Informe o CEP da loja em Integrações.",
    });
  }
  if (!input.sellerContact.phone2) {
    blocking.push({
      field: "whatsapp_loja",
      attribute_id: "seller_contact",
      message: "Cadastre o telefone/WhatsApp da loja no perfil.",
    });
  }
  if (!input.vehicle.preco || input.vehicle.preco <= 0) {
    blocking.push({ field: "preco", attribute_id: "price", message: "Informe o preço do veículo." });
  }
  const fotos = (input.vehicle.fotos ?? []).filter(Boolean);
  if (!fotos.length) {
    blocking.push({ field: "fotos", attribute_id: "pictures", message: "Adicione ao menos uma foto pública." });
  }

  const { attributes, blocking: attrBlock } = buildMlAttributes(input.vehicle, input.categoryAttributes);
  blocking.push(...attrBlock);

  if (blocking.length) return { ok: false, blocking };

  const maxP = input.maxPictures ?? ML_MAX_PICTURES_DEFAULT;
  const location = mlLocationForItem(input.mlLocationJson)!;

  const body: Record<string, unknown> = {
    title: vehicleTitle(input.vehicle),
    category_id: input.categoryId,
    price: Math.round(Number(input.vehicle.preco)),
    currency_id: "BRL",
    available_quantity: 1,
    buying_mode: "classified",
    listing_type_id: input.listingTypeId ?? ML_LISTING_TYPE_SILVER,
    condition: (input.vehicle.km ?? 0) > 100 ? "used" : "new",
    channels: ["marketplace"],
    location,
    seller_contact: input.sellerContact,
    attributes,
    pictures: fotos.slice(0, maxP).map((source) => ({ source })),
  };
  if (input.vehicle.descricao?.trim()) {
    body.description = { plain_text: input.vehicle.descricao.trim().slice(0, 50000) };
  }
  return { ok: true, body, categoryId: input.categoryId };
}

async function mlCategoryPathLooksLikeMoto(categoryId: string): Promise<boolean> {
  try {
    const res = await fetch(`${ML_API_BASE}/categories/${categoryId}`);
    if (!res.ok) return false;
    const data = await res.json();
    const path = (data?.path_from_root ?? [])
      .map((p: { name?: string }) => String(p.name ?? ""))
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return /\bmotos?\b/.test(path) || /motocicleta/.test(path);
  } catch {
    return false;
  }
}

export async function resolveMlCategoryId(
  accessToken: string,
  vehicle: VeiculoEstoqueRow,
): Promise<string> {
  const isMoto = vehicle.segmento === "moto";
  const title = vehicleTitle(vehicle);
  const q = encodeURIComponent(
    isMoto ? `${title} motocicleta` : title,
  );
  const res = await fetch(
    `${ML_API_BASE}/sites/${ML_SITE_ID}/domain_discovery/search?limit=3&q=${q}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.ok) {
    const arr = await res.json();
    for (const hit of arr ?? []) {
      const cat = hit?.category_id;
      if (!cat) continue;
      if (isMoto) {
        if (await mlCategoryPathLooksLikeMoto(String(cat))) return String(cat);
      } else {
        const moto = await mlCategoryPathLooksLikeMoto(String(cat));
        if (!moto) return String(cat);
      }
    }
    const first = arr?.[0]?.category_id;
    if (first && !isMoto) return String(first);
  }
  if (isMoto) {
    throw new Error(
      "Não foi possível identificar a categoria de motos no Mercado Livre. Ajuste marca/modelo e tente de novo.",
    );
  }
  return ML_DEFAULT_CAR_CATEGORY;
}
