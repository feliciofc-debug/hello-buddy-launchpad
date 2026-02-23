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

    const body = await req.json();
    const { userId, email, newPassword, newEmail } = body;

    if (!newPassword && !newEmail) {
      return new Response(
        JSON.stringify({ error: 'newPassword ou newEmail é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetUserId = userId;

    // Se não passou userId, buscar pelo email
    if (!targetUserId && email) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === email);
      if (user) {
        targetUserId = user.id;
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar objeto de update
    const updateData: any = {};
    if (newPassword) updateData.password = newPassword;
    if (newEmail) {
      updateData.email = newEmail;
      updateData.email_confirm = true;
    }

    // Atualizar usuário
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      updateData
    );

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Usuário atualizado:', updatedUser.user?.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuário atualizado com sucesso!',
        email: updatedUser.user?.email,
        userId: updatedUser.user?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
