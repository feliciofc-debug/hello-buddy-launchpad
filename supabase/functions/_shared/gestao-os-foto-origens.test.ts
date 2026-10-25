import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  gestaoOsAnuncioPathFromPublicUrl,
  gestaoOsFotoLegenda,
  gestaoOsFotoRefBucket,
} from "./gestao-os-foto-origens.ts";
import { gestaoOsFotosParaPdf, gestaoOsFotosVisiveis } from "./gestao-os-fotos.ts";
import { GESTAO_TROCA_FOTO_ETIQUETA_CRLV } from "./gestao-troca-fotos.ts";

Deno.test("OS-1.5 — carro sem troca: fotos do anúncio entram na galeria (migration)", async () => {
  const sql = await Deno.readTextFile(new URL(
    "../../migrations/20261032265000_gestao_os_foto_ref_origens.sql",
    import.meta.url,
  ));
  assertStringIncludes(sql, "origem IN ('troca', 'anuncio', 'os')");
  assertStringIncludes(sql, "gestao_os_fotos_sincronizar");
  assertStringIncludes(sql, "gestao_os_foto_anuncio_permitida");
  assertStringIncludes(sql, "LIMIT 4");
  assertStringIncludes(sql, "Foto não pertence ao anúncio deste veículo");
});

Deno.test("OS-1.5 — bucket/legenda por origem", () => {
  assertEquals(
    gestaoOsFotoRefBucket({ origem: "anuncio", storage_path: "https://x.com/f.jpg" }),
    "url",
  );
  assertEquals(
    gestaoOsFotoRefBucket({ origem: "os", storage_path: "u/os/id/x.jpg" }),
    "gestao-os-documentos",
  );
  assertEquals(gestaoOsFotoLegenda({ id: "1", storage_path: "x", selecionada: true, ordem: 1, troca_ia_item_id: null, origem: "anuncio" }), "Anúncio");
});

Deno.test("OS-1.5 — seleção vai para PDF; CRLV troca continua bloqueado", () => {
  const refs = [
    { id: "a", storage_path: "https://cdn/anuncio1.jpg", selecionada: true, ordem: 1, troca_ia_item_id: null, origem: "anuncio" as const },
    { id: "b", storage_path: "u/t/crlv.jpg", selecionada: true, ordem: 2, troca_ia_item_id: null, origem: "troca" as const },
  ];
  const visiveis = gestaoOsFotosVisiveis(refs, [
    { path: "u/t/crlv.jpg", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV },
  ]);
  assertEquals(visiveis.length, 1);
  assertEquals(visiveis[0].origem, "anuncio");
  const pdf = gestaoOsFotosParaPdf(refs, [
    { path: "u/t/crlv.jpg", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV },
  ]);
  assertEquals(pdf.length, 1);
});

Deno.test("OS-1.5 — path produtos a partir de URL pública", () => {
  const url = "https://proj.supabase.co/storage/v1/object/public/produtos/uid/veiculos/vid/a.jpg";
  assertEquals(
    gestaoOsAnuncioPathFromPublicUrl(url),
    "uid/veiculos/vid/a.jpg",
  );
});
