import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════
// FUNÇÃO BUSCAR LINKEDIN (SERPAPI - COPIADO DO DISCOVERY-CNPJ)
// ═══════════════════════════════════════════
async function buscarLinkedIn(nomeLead: string, empresaOuCargo?: string): Promise<string | null> {
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
  
  if (!SERPAPI_KEY) {
    console.log('⚠️ SERPAPI_KEY não configurada');
    return null;
  }
  
  try {
    // Query: nome + cargo/empresa + site:linkedin.com/in/
    const queryParts = [nomeLead];
    if (empresaOuCargo) {
      queryParts.push(empresaOuCargo);
    }
    queryParts.push('site:linkedin.com/in/');
    
    const query = encodeURIComponent(queryParts.join(' '));
    const url = `https://serpapi.com/search.json?q=${query}&api_key=${SERPAPI_KEY}&num=5`;
    
    console.log(`🔍 Buscando LinkedIn via SerpAPI: ${nomeLead}`);
    console.log(`   Query: ${queryParts.join(' ')}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`⚠️ SerpAPI erro: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const results = data.organic_results || [];
    
    console.log(`📊 SerpAPI retornou ${results.length} resultados`);
    
    // Procurar link do LinkedIn nos resultados
    for (const result of results) {
      const link = result.link || '';
      if (link.includes('linkedin.com/in/')) {
        console.log(`✅ LinkedIn encontrado: ${link}`);
        
        // Log adicional pra validar
        const title = result.title || '';
        console.log(`   Título: ${title}`);
        
        return link;
      }
    }
    
    console.log(`⚠️ LinkedIn não encontrado para ${nomeLead}`);
    return null;
    
  } catch (e) {
    console.log(`❌ Erro ao buscar LinkedIn: ${e}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// EDGE FUNCTION PRINCIPAL
// ═══════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    
    console.log('═══════════════════════════════════════');
    console.log('🔍 Validando lead:', leadId);
    console.log('═══════════════════════════════════════');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Buscar lead no banco
    const { data: lead, error: leadError } = await supabase
      .from('leads_imoveis_enriquecidos')
      .select('*')
      .eq('id', leadId)
      .single();
    
    if (leadError || !lead) {
      throw new Error('Lead não encontrado');
    }
    
    console.log('Lead:', lead.nome);
    
    let confianca = lead.score_total || 0;
    const fontes: string[] = [];
    
    // ═══════════════════════════════════════════
    // BUSCAR LINKEDIN (SerpAPI)
    // ═══════════════════════════════════════════
    
    console.log('💼 Buscando LinkedIn via SerpAPI...');
    
    const linkedinUrl = await buscarLinkedIn(
      lead.nome,
      lead.empresa || lead.cargo
    );
    
    if (linkedinUrl) {
      // Atualizar no banco
      await supabase.from('leads_imoveis_enriquecidos').update({
        linkedin_url: linkedinUrl,
        linkedin_encontrado: true
      }).eq('id', leadId);
      
      confianca += 30;
      fontes.push('linkedin');
      console.log('✅ LinkedIn encontrado e salvo!');
    } else {
      console.log('⚠️ LinkedIn não encontrado');
    }
    
    // ═══════════════════════════════════════════
    // BUSCAR INSTAGRAM (já funciona)
    // ═══════════════════════════════════════════
    
    // Instagram já está funcionando, mantém como está
    if (lead.instagram_username) {
      console.log('✅ Instagram já encontrado:', lead.instagram_username);
      fontes.push('instagram');
      confianca += 20;
    }
    
    // ═══════════════════════════════════════════
    // ATUALIZAR CONFIANÇA FINAL
    // ═══════════════════════════════════════════
    
    const dadosCompletos = fontes.length >= 1; // Pelo menos 1 rede social
    
    await supabase.from('leads_imoveis_enriquecidos').update({
      confianca_dados: confianca,
      dados_completos: dadosCompletos,
      data_enriquecimento: new Date().toISOString()
    }).eq('id', leadId);
    
    console.log('═══════════════════════════════════════');
    console.log('✅ Validação concluída!');
    console.log(`Confiança: ${confianca}%`);
    console.log(`Fontes: ${fontes.join(', ')}`);
    console.log('═══════════════════════════════════════');
    
    return new Response(
      JSON.stringify({
        success: true,
        confianca,
        dadosCompletos,
        fontes,
        linkedinUrl
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: any) {
    console.error('❌ Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
