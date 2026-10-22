import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertSafeWebmotorsPhotoUrl } from "./webmotors-photo-base64.ts";

Deno.test("foto Webmotors exige HTTPS público", () => {
  assertEquals(
    assertSafeWebmotorsPhotoUrl("https://cdn.example.com/foto.jpg").hostname,
    "cdn.example.com",
  );
  for (
    const unsafe of [
      "http://cdn.example.com/foto.jpg",
      "https://localhost/foto.jpg",
      "https://127.0.0.1/foto.jpg",
      "https://10.0.0.1/foto.jpg",
      "https://[::1]/foto.jpg",
    ]
  ) {
    assertThrows(() => assertSafeWebmotorsPhotoUrl(unsafe));
  }
});
