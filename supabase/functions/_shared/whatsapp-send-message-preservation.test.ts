import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SOURCE = "supabase/functions/whatsapp-send-message/index.ts";

Deno.test("whatsapp-send-message mantém ordem dos ramos existentes antes do carousel", async () => {
  const source = await Deno.readTextFile(SOURCE);
  const mediaIdx = source.indexOf("mediaButtonPayloads");
  const buttonsIdx = source.indexOf("interactive_buttons?.buttons?.length");
  const listIdx = source.indexOf("interactive_list?.rows?.length");
  const templateIdx = source.indexOf("} else if (template_name)");
  const contactIdx = source.indexOf("} else if (contact_card?.telefone)");
  const videoIdx = source.indexOf("} else if (safeVideoUrl)");
  const documentIdx = source.indexOf("} else if (document_url)");
  const imageIdx = source.indexOf("} else if (image_url)");
  const carouselIdx = source.indexOf("interactive_carousel?.cards?.length");
  const textElseIdx = source.lastIndexOf("type: 'text'");

  assertStringIncludes(source, "interactive_carousel");
  assert(carouselIdx > imageIdx, "carousel deve vir depois de image_url");
  assert(carouselIdx < textElseIdx, "carousel deve vir antes do fallback text");
  assert(mediaIdx < buttonsIdx);
  assert(buttonsIdx < listIdx);
  assert(listIdx < templateIdx);
  assert(templateIdx < contactIdx);
  assert(contactIdx < videoIdx);
  assert(videoIdx < documentIdx);
  assert(documentIdx < imageIdx);
});

Deno.test("FIX-VEIC-3.4 — sender separa imagem e lista nessa ordem", async () => {
  const source = await Deno.readTextFile(SOURCE);
  assertStringIncludes(source, "mediaThenInteractivePayloads({");
  assertStringIncludes(
    source,
    "mediaButtonPayloads ?? mediaListPayloads ??",
  );
});
