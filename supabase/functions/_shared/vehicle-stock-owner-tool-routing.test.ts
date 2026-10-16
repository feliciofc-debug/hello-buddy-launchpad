import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { usesVehicleInventoryMenu } from "./vehicle-inventory-tenant.ts";

/** Espelha o ramo no início de toolConsultarEstoque (dono + gate). */
function consultarEstoqueUsesProdutosTable(
  isOwner: boolean,
  clientType: string,
  segment: string,
  businessText: string,
  vitrineDemo: boolean,
): boolean {
  const usesVehicleStock = usesVehicleInventoryMenu(
    clientType,
    segment,
    businessText,
  ) || vitrineDemo;
  if (isOwner && usesVehicleStock) return false;
  return true;
}

Deno.test("dono conta produto — meu estoque continua no catálogo produtos", () => {
  assertEquals(
    consultarEstoqueUsesProdutosTable(
      true,
      "empresa",
      "restaurante",
      "Padaria",
      false,
    ),
    true,
  );
});

Deno.test("dono revenda — consultar_estoque vai para veiculos_estoque", () => {
  assertEquals(
    consultarEstoqueUsesProdutosTable(
      true,
      "empresa",
      "revenda-veiculos-premium",
      "Revenda de carros",
      false,
    ),
    false,
  );
});
