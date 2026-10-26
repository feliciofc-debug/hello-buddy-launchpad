import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/** Meta envia "NONE" quando não há rejeição — não exibir como erro na UI. */
export function deveExibirMotivoRejeicaoMetaTemplate(
  statusMeta: string | null | undefined,
  motivo: string | null | undefined,
): boolean {
  if (statusMeta !== "rejeitado") return false;
  const m = (motivo ?? "").trim();
  if (!m) return false;
  return m.toLowerCase() !== "none";
}

/** Ex.: +55 21 98765-4321 a partir de display_phone ou dígitos. */
export function formatWhatsAppDisplayPhoneBr(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const m = withCountry.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (m) return `+55 ${m[1]} ${m[2]}-${m[3]}`;
  return null;
}

/** Contato da loja no PDF: WhatsApp conectado, depois e-mail do usuário (sem log de PII). */
export async function resolveLojaContatoParaPdf(
  sb: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: wa, error: waErr } = await sb.from("whatsapp_config")
    .select("display_phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (waErr) {
    console.warn("[gestao-os-cotacao-wa] whatsapp_config:", waErr.message);
  }
  if (wa?.display_phone) {
    const formatted = formatWhatsAppDisplayPhoneBr(String(wa.display_phone));
    if (formatted) return formatted;
  }

  const { data: authData, error: authErr } = await sb.auth.admin.getUserById(userId);
  if (authErr) {
    console.warn("[gestao-os-cotacao-wa] auth getUser:", authErr.message);
  }
  const email = authData?.user?.email?.trim();
  return email || null;
}
