import type { AnuncioData } from "./darkGold.ts";
import { buildPremiumAnuncio } from "./premiumLayout.ts";

export const buildCatalogoAnuncio = (data: AnuncioData) =>
  buildPremiumAnuncio(data, "catalogo");
