import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, tabela } = await req.json().catch(() => ({}));

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const table = tabela || "whatsapp_contacts";
    let csvLines: string[] = [];

    if (table === "whatsapp_contacts") {
      csvLines.push("Nome,Telefone,Origem,Data Cadastro");

      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("whatsapp_contacts")
          .select("phone, nome, notes, created_at")
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const c of data) {
          const nome = (c.nome || "").replace(/"/g, '""');
          const phone = c.phone || "";
          const notes = (c.notes || "").replace(/"/g, '""');
          const date = c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "";
          csvLines.push(`"${nome}","${phone}","${notes}","${date}"`);
        }

        if (data.length < pageSize) break;
        offset += pageSize;
      }
    } else {
      csvLines.push("Nome,WhatsApp,Origem,Data Cadastro");

      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("cadastros")
          .select("nome, whatsapp, origem, created_at")
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const c of data) {
          const nome = (c.nome || "").replace(/"/g, '""');
          const phone = c.whatsapp || "";
          const origem = (c.origem || "").replace(/"/g, '""');
          const date = c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "";
          csvLines.push(`"${nome}","${phone}","${origem}","${date}"`);
        }

        if (data.length < pageSize) break;
        offset += pageSize;
      }
    }

    const csv = "\uFEFF" + csvLines.join("\n"); // BOM for Excel UTF-8

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contatos-export.csv"`,
      },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
