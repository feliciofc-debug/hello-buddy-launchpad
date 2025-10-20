import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Criar usuário revisor da Shopee
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: 'shopee_reviewer@review.shopee.com',
      password: 'ShopeeReview@2025!',
      email_confirm: true,
      user_metadata: {
        nome: 'Shopee Reviewer',
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
        message: 'Usuário shopee_reviewer criado com sucesso!',
        email: 'shopee_reviewer@review.shopee.com',
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
