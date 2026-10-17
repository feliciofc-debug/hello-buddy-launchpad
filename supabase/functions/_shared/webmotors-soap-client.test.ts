import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSoapEnvelope, escapeXml } from "./webmotors-soap-client.ts";

Deno.test("escapeXml escapa caracteres especiais", () => {
  assertEquals(escapeXml(`a & b <c>`), "a &amp; b &lt;c&gt;");
});

Deno.test("buildSoapEnvelope inclui body", () => {
  const xml = buildSoapEnvelope("<Test/>");
  assertEquals(xml.includes("<Test/>"), true);
  assertEquals(xml.includes("soap:Envelope"), true);
});
