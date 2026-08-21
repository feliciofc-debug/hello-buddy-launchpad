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
    const { nome, whatsapp, email, origem, aceite, ip_address, user_agent, termo_aceite } = await req.json();
    
    console.log('📝 Registrando opt-in:', { nome, whatsapp, origem });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // 1. Validações
    if (!nome || !whatsapp) {
      console.log('❌ Dados incompletos');
      return new Response(
        JSON.stringify({ error: 'Nome e WhatsApp são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!aceite) {
      console.log('❌ Aceite não marcado');
      return new Response(
        JSON.stringify({ error: 'É necessário aceitar os termos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 2. Limpar telefone para formato padrão
    const telefoneLimpo = whatsapp.replace(/\D/g, '');
    const telefoneFormatado = telefoneLimpo.length === 11 
      ? `55${telefoneLimpo}` 
      : telefoneLimpo.length === 13 && telefoneLimpo.startsWith('55')
        ? telefoneLimpo
        : `55${telefoneLimpo}`;
    
    console.log('📱 Telefone formatado:', telefoneFormatado);
    
    // 3. Verificar se já existe
    const { data: existente } = await supabase
      .from('opt_ins')
      .select('id')
      .eq('whatsapp', whatsapp)
      .single();
    
    if (existente) {
      console.log('⚠️ WhatsApp já cadastrado:', existente.id);
      return new Response(
        JSON.stringify({ error: 'Este WhatsApp já está cadastrado', duplicate: true }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 4. Registrar em opt_ins
    const { data: optIn, error: optInError } = await supabase
      .from('opt_ins')
      .insert({
        nome: nome.trim(),
        whatsapp: whatsapp,
        email: email || null,
        origem: origem || 'site_footer',
        opt_in_aceito: true,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
        termo_aceite: termo_aceite || 'Autorizo a AMZ Ofertas a me enviar informações, ofertas e conteúdos via WhatsApp.',
        status: 'ativo'
      })
      .select()
      .single();
    
    if (optInError) {
      console.error('❌ Erro ao inserir opt-in:', optInError);
      throw optInError;
    }
    
    console.log('✅ Opt-in registrado:', optIn.id);
    
    // 5. Aguardar trigger processar (sync para cadastros)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 6. Verificar se criou em cadastros
    const { data: cadastro } = await supabase
      .from('cadastros')
      .select('id, nome, whatsapp')
      .eq('whatsapp', whatsapp)
      .single();
    
    console.log('📋 Cadastro:', cadastro ? 'criado' : 'pendente');
    
    // 7. Enviar WhatsApp de boas-vindas
    let whatsappEnviado = false;
    try {
      const mensagemBoasVindas = `Olá ${nome.split(' ')[0]}! 👋

Bem-vindo à *AMZ Ofertas*! 🎉

Você está cadastrado para receber nossas *melhores ofertas* e promoções exclusivas aqui no WhatsApp.

Fique ligado! Em breve você receberá ofertas imperdíveis! 🔥

_Para sair da lista, responda SAIR a qualquer momento._`;
      
      // Canal oficial Meta Cloud API
      const AMZ_TENANT_USER_ID = 'b7af0118-c506-4f87-8ac3-a0a11fd621fe';
      const { error: sendError } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          user_id: AMZ_TENANT_USER_ID,
          to: telefoneFormatado,
          message: mensagemBoasVindas
        }
      });
      
      if (sendError) {
        console.error('⚠️ Erro ao enviar WhatsApp:', sendError);
      } else {
        whatsappEnviado = true;
        console.log('✅ WhatsApp de boas-vindas enviado');
      }
      
    } catch (whatsappError) {
      console.error('⚠️ Erro ao enviar WhatsApp:', whatsappError);
      // Não falhar o cadastro por causa do WhatsApp
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        optInId: optIn.id,
        cadastroId: cadastro?.id,
        whatsappEnviado
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar cadastro';
    console.error('❌ Erro geral:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
