import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    console.log('🔄 Iniciando sincronização retroativa de opt-ins...');
    
    // 1. Buscar TODOS opt-ins ativos
    const { data: optIns, error } = await supabase
      .from('opt_ins')
      .select('*')
      .eq('opt_in_aceito', true);
    
    if (error) throw error;
    
    console.log(`📊 ${optIns?.length || 0} opt-ins para sincronizar`);
    
    let sincronizados = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhes: { whatsapp: string; status: string }[] = [];
    
    // 2. Para cada opt-in
    for (const optIn of optIns || []) {
      try {
        // Verificar se já existe em cadastros
        const { data: existente } = await supabase
          .from('cadastros')
          .select('id, opt_in')
          .eq('whatsapp', optIn.whatsapp)
          .single();
        
        if (existente) {
          // Atualizar se opt_in não está marcado
          if (!existente.opt_in) {
            await supabase
              .from('cadastros')
              .update({
                opt_in: true,
                opt_in_id: optIn.id,
                origem: optIn.origem || 'opt_in_retroativo'
              })
              .eq('id', existente.id);
            
            atualizados++;
            detalhes.push({ whatsapp: optIn.whatsapp, status: 'atualizado' });
          } else {
            detalhes.push({ whatsapp: optIn.whatsapp, status: 'já_sincronizado' });
          }
        } else {
          // Criar novo cadastro
          const { error: insertError } = await supabase
            .from('cadastros')
            .insert({
              nome: optIn.nome,
              whatsapp: optIn.whatsapp,
              email: optIn.email,
              opt_in: true,
              opt_in_id: optIn.id,
              origem: optIn.origem || 'opt_in_retroativo'
            });
          
          if (insertError) {
            console.error(`Erro ao inserir ${optIn.whatsapp}:`, insertError);
            erros++;
            detalhes.push({ whatsapp: optIn.whatsapp, status: 'erro' });
          } else {
            sincronizados++;
            detalhes.push({ whatsapp: optIn.whatsapp, status: 'criado' });
          }
        }
        
      } catch (err) {
        console.error(`Erro ao processar ${optIn.whatsapp}:`, err);
        erros++;
        detalhes.push({ whatsapp: optIn.whatsapp, status: 'erro' });
      }
    }
    
    console.log(`✅ Concluído: ${sincronizados} novos, ${atualizados} atualizados, ${erros} erros`);
    
    return new Response(
      JSON.stringify({
        success: true,
        total: optIns?.length || 0,
        sincronizados,
        atualizados,
        erros,
        detalhes: detalhes.slice(0, 50) // Limitar detalhes
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
