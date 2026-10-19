import { OLX_CATEGORY_CAR } from "./olx-config.ts";
import { olxPublicBody, olxPublicPhotoUrls } from "./olx-public-text.ts";
import type { OlxMapBlocking, OlxMapResult, OlxVeiculoEstoqueRow } from "./olx-vehicle-types.ts";
import { hasPublishableMlLocation } from "./ml-location.ts";

export function stableOlxAdRef(veiculoId: string, existingRef?: string | null): string {
  if (existingRef && /^[A-Za-z0-9_{}-]{1,19}$/.test(existingRef)) return existingRef;
  const compact = veiculoId.replace(/-/g, "");
  return `amz${compact.slice(0, 16)}`;
}

function vehicleSubject(v: OlxVeiculoEstoqueRow): string {
  const parts = [v.marca, v.modelo, v.versao, v.ano_modelo ?? v.ano_fabricacao].filter(Boolean);
  const t = parts.join(" ").trim();
  return (t || "Veículo").slice(0, 90);
}

function storeZipFromMlLocation(mlLocationJson: unknown): string | null {
  if (!hasPublishableMlLocation(mlLocationJson)) return null;
  const zip = (mlLocationJson as { location?: { zip_code?: string } })?.location?.zip_code;
  const digits = String(zip ?? "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

export function mapVehicleToOlxAd(input: {
  vehicle: OlxVeiculoEstoqueRow;
  mlLocationJson: unknown;
  phone: string;
  adRef: string;
  operation: "insert" | "delete";
}): OlxMapResult {
  if (input.operation === "delete") {
    return {
      ok: true,
      adRef: input.adRef,
      ad: { id: input.adRef, operation: "delete" },
    };
  }

  const blocking: OlxMapBlocking[] = [];
  if ((input.vehicle.segmento ?? "carro") !== "carro") {
    blocking.push({ field: "segmento", message: "OLX nesta versão publica apenas carros." });
  }
  if (input.vehicle.status !== "disponivel") {
    blocking.push({ field: "status", message: "Somente veículos disponíveis podem ser publicados na OLX." });
  }
  const zipcode = storeZipFromMlLocation(input.mlLocationJson);
  if (!zipcode) {
    blocking.push({
      field: "cep",
      message: "Configure o CEP da loja (Integrações → Mercado Livre) antes de publicar na OLX.",
    });
  }
  if (!input.phone) {
    blocking.push({
      field: "whatsapp_loja",
      message: "Conecte o WhatsApp da loja na AMZ antes de publicar na OLX.",
    });
  }
  const price = input.vehicle.preco;
  if (price == null || !Number.isFinite(Number(price)) || Number(price) <= 0) {
    blocking.push({ field: "preco", message: "Informe o preço do veículo." });
  }
  const images = olxPublicPhotoUrls(input.vehicle.fotos);
  if (!images.length) {
    blocking.push({ field: "fotos", message: "Adicione ao menos uma foto pública do veículo." });
  }

  let body = "";
  try {
    body = olxPublicBody(input.vehicle.descricao);
  } catch (e) {
    blocking.push({ field: "descricao", message: (e as Error).message });
  }

  const regdate = input.vehicle.ano_modelo ?? input.vehicle.ano_fabricacao;
  if (!regdate) {
    blocking.push({ field: "ano", message: "Informe ano modelo ou fabricação." });
  }

  if (blocking.length) return { ok: false, blocking };

  const params: Record<string, string> = {
    vehicle_brand: String(input.vehicle.marca).trim(),
    vehicle_model: String(input.vehicle.modelo).trim(),
  };
  if (input.vehicle.versao?.trim()) {
    params.vehicle_version = input.vehicle.versao.trim();
  }
  if (regdate) params.regdate = String(regdate);
  if (input.vehicle.km != null) params.mileage = String(Math.max(0, Math.round(Number(input.vehicle.km))));
  if (input.vehicle.combustivel?.trim()) params.fuel = input.vehicle.combustivel.trim();
  if (input.vehicle.cambio?.trim()) params.car_steering = input.vehicle.cambio.trim();
  if (input.vehicle.cor?.trim()) params.carcolor = input.vehicle.cor.trim();

  const ad: Record<string, unknown> = {
    id: input.adRef,
    operation: "insert",
    category: OLX_CATEGORY_CAR,
    Subject: vehicleSubject(input.vehicle),
    Body: body,
    Phone: Number(input.phone),
    type: "s",
    price: Math.round(Number(price)),
    zipcode: zipcode!,
    images,
    params,
  };

  return { ok: true, ad, adRef: input.adRef };
}

/** Garante que JSON de anúncio não vaza campos internos (testes). */
export function assertOlxAdPayloadSafe(payload: unknown): void {
  const raw = JSON.stringify(payload).toLowerCase();
  const forbidden = ["fipe", "custo", "lucro", "avaria", "laudo", "/trocas/"];
  for (const term of forbidden) {
    if (raw.includes(term)) {
      throw new Error(`payload OLX contém termo proibido: ${term}`);
    }
  }
}
