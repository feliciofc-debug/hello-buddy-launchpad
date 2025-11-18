import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Criar usuário empresa
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: 'expo@atombrasildigital.com',
      password: 'Dcd318798$',
      email_confirm: true,
      user_metadata: {
        nome: 'Atom Brasil Digital',
        tipo: 'empresa'
      }
    });

    if (signUpError) {
      console.error('Erro ao criar usuário:', signUpError);
      return new Response(
        JSON.stringify({ error: signUpError.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Usuário empresa criado com sucesso:', user.user?.id);

    // Atualizar perfil com dados completos
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nome: 'Atom Brasil Digital',
        tipo: 'empresa',
        plano: 'empresas',
        razao_social: 'Atom Brasil Digital',
        cpf_cnpj: '22.003.550/0001-05',
        nome_fantasia: 'Atom Brasil',
        valor_plano: 447.00
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
        message: 'Usuário empresa criado com sucesso!',
        email: 'expo@atombrasildigital.com',
        password: 'Dcd318798$',
        userId: user.user?.id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
