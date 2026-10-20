import type { PublishableItem } from "@/lib/publishable-item";

export type VehicleVideoStockRow = {
  id: string;
  marca: string;
  modelo: string;
  versao?: string | null;
  ano_fabricacao?: number | null;
  ano_modelo?: number | null;
  km?: number | null;
  cambio?: string | null;
  cor?: string | null;
  combustivel?: string | null;
  opcionais?: string[] | null;
  caracteristicas?: string[] | null;
  descricao?: string | null;
  preco?: number | null;
  fotos?: string[] | null;
  status?: string | null;
  incluir_cta_whatsapp?: boolean | null;
  modo_postagem_fb?: string | null;
  engajamento_estilos?: string[] | null;
  usa_textos_personalizados?: boolean | null;
  url_origem?: string | null;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Apenas URLs públicas do estoque — nunca trocas/laudo/CRLV. */
export function publicVehicleStockPhotos(vehicle: Pick<VehicleVideoStockRow, "fotos">): string[] {
  const urls = (vehicle.fotos ?? [])
    .map((u) => String(u || "").trim())
    .filter((u) => u.startsWith("http"));
  return [...new Set(urls)];
}

function formatKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  return `${Math.round(km).toLocaleString("pt-BR")} km`;
}

function formatAno(
  anoFab?: number | null,
  anoMod?: number | null,
): string | null {
  if (anoFab && anoMod && anoFab !== anoMod) return `${anoFab}/${anoMod}`;
  if (anoMod) return String(anoMod);
  if (anoFab) return String(anoFab);
  return null;
}

/** Destaques para overlay (até 3), só dados preenchidos. */
export function vehicleVideoHighlightBullets(vehicle: VehicleVideoStockRow): string[] {
  const bullets: string[] = [];
  const km = formatKm(vehicle.km);
  if (km) bullets.push(km);
  if (vehicle.cambio?.trim()) bullets.push(vehicle.cambio.trim());
  if (vehicle.cor?.trim()) bullets.push(vehicle.cor.trim());
  const ano = formatAno(vehicle.ano_fabricacao, vehicle.ano_modelo);
  if (ano) bullets.push(ano);
  for (const o of vehicle.opcionais ?? []) {
    const t = String(o || "").trim();
    if (t && bullets.length < 3) bullets.push(t);
  }
  for (const c of vehicle.caracteristicas ?? []) {
    const t = String(c || "").trim();
    if (t && bullets.length < 3) bullets.push(t);
  }
  return bullets.slice(0, 3);
}

export function vehicleVideoDisplayTitle(vehicle: VehicleVideoStockRow): string {
  return [vehicle.marca, vehicle.modelo, vehicle.versao].filter(Boolean).join(" ").trim();
}

export function vehicleVideoSubtitleLine(vehicle: VehicleVideoStockRow): string {
  const parts = [
    formatAno(vehicle.ano_fabricacao, vehicle.ano_modelo),
    formatKm(vehicle.km),
    vehicle.cambio?.trim(),
    vehicle.cor?.trim(),
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 60);
}

/** Preço no vídeo: mesma regra do card (só exibe se houver preço cadastrado). */
export function vehicleVideoPriceForOverlay(vehicle: VehicleVideoStockRow): {
  preco: number | null;
  precoLabel: string | null;
} {
  const preco = vehicle.preco ?? null;
  if (preco == null || !Number.isFinite(preco) || preco <= 0) {
    return { preco: null, precoLabel: null };
  }
  return { preco, precoLabel: `R$ ${brl(preco)}` };
}

export function vehicleRowToPublishableItem(vehicle: VehicleVideoStockRow): PublishableItem {
  const title = vehicleVideoDisplayTitle(vehicle);
  const facts = vehicleVideoHighlightBullets(vehicle);
  const photos = publicVehicleStockPhotos(vehicle);
  return {
    id: vehicle.id,
    item_tipo: "veiculo",
    veiculo: {
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      versao: vehicle.versao,
      ano_fabricacao: vehicle.ano_fabricacao,
      ano_modelo: vehicle.ano_modelo,
      km: vehicle.km,
      cambio: vehicle.cambio,
      combustivel: vehicle.combustivel,
      cor: vehicle.cor,
      opcionais: vehicle.opcionais?.slice(0, 8) ?? [],
    },
    nome: title,
    descricao: [vehicle.descricao, ...facts].filter(Boolean).join("\n"),
    preco: vehicle.preco ?? null,
    imagem_url: photos[0] ?? null,
    imagens: photos,
    link: vehicle.url_origem ?? null,
    incluir_cta_whatsapp: vehicle.incluir_cta_whatsapp,
    categoria: "Veículo",
    modo_postagem_fb: vehicle.modo_postagem_fb ?? null,
    engajamento_estilos: vehicle.engajamento_estilos ?? null,
    usa_textos_personalizados: vehicle.usa_textos_personalizados ?? false,
  };
}

export function vehicleIsPublishableForVideo(status: string | null | undefined): boolean {
  return status !== "vendido";
}

export function vehicleHasPublicPhotos(item: Pick<VehicleVideoStockRow, "fotos">): boolean {
  return publicVehicleStockPhotos(item).length > 0;
}

export function vehicleSlideshowPhotoUrls(item: VehicleVideoStockRow): string[] {
  const base = publicVehicleStockPhotos(item);
  if (base.length === 0) return [];
  if (base.length >= 3) return base.slice(0, 5);
  const expanded = [...base];
  while (expanded.length < 3) {
    expanded.push(base[expanded.length % base.length]);
  }
  return expanded.slice(0, 5);
}

