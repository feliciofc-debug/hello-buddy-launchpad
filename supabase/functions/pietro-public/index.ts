import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EnsureBody = {
  action: 'ensure';
  sessionId: string;
  userAgent?: string | null;
  visitor_name?: string | null;
  visitor_email?: string | null;
  visitor_phone?: string | null;
  visitor_company?: string | null;
  initialMessage?: string | null;
};

type MessageBody = {
  action: 'message';
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  extracted?: {
    name?: string | null;
    phone?: string | null;
  };
};

type Body = EnsureBody | MessageBody;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (body.action === 'ensure') {
      if (!body.sessionId) {
        return new Response(JSON.stringify({ error: 'sessionId obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Cria sempre uma nova conversa por sessão (sessionId já é único no cliente)
      const { data: convo, error: convoError } = await supabase
        .from('pietro_conversations')
        .insert({
          session_id: body.sessionId,
          status: 'active',
          user_agent: body.userAgent ?? null,
          visitor_name: body.visitor_name ?? null,
          visitor_email: body.visitor_email ?? null,
          visitor_phone: body.visitor_phone ?? null,
          visitor_company: body.visitor_company ?? null,
        })
        .select('id')
        .single();

      if (convoError) {
        console.error('[PIETRO_PUBLIC] erro ao criar conversa', convoError);
        return new Response(JSON.stringify({ error: 'erro ao criar conversa' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const initial = body.initialMessage?.trim();
      if (initial) {
        const { error: msgError } = await supabase.from('pietro_messages').insert({
          conversation_id: convo.id,
          role: 'assistant',
          content: initial,
        });

        if (msgError) {
          console.error('[PIETRO_PUBLIC] erro ao salvar msg inicial', msgError);
        }
      }

      return new Response(JSON.stringify({ conversationId: convo.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'message') {
      if (!body.conversationId || !body.content || !body.role) {
        return new Response(JSON.stringify({ error: 'dados obrigatórios faltando' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: msgError } = await supabase.from('pietro_messages').insert({
        conversation_id: body.conversationId,
        role: body.role,
        content: body.content,
      });

      if (msgError) {
        console.error('[PIETRO_PUBLIC] erro ao salvar mensagem', msgError);
        return new Response(JSON.stringify({ error: 'erro ao salvar mensagem' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Atualiza nome/telefone se vier extraído e se ainda estiver vazio
      if (body.role === 'user' && (body.extracted?.name || body.extracted?.phone)) {
        const { data: convo } = await supabase
          .from('pietro_conversations')
          .select('visitor_name, visitor_phone')
          .eq('id', body.conversationId)
          .maybeSingle();

        const update: Record<string, string> = {};
        if (body.extracted?.name && !convo?.visitor_name) update.visitor_name = body.extracted.name;
        if (body.extracted?.phone && !convo?.visitor_phone) update.visitor_phone = body.extracted.phone;

        if (Object.keys(update).length > 0) {
          const { error: updError } = await supabase
            .from('pietro_conversations')
            .update(update)
            .eq('id', body.conversationId);

          if (updError) console.error('[PIETRO_PUBLIC] erro ao atualizar convo', updError);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido';
    console.error('[PIETRO_PUBLIC] erro geral', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
