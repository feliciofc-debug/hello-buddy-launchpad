// @ts-nocheck -- Executado pelo Deno; não faz parte do typecheck do frontend.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getSegmentoById } from "./segments.ts";

Deno.test("perfil automotivo de peças permanece inalterado", () => {
  assertEquals(getSegmentoById("automotivo"), {
    id: "automotivo",
    nome: "🚗 Automotivo",
    descricao: "Peças, acessórios, produtos automotivos",
    tom: "tecnico-pratico",
    vocabulario: ["compatível", "original", "durabilidade", "instalação", "garantia"],
    estilo_venda: "Especialista automotivo: conhecedor, foca em compatibilidade e qualidade",
  });
});

Deno.test("perfil de revenda premium é separado do perfil de peças", () => {
  const perfil = getSegmentoById("revenda-veiculos-premium");
  assertEquals(perfil?.descricao, "Compra, venda e troca de veículos premium");
  assertEquals(perfil?.vocabulario.includes("laudo cautelar"), true);
  assertEquals(perfil?.vocabulario.includes("test drive"), true);
  assertEquals(perfil?.estilo_venda.includes("elegante"), true);
  assertEquals(perfil?.estilo_venda.includes("sem gírias"), true);
});
