import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, empresa, tipo } = await req.json();

    console.log(`🏢 Criando usuário cliente: ${email} - ${empresa} - ${tipo}`);

    // Verificar se usuário já existe
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUsers?.users?.find(u => u.email === email);

    if (userExists) {
      console.log(`⚠️ Usuário já existe: ${email}`);
      
      // Atualizar profile existente
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          nome: empresa,
          tipo: tipo,
          nome_fantasia: empresa
        })
        .eq('id', userExists.id);

      if (updateError) {
        console.error('Erro ao atualizar perfil:', updateError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Usuário já existe, perfil atualizado',
          userId: userExists.id,
          email
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar novo usuário
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome: empresa,
        tipo: tipo
      }
    });

    if (signUpError) {
      console.error('❌ Erro ao criar usuário:', signUpError);
      return new Response(
        JSON.stringify({ error: signUpError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Usuário criado com sucesso:', user.user?.id);

    // Atualizar perfil com dados completos
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nome: empresa,
        tipo: tipo,
        nome_fantasia: empresa
      })
      .eq('id', user.user?.id);

    if (profileError) {
      console.error('Erro ao atualizar perfil:', profileError);
    } else {
      console.log('✅ Perfil atualizado com sucesso');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuário cliente criado com sucesso!',
        email,
        userId: user.user?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
