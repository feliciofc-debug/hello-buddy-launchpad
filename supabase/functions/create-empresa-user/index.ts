import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Criar usuária Renata
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: 'renatascarega@gmail.com',
      password: 'Dcd318798$',
      email_confirm: true,
      user_metadata: {
        nome: 'Renata Santos Silva Carega',
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

    console.log('✅ Usuária criada com sucesso:', user.user?.id);

    // Atualizar perfil - acesso COMPLETO permanente, sem trial, sem limites
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nome: 'Renata Santos Silva Carega',
        tipo: 'empresa',
        plano: 'empresarial_personalizado',
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
        message: 'Usuária Renata criada com sucesso! Acesso completo permanente.',
        email: 'renatascarega@gmail.com',
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
