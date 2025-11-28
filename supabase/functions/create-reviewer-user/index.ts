import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Criar usuário revisor
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: 'expo@atombrasildigital.com',
      password: 'Amz520741$',
      email_confirm: true,
      user_metadata: {
        nome: 'Expo Reviewer',
        role: 'reviewer'
      }
    });

    if (signUpError) {
      console.error('Erro ao criar usuário:', signUpError);
      return new Response(
        JSON.stringify({ error: signUpError.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Usuário revisor criado com sucesso:', user.user?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuário expo criado com sucesso!',
        email: 'expo@atombrasildigital.com',
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
