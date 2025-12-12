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
    const { numeroNovo } = await req.json();

    console.log('🔄 Iniciando atualização de número');
    console.log('Novo número:', numeroNovo);

    if (!numeroNovo) {
      return new Response(
        JSON.stringify({ error: 'Número novo é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Buscar TODOS os cadastros com opt-in
    const { data: cadastros, error } = await supabase
      .from('cadastros')
      .select('id, nome, whatsapp, opt_in')
      .eq('opt_in', true);

    if (error) throw error;

    console.log(`📊 ${cadastros?.length || 0} cadastros com opt-in para notificar`);

    let processados = 0;
    let mensagensEnviadas = 0;
    let erros = 0;

    // Formatar número para exibição
    const numeroFormatado = numeroNovo.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');

    // 2. Para cada cadastro com opt-in, enviar mensagem de atualização
    for (const cadastro of cadastros || []) {
      processados++;

      try {
        if (cadastro.whatsapp) {
          const mensagem = `Olá ${cadastro.nome}! 👋

Este é o *NOVO NÚMERO* da AMZ Ofertas! 🎉

📱 *Salve este número:* ${numeroFormatado}

✅ Salve na sua agenda como "AMZ Ofertas"
✅ Este é nosso novo número oficial

Obrigado pela confiança! 🙏`;

          // Enviar mensagem via Wuzapi
          const { error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
            body: {
              phone: cadastro.whatsapp.replace(/\D/g, ''),
              message: mensagem,
              tipo: 'atualizacao_numero'
            }
          });

          if (sendError) {
            console.error(`⚠️ Erro ao enviar para ${cadastro.whatsapp}:`, sendError);
            erros++;
          } else {
            mensagensEnviadas++;
            console.log(`✅ Mensagem enviada para ${cadastro.nome}`);
          }

          // Delay 2 segundos entre mensagens (evitar ban)
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Log a cada 10 processados
        if (processados % 10 === 0) {
          console.log(`📊 Progresso: ${processados}/${cadastros?.length || 0}`);
        }

      } catch (err) {
        console.error(`Erro ao processar ${cadastro.id}:`, err);
        erros++;
      }
    }

    console.log('✅ Atualização concluída');
    console.log(`Processados: ${processados}`);
    console.log(`Mensagens enviadas: ${mensagensEnviadas}`);
    console.log(`Erros: ${erros}`);

    return new Response(
      JSON.stringify({
        success: true,
        processados,
        mensagensEnviadas,
        erros
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);

    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
