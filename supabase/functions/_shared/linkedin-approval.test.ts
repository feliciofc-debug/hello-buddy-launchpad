import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isConfirmedLinkedInPublishResult,
  sanitizeLinkedInApprovalCopy,
} from "./linkedin-approval.ts";

Deno.test("copy do LinkedIn remove emoji e posiciona link antes de até três hashtags", () => {
  assertEquals(
    sanitizeLinkedInApprovalCopy(
      "Uma observação profissional. 🚀\n\n#Um #Dois #Tres #Quatro\nhttps://exemplo.com",
    ),
    "Uma observação profissional.\n\nhttps://exemplo.com\n\n#Um #Dois #Tres",
  );
});

Deno.test("publicação LinkedIn só confirma sucesso com URN real", () => {
  assertEquals(
    isConfirmedLinkedInPublishResult(true, { success: true, post_urn: "urn:li:share:123" }),
    true,
  );
  assertEquals(
    isConfirmedLinkedInPublishResult(true, { success: true }),
    false,
  );
});
