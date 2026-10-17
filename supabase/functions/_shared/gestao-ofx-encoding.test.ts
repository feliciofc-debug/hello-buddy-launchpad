import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decodeOfxBytes, detectOfxCharset } from "./gestao-ofx-encoding.ts";
import { parseGestaoOfx } from "./gestao-ofx-parse.ts";

Deno.test("detecta ENCODING UTF-8 no cabeçalho OFX", () => {
  const h = '<?xml version="1.0" encoding="UTF-8"?>\nOFXHEADER:100\nENCODING:UTF-8\n';
  assertEquals(detectOfxCharset(h), "utf-8");
});

Deno.test("detecta CHARSET 1252 no cabeçalho OFX", () => {
  const h = "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nCHARSET:1252\nENCODING:USASCII\n";
  assertEquals(detectOfxCharset(h), "windows-1252");
});

Deno.test("decodifica ALUGUÉL em windows-1252", () => {
  const header = "OFXHEADER:100\nCHARSET:1252\n";
  const body = "<STMTTRN><TRNAMT>-100.00</TRNAMT><DTPOSTED>20260410</DTPOSTED><MEMO>PAGAMENTO ALUGU";
  const suffix = "EL</MEMO></STMTTRN>";
  const elBytes = new TextEncoder().encode("É");
  const winEl = new Uint8Array([0xc9]);
  const bytes = new Uint8Array([
    ...new TextEncoder().encode(header + body),
    ...winEl,
    ...new TextEncoder().encode(suffix),
  ]);
  const text = decodeOfxBytes(bytes);
  const rows = parseGestaoOfx(text);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].descricao.includes("ALUGU"), true);
  assertEquals(rows[0].descricao.includes("Ã"), false);
});
