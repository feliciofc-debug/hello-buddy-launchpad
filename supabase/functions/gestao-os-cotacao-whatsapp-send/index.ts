import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enviarPedidoCotacaoParceiroWhatsApp } from "../_shared/os-parceiro-whatsapp-envio.ts";
import type { GestaoOsCotacaoPdfInput } from "../_shared/gestao-os-cotacao-pdf.ts";
import {
  gestaoOsFotosParaPdf,
  type GestaoOsFotoRefRow,
} from "../_shared/gestao-os-fotos.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceCall = bearer === SERVICE_KEY;

    const body = await req.json() as {
      os_id?: string;
      cotacao_ids?: string[];
      user_id?: string;
      force_direct?: boolean;
    };
    let userId = body.user_id ?? "";
    if (!isServiceCall) {
      const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anon.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      userId = user.id;
    }
    if (!userId) throw new Error("user_id obrigatório");
    if (!body.os_id) throw new Error("os_id obrigatório");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: os } = await sb.from("gestao_os")
      .select("id,numero,veiculo_id,troca_id,data_prevista,user_id")
      .eq("user_id", userId)
      .eq("id", body.os_id)
      .single();
    if (!os) throw new Error("OS não encontrada");

    let cotQuery = sb.from("gestao_os_cotacao")
      .select("id,parceiro_id,status")
      .eq("user_id", userId)
      .eq("os_id", os.id)
      .in("status", ["solicitada", "recebida"]);
    if (body.cotacao_ids?.length) cotQuery = cotQuery.in("id", body.cotacao_ids);
    const { data: cotacoes } = await cotQuery;
    if (!cotacoes?.length) throw new Error("Nenhuma cotação para enviar");

    const [{ data: veiculo }, { data: empresa }, { data: itens }, { data: fotos }, { data: troca }] =
      await Promise.all([
        sb.from("veiculos_estoque").select("marca,modelo,ano_modelo,cor,km").eq("id", os.veiculo_id).maybeSingle(),
        sb.from("empresa_config").select("nome_empresa").eq("user_id", userId).maybeSingle(),
        sb.from("gestao_os_item").select("descricao").eq("os_id", os.id).order("created_at"),
        sb.from("gestao_os_foto_ref").select("id,storage_path,selecionada,ordem,troca_ia_item_id,origem").eq("os_id", os.id),
        os.troca_id
          ? sb.from("gestao_troca").select("fotos_json").eq("id", os.troca_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const results = [];
    for (const cot of cotacoes) {
      const { data: parceiro } = await sb.from("gestao_parceiro")
        .select("nome,whatsapp_e164")
        .eq("user_id", userId)
        .eq("id", cot.parceiro_id)
        .single();
      if (!parceiro?.whatsapp_e164) {
        results.push({ cotacaoId: cot.id, ok: false, error: "Parceiro sem WhatsApp" });
        continue;
      }
      const pdfInput: GestaoOsCotacaoPdfInput = {
        titulo: "pedido_cotacao",
        lojaNome: empresa?.nome_empresa ?? "Minha loja",
        parceiroNome: parceiro.nome,
        osNumero: os.numero,
        dataIso: new Date().toISOString(),
        veiculo: {
          marca: veiculo?.marca ?? "—",
          modelo: veiculo?.modelo ?? "—",
          ano: veiculo?.ano_modelo,
          cor: veiculo?.cor,
          km: veiculo?.km,
        },
        itens: (itens ?? []).map((i: { descricao: string }) => ({ descricao: i.descricao })),
        prazoDesejado: os.data_prevista ?? undefined,
      };
      const r = await enviarPedidoCotacaoParceiroWhatsApp(sb, {
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        userId,
        cotacaoId: cot.id,
        pdfInput,
        parceiroPhone: parceiro.whatsapp_e164,
        parceiroNome: parceiro.nome,
        osId: os.id,
        osNumero: os.numero,
        veiculoLabel: `${veiculo?.marca ?? ""} ${veiculo?.modelo ?? ""}`.trim(),
        lojaNome: empresa?.nome_empresa ?? "Minha loja",
        fotoRefs: (fotos ?? []) as GestaoOsFotoRefRow[],
        trocaFotosRaw: troca?.fotos_json,
        forceDirect: body.force_direct === true,
      });
      results.push(r);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
