import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { campanha_id, limite = 10 } = await req.json();

    console.log(`[ENRICH-BULK] Iniciando para campanha ${campanha_id}`);

    // Buscar leads descobertos que ainda não foram enriquecidos
    const { data: leads, error: leadsError } = await supabaseClient
      .from('leads_descobertos')
      .select('*')
      .eq('campanha_id', campanha_id)
      .eq('status', 'descoberto')
      .limit(limite);

    if (leadsError) throw leadsError;

    console.log(`[ENRICH-BULK] ${leads.length} leads para enriquecer`);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const GOOGLE_CX = Deno.env.get("GOOGLE_CX");

    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      throw new Error("Google API não configurada");
    }

    const googleSearch = async (query: string) => {
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      return await response.json();
    };

    // Gerar variações do nome
    const getNameVariations = (fullName: string): string[] => {
      const parts = fullName.split(' ').filter(p => p.length > 0);
      const variations = [fullName];
      
      if (parts.length >= 2) {
        variations.push(`${parts[0]} ${parts[1]}`);
      }
      
      if (parts.length >= 3) {
        variations.push(`${parts[0]} ${parts[parts.length - 1]}`);
      }
      
      return variations;
    };

    let processados = 0;

    for (const lead of leads) {
      try {
        await supabaseClient
          .from('leads_descobertos')
          .update({ status: 'enriquecendo' })
          .eq('id', lead.id);

        const nome = lead.tipo === 'b2b' ? lead.razao_social : lead.nome_profissional;
        const nameVariations = getNameVariations(nome);

        let linkedinUrl = null;
        let instagramUsername = null;

        // Buscar LinkedIn
        for (const nameVariation of nameVariations) {
          const results = await googleSearch(`${nameVariation} site:linkedin.com/in/`);
          if (results.items && results.items.length > 0) {
            linkedinUrl = results.items[0].link;
            break;
          }
        }

        // Buscar Instagram
        const instagramResults = await googleSearch(`${nome} instagram`);
        if (instagramResults.items) {
          for (const item of instagramResults.items) {
            const match = item.link.match(/instagram\.com\/([^\/\?]+)/);
            if (match) {
              instagramUsername = match[1];
              break;
            }
          }
        }

        // Atualizar lead
        await supabaseClient
          .from('leads_descobertos')
          .update({
            linkedin_url: linkedinUrl,
            instagram_username: instagramUsername,
            enrichment_data: {
              linkedin: linkedinUrl ? { url: linkedinUrl } : null,
              instagram: instagramUsername ? { username: instagramUsername } : null
            },
            enriched_at: new Date().toISOString(),
            status: 'enriquecido'
          })
          .eq('id', lead.id);

        processados++;
        console.log(`[ENRICH-BULK] ✅ Lead enriquecido: ${nome}`);

        // Delay para não estourar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[ENRICH-BULK] Erro ao enriquecer lead ${lead.id}:`, error);
      }
    }

    // Atualizar stats da campanha
    const { data: campanha } = await supabaseClient
      .from('campanhas_prospeccao')
      .select('stats')
      .eq('id', campanha_id)
      .single();

    if (campanha) {
      const stats = campanha.stats as any;
      await supabaseClient
        .from('campanhas_prospeccao')
        .update({
          stats: {
            ...stats,
            enriquecidos: (stats.enriquecidos || 0) + processados
          }
        })
        .eq('id', campanha_id);
    }

    console.log(`[ENRICH-BULK] ✅ Concluído! ${processados} leads enriquecidos`);

    return new Response(JSON.stringify({
      success: true,
      processados
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[ENRICH-BULK] Erro:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
