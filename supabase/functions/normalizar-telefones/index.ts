import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string, dddPadrao = "21"): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);

  if (cleaned.length === 8) return `55${dddPadrao}${cleaned}`;
  if (cleaned.length === 9) return `55${dddPadrao}${cleaned}`;
  if (cleaned.length === 10) return `55${cleaned}`;
  if (cleaned.length === 11) return `55${cleaned}`;
  if ((cleaned.length === 12 || cleaned.length === 13) && cleaned.startsWith("55")) return cleaned;
  if (cleaned.length >= 8) return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const dddPadrao = body.ddd_padrao || "21";
    const dryRun = body.dry_run === true;

    const stats = { whatsapp_contacts: 0, pj_lista_membros: 0, duplicates_removed: 0, errors: 0 };

    // 1. Normalizar whatsapp_contacts
    console.log("📱 Normalizando whatsapp_contacts...");
    const { data: contacts, error: contactsErr } = await supabase
      .from("whatsapp_contacts")
      .select("id, phone");
    
    if (contactsErr) {
      console.error("Erro ao buscar whatsapp_contacts:", contactsErr);
    } else if (contacts) {
      const seenPhones = new Map<string, string>(); // normalized -> first id
      const duplicateIds: string[] = [];

      for (const c of contacts) {
        const normalized = normalizePhone(c.phone, dddPadrao);
        if (!normalized || normalized === c.phone) {
          // Já está normalizado, só registrar
          if (normalized) {
            if (seenPhones.has(normalized)) {
              duplicateIds.push(c.id);
            } else {
              seenPhones.set(normalized, c.id);
            }
          }
          continue;
        }

        // Precisa normalizar
        if (seenPhones.has(normalized)) {
          // Já existe um com esse número normalizado - este é duplicata
          duplicateIds.push(c.id);
          stats.duplicates_removed++;
          continue;
        }

        seenPhones.set(normalized, c.id);

        if (!dryRun) {
          const { error } = await supabase
            .from("whatsapp_contacts")
            .update({ phone: normalized })
            .eq("id", c.id);
          if (error) {
            console.error(`Erro ao atualizar ${c.id}:`, error);
            stats.errors++;
          } else {
            stats.whatsapp_contacts++;
          }
        } else {
          stats.whatsapp_contacts++;
        }
      }

      // Remover duplicatas
      if (!dryRun && duplicateIds.length > 0) {
        for (const id of duplicateIds) {
          await supabase.from("whatsapp_contacts").delete().eq("id", id);
        }
        stats.duplicates_removed = duplicateIds.length;
      }
    }

    // 2. Normalizar pj_lista_membros
    console.log("📱 Normalizando pj_lista_membros...");
    const { data: membros, error: membrosErr } = await supabase
      .from("pj_lista_membros")
      .select("id, telefone");
    
    if (membrosErr) {
      console.error("Erro ao buscar pj_lista_membros:", membrosErr);
    } else if (membros) {
      for (const m of membros) {
        const normalized = normalizePhone(m.telefone, dddPadrao);
        if (!normalized || normalized === m.telefone) continue;

        if (!dryRun) {
          const { error } = await supabase
            .from("pj_lista_membros")
            .update({ telefone: normalized })
            .eq("id", m.id);
          if (error) {
            stats.errors++;
          } else {
            stats.pj_lista_membros++;
          }
        } else {
          stats.pj_lista_membros++;
        }
      }
    }

    console.log("✅ Normalização concluída:", stats);

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      ddd_padrao: dddPadrao,
      stats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
