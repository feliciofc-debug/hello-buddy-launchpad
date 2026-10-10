function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isLogoPlacementRequest(value: string): boolean {
  const text = normalize(value);
  return /\b(logo|logotipo|logomarca|marca)\b/.test(text) &&
    /\b(coloca|coloque|colocar|inclui|inclua|incluir|adiciona|adicione|adicionar|aplica|aplique|aplicar|estampa|estampar|com)\b/
      .test(text);
}

export function isLogoOnObjectRequest(value: string): boolean {
  const text = normalize(value);
  if (!isLogoPlacementRequest(text)) return false;
  const object =
    "(?:caneca|xicara|camiseta|camisa|blusa|bone|chapeu|parede|carro|veiculo|moto|produto|embalagem|garrafa|copo|sacola|placa|fachada)";
  return new RegExp(
    `(?:\\b(?:logo|logotipo|logomarca|marca)\\b.{0,45}\\b(?:n[oa]|sobre|estampad[ao]\\s+n[oa])\\s+(?:o\\s+|a\\s+|esse\\s+|essa\\s+|este\\s+|esta\\s+)?${object}\\b)|(?:\\b${object}\\b.{0,35}\\bcom\\s+(?:a\\s+|o\\s+)?(?:logo|logotipo|logomarca|marca)\\b)|(?:\\bestamp\\w*\\b.{0,35}\\b${object}\\b)`,
  ).test(text);
}

export function logoRequestHasScene(value: string): boolean {
  const text = normalize(value);
  return isLogoPlacementRequest(text) &&
    /\b(ambiente|cenario|cena|maquina|cafeteira|mesa|bancada|fundo|cozinha|sala|quarto|cafe caindo|graos|moedor)\b/
      .test(text);
}

export function logoPlacementMode(
  value: string,
): "object" | "top-left" | null {
  if (!isLogoPlacementRequest(value)) return null;
  return isLogoOnObjectRequest(value) || logoRequestHasScene(value)
    ? "object"
    : "top-left";
}

export function logoImageEditPlan(value: string): {
  logoMode: "object" | "top-left" | null;
  hasScene: boolean;
  strategy: "creative-edit" | "overlay" | null;
  toolMode: "aplicar_logo_cenario" | "aplicar_logo" | null;
} {
  const logoMode = logoPlacementMode(value);
  const hasScene = logoRequestHasScene(value);
  if (logoMode === "object") {
    return {
      logoMode,
      hasScene,
      strategy: "creative-edit",
      toolMode: hasScene ? "aplicar_logo_cenario" : "aplicar_logo",
    };
  }
  return {
    logoMode,
    hasScene,
    strategy: logoMode === "top-left" ? "overlay" : null,
    toolMode: null,
  };
}

export function logoRequestIncludesPublication(value: string): boolean {
  const text = normalize(value);
  return isLogoPlacementRequest(text) &&
    /\b(posta|poste|postar|publica|publique|publicar)\b/.test(text);
}

export const LOGO_PRODUCT_SIMULATION_NOTICE =
  "Isto é uma simulação de produto personalizado.";
