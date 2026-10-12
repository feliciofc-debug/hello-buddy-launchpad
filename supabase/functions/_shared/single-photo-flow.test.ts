import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  clearImageEditStateForNewMedia,
  interiorProjectEditDirective,
  pendingImageEditIsActive,
  shouldOfferSinglePhotoActions,
  singlePhotoActionButtons,
  singlePhotoEditMode,
  singlePhotoFormatButtons,
} from "./single-photo-flow.ts";

Deno.test("foto única nova oferece análise acionável por botões", () => {
  assertEquals(
    singlePhotoActionButtons().buttons.map((button) => button.title),
    ["Anúncio", "Editar imagem", "Post nas redes"],
  );
});

Deno.test("pergunta de formato não repete o corpo dos botões", () => {
  assertEquals(singlePhotoFormatButtons().body, "Selecione uma opção.");
  assertEquals(
    singlePhotoFormatButtons().buttons.map((button) => button.title),
    ["Feed", "Story"],
  );
});

Deno.test("clique em editar captura qualquer instrução e escolhe o modo", () => {
  assertEquals(
    singlePhotoEditMode(
      "Mantenha mesa, cadeiras e piso originais; crie um ambiente com projeto contemporâneo para postar no Face.",
    ),
    "projeto_ambiente",
  );
  assertEquals(singlePhotoEditMode("deixa mais bonita"), "melhoria");
  assertEquals(
    singlePhotoEditMode("coloque a logo em um ambiente de cafeteria"),
    "aplicar_logo_cenario",
  );
  assertEquals(singlePhotoEditMode("coloque minha logo"), "aplicar_logo");
  assertEquals(singlePhotoEditMode("destaque a marca Axe"), "melhoria");
  assertEquals(singlePhotoEditMode("use minha marca"), "aplicar_logo");
  assertEquals(
    pendingImageEditIsActive(
      "2026-10-12T10:00:00.000Z",
      Date.parse("2026-10-12T10:29:59.000Z"),
    ),
    true,
  );
  assertEquals(
    pendingImageEditIsActive(
      "2026-10-12T10:00:00.000Z",
      Date.parse("2026-10-12T10:30:01.000Z"),
    ),
    false,
  );
});

Deno.test("projeto de ambiente preserva arquitetura e não sequestra produto", () => {
  const roomRequest =
    "Mantenha mesa, cadeiras, piso originais, mas com tratamento. Crie um projeto com armários e decoração contemporânea de alto padrão.";
  assertEquals(singlePhotoEditMode(roomRequest), "projeto_ambiente");
  assertEquals(
    singlePhotoEditMode(
      "Mantenha os produtos originais, crie um ambiente com bancada iluminada para postar no face e instagram",
    ),
    "cena_produto",
  );
  assertEquals(
    singlePhotoEditMode(
      "deixa mais moderno",
      "[visão] sala de jantar com mesa e cadeiras",
    ),
    "projeto_ambiente",
  );

  const directive = interiorProjectEditDirective();
  assertEquals(directive.includes("DESCARTE"), false);
  assertEquals(directive.includes("TROCA DE AMBIENTE"), false);
  assertEquals(
    directive.includes("PROIBIDO criar janelas, portas, cortinas ou aberturas"),
    true,
  );
  assertEquals(
    directive.includes(
      "MESMO material, a MESMA cor, o MESMO tamanho e paginação",
    ),
    true,
  );
});

Deno.test("foto nova limpa estados antigos de edição", () => {
  assertEquals(clearImageEditStateForNewMedia(), {
    pending_image_edit: null,
    pending_image_adjustment: null,
  });
});

Deno.test("menu de foto única não intercepta veículo nem foto com pedido", () => {
  assertEquals(
    shouldOfferSinglePhotoActions({
      isOwner: true,
      verticalRoute: "geral",
      incomingPhotoCount: 1,
      context: "",
    }),
    true,
  );
  assertEquals(
    shouldOfferSinglePhotoActions({
      isOwner: true,
      verticalRoute: "veiculo",
      incomingPhotoCount: 1,
      context: "",
    }),
    false,
  );
  assertEquals(
    shouldOfferSinglePhotoActions({
      isOwner: true,
      verticalRoute: "geral",
      incomingPhotoCount: 1,
      context: "coloca minha logo",
    }),
    false,
  );
});
