import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Criar usuário admin afiliados
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: 'afiliados@amzofertas.com.br',
      password: 'amz777888520',
      email_confirm: true,
      user_metadata: {
        nome: 'Admin Afiliados',
        tipo: 'afiliado_admin'
      }
    });

    if (signUpError) {
      console.error('Erro ao criar usuário:', signUpError);
      return new Response(
        JSON.stringify({ error: signUpError.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Usuário admin afiliados criado:', user.user?.id);

    // Atualizar perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nome: 'Admin Afiliados',
        tipo: 'afiliado_admin',
        plano: 'afiliado'
      })
      .eq('id', user.user?.id);

    if (profileError) {
      console.error('Erro ao atualizar perfil:', profileError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuário admin afiliados criado!',
        email: 'afiliados@amzofertas.com.br',
        userId: user.user?.id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
