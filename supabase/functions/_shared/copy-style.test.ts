import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { aplicarEstiloCopy, type CopyStyle } from "./copy-style.ts";

const style: CopyStyle = {
  voz: "empresa",
  assinatura: null,
  link: "https://wa.me/5521980804901",
  regras: null,
  template: null,
  assinar: false,
  promptBlock: "",
};

Deno.test("Link do post não duplica CTA de WhatsApp já presente", () => {
  const caption =
    "Produto em destaque.\n\n📱 Chame no WhatsApp: https://wa.me/5521980804901";
  assertEquals(aplicarEstiloCopy(caption, style), caption);
});

Deno.test("CTA final com outro número também bloqueia link no início", () => {
  const caption =
    "Produto em destaque.\n\n📱 Chame no WhatsApp: https://wa.me/5511999999999";
  assertEquals(aplicarEstiloCopy(caption, style), caption);
});
