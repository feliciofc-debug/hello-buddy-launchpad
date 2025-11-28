import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar usuário pelo email antigo
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Erro ao listar usuários:', listError);
      return new Response(
        JSON.stringify({ error: listError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encontrar o usuário com email antigo ou novo
    const oldUser = users.users.find(u => 
      u.email === 'shopee_reviewer@review.shopee.com' || 
      u.email === 'expo@atombrasildigital.com'
    );

    if (oldUser) {
      // Atualizar email e senha do usuário existente
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        oldUser.id,
        {
          email: 'expo@atombrasildigital.com',
          password: 'Amz520741$',
          email_confirm: true,
          user_metadata: {
            nome: 'Expo Reviewer',
            role: 'reviewer'
          }
        }
      );

      if (updateError) {
        console.error('Erro ao atualizar usuário:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Usuário atualizado com sucesso:', updatedUser.user?.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Credenciais atualizadas com sucesso!',
          email: 'expo@atombrasildigital.com',
          userId: updatedUser.user?.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Criar novo usuário se não existir
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: 'expo@atombrasildigital.com',
        password: 'Amz520741$',
        email_confirm: true,
        user_metadata: {
          nome: 'Expo Reviewer',
          role: 'reviewer'
        }
      });

      if (createError) {
        console.error('Erro ao criar usuário:', createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Usuário criado com sucesso:', newUser.user?.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Usuário criado com sucesso!',
          email: 'expo@atombrasildigital.com',
          userId: newUser.user?.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
