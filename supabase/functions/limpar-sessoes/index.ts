import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cron job: Limpa sessões antigas a cada hora
 * Desativa sessões que não interagiram por mais de 1 hora
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 Iniciando limpeza de sessões antigas...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Desativar sessões com mais de 1 hora
    const tempoLimite = new Date(Date.now() - 60 * 60000).toISOString(); // 1 hora atrás
    
    const { data: sessoesDesativadas, error: sessaoError } = await supabase
      .from('sessoes_ativas')
      .update({ ativa: false })
      .eq('ativa', true)
      .lt('ultima_interacao', tempoLimite)
      .select('id');

    if (sessaoError) {
      console.error('❌ Erro ao desativar sessões:', sessaoError);
      throw sessaoError;
    }

    console.log(`✅ ${sessoesDesativadas?.length || 0} sessões desativadas`);

    // Limpar campanhas antigas (mais de 24 horas)
    const tempoLimiteCampanha = new Date(Date.now() - 24 * 60 * 60000).toISOString(); // 24 horas atrás
    
    const { data: campanhasLimpas, error: campanhaError } = await supabase
      .from('campanhas_ativas')
      .delete()
      .lt('enviado_em', tempoLimiteCampanha)
      .select('id');

    if (campanhaError) {
      console.error('❌ Erro ao limpar campanhas:', campanhaError);
    } else {
      console.log(`✅ ${campanhasLimpas?.length || 0} campanhas antigas removidas`);
    }

    // Limpar histórico de envios antigo (mais de 7 dias)
    const tempoLimiteHistorico = new Date(Date.now() - 7 * 24 * 60 * 60000).toISOString(); // 7 dias atrás
    
    const { data: historicoLimpo, error: historicoError } = await supabase
      .from('historico_envios')
      .delete()
      .lt('timestamp', tempoLimiteHistorico)
      .select('id');

    if (historicoError) {
      console.error('❌ Erro ao limpar histórico:', historicoError);
    } else {
      console.log(`✅ ${historicoLimpo?.length || 0} registros de histórico removidos`);
    }

    console.log('🧹 Limpeza concluída!');

    return new Response(
      JSON.stringify({ 
        success: true,
        timestamp: new Date().toISOString(),
        sessoesDesativadas: sessoesDesativadas?.length || 0,
        campanhasLimpas: campanhasLimpas?.length || 0,
        historicoLimpo: historicoLimpo?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro na limpeza:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});