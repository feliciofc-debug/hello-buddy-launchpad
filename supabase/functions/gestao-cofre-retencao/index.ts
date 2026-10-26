import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse, optionsResponse } from "../_shared/gestao-troca-http.ts";

const BUCKET = "gestao-cofre";
const PAGE_SIZE = 500;

function addYears(date: string, years: number): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  return value.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!serviceKey || bearer !== serviceKey) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false },
  });
  const today = new Date().toISOString().slice(0, 10);
  let offset = 0;
  let removidos = 0;
  let datasAtualizadas = 0;
  while (true) {
    const { data: docs, error } = await sb.from("gestao_documento")
      .select(
        "id,user_id,veiculo_id,storage_path,created_by,created_at,retencao_ate,deleted_at",
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      return jsonResponse({ error: "Falha ao carregar retenção" }, 500);
    }
    if (!docs?.length) break;

    for (const doc of docs) {
      if (doc.deleted_at) continue;
      const { data: config } = await sb.from("gestao_documento_config")
        .select("retencao_anos").eq("user_id", doc.user_id).maybeSingle();
      const years = Math.max(
        1,
        Math.min(10, Number(config?.retencao_anos ?? 5)),
      );
      let base = String(doc.created_at).slice(0, 10);
      if (doc.veiculo_id) {
        const { data: sale } = await sb.from("veiculo_venda").select(
          "data_venda",
        )
          .eq("user_id", doc.user_id).eq("veiculo_id", doc.veiculo_id)
          .maybeSingle();
        if (sale?.data_venda) base = String(sale.data_venda);
      }
      const effective = addYears(base, years);
      if (effective !== doc.retencao_ate) {
        await sb.from("gestao_documento").update({ retencao_ate: effective })
          .eq("id", doc.id);
        datasAtualizadas++;
      }
      if (effective > today) continue;

      const removed = await sb.storage.from(BUCKET).remove([doc.storage_path]);
      if (removed.error) continue;
      const deletedAt = new Date().toISOString();
      const soft = await sb.from("gestao_documento").update({
        deleted_at: deletedAt,
        status: "descartado",
        retencao_ate: effective,
      }).eq("id", doc.id).is("deleted_at", null);
      if (soft.error) continue;
      await sb.from("gestao_documento_acesso").insert({
        documento_id: doc.id,
        user_id: doc.user_id,
        ator_id: doc.created_by,
        acao: "excluir",
        detalhe: { motivo: "retencao", executado_por: "sistema" },
      });
      removidos++;
    }
    if (docs.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return jsonResponse({
    success: true,
    removidos,
    datas_atualizadas: datasAtualizadas,
  });
});
