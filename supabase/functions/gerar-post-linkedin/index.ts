import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCopyStyle, userIdDoRequest } from "../_shared/copy-style.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const HASHTAGS_PROIBIDAS = [
  '#JurosBaixos', '#Investimento', '#Renda', '#DinheiroRapido', '#DinheiroRápido', '#Oportunidade',
];

const REGEX_CONVITE =
  /(me chama|fale comigo|entre em contato|clica|clique|link na bio|saiba mais|comenta|chama no direct)/i;

const REGEX_EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

function sanitizar(texto: string): string {
  let out = String(texto || '');

  // 1) emojis
  out = out.replace(REGEX_EMOJI, '');

  // 2) hashtags proibidas
  for (const h of HASHTAGS_PROIBIDAS) {
    out = out.replace(new RegExp(`${h}\\b`, 'gi'), '');
  }

  // 3) última linha de convite/pergunta
  const linhas = out.split('\n').map((l) => l.trimEnd());
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  if (linhas.length > 1) {
    const ultima = linhas[linhas.length - 1].trim();
    const ehHashtagLine = /^#\S/.test(ultima);
    if (!ehHashtagLine && (REGEX_CONVITE.test(ultima) || /\?$/.test(ultima))) {
      linhas.pop();
    } else if (ehHashtagLine && linhas.length > 2) {
      const anterior = linhas[linhas.length - 2].trim();
      if (anterior && (REGEX_CONVITE.test(anterior) || /\?$/.test(anterior))) {
        linhas.splice(linhas.length - 2, 1);
      }
    }
  }
  out = linhas.join('\n');

  // 4) colapsar quebras
  out = out.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();

  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tema = String(body?.tema || '').trim();
    if (!tema) return ok({ success: false, error: 'Informe o tema do post' });

    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const ehServiceRole = Boolean(serviceKey) && authHeader.includes(serviceKey);

    const userId = ehServiceRole
      ? (String(body?.user_id || '').trim() || null)
      : (userIdDoRequest(req) || String(body?.user_id || '').trim() || null);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return ok({ success: false, error: 'LOVABLE_API_KEY não configurada' });

    const sbAdmin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const copyStyle = await getCopyStyle(sbAdmin, userId);

    // Contexto de produto (opcional, isolado por user_id, NUNCA preço)
    let blocoProduto = '';
    const produtoId = String(body?.produto_id || '').trim();
    if (produtoId && userId) {
      const { data: produto } = await sbAdmin
        .from('produtos')
        .select('nome, categoria, descricao')
        .eq('id', produtoId)
        .eq('user_id', userId)
        .maybeSingle();
      if (produto) {
        blocoProduto = [
          '',
          '=== CONTEXTO (o produto é CONTEXTO, nunca a oferta) ===',
          `Nome: ${produto.nome || ''}`,
          produto.categoria ? `Categoria: ${produto.categoria}` : '',
          produto.descricao ? `Descrição: ${produto.descricao}` : '',
          '',
        ].filter(Boolean).join('\n');
      }
    }

    const ehConsorcio = /consorci|consórci/i.test(tema + ' ' + blocoProduto);

    const prompt = `${copyStyle.promptBlock}
Escreva posts para o LinkedIn sobre o tema abaixo.

TEMA / BRIEFING (fonte única de verdade):
"${tema}"
${blocoProduto}
=== VOZ INSTITUCIONAL (REGRA DURA, VALE PARA AS 3 VARIAÇÕES) ===
- Primeira pessoa do singular, sem egocentrismo. Tom elegante, de quem entende do assunto.
- NÃO é post de venda de produto. O foco é o NEGÓCIO e a geração de valor: um raciocínio útil, uma observação de mercado, um argumento técnico.
- A copy TERMINA NO RACIOCÍNIO. É PROIBIDO terminar em convite, pergunta, "me chama", "clica no link", "fale comigo", "saiba mais", "entre em contato", "comenta aqui".
- PROIBIDO emoji.
- PROIBIDO inventar número, percentual, prêmio, depoimento, quantidade de clientes ou qualquer dado que não esteja no tema/briefing.
- PROIBIDO urgência e escassez: "só hoje", "últimas vagas", "corre".
${ehConsorcio ? '- CONSÓRCIO: é PROIBIDO tratar consórcio como crédito, empréstimo, financiamento ou investimento, inclusive por comparação. Consórcio não tem juros. Vocabulário permitido: carta de crédito, assembleia, contemplação, lance, parcela, planejamento, poder de compra.\n' : ''}- Hashtags: exatamente 2 ou 3, no fim, sem emoji. PROIBIDAS: #JurosBaixos, #Investimento, #Renda, #DinheiroRapido, #Oportunidade.
- Tamanho de cada variação: entre 700 e 1300 caracteres.

=== 3 VARIAÇÕES COM ABORDAGENS DIFERENTES ===
A) Observação de mercado — parte de algo que se vê acontecendo e conclui.
B) Argumento técnico — explica um mecanismo pouco compreendido.
C) Bastidor profissional — uma situação real de trabalho e o que ela ensina.

Retorne APENAS: {"A":"texto","B":"texto","C":"texto"}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você escreve copy institucional para LinkedIn. Retorne APENAS o JSON solicitado, sem markdown, sem introduções.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.85,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`gerar-post-linkedin: gateway ${response.status}: ${errorText}`);
      if (response.status === 429) return ok({ success: false, error: 'Limite de requisições excedido. Tente em alguns instantes.' });
      if (response.status === 402) return ok({ success: false, error: 'Créditos de IA insuficientes.' });
      return ok({ success: false, error: `Erro na IA (${response.status})` });
    }

    const data = await response.json();
    let texto = String(data?.choices?.[0]?.message?.content || '');
    texto = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return ok({ success: false, error: 'Resposta da IA inválida' });

    const parsed = JSON.parse(
      jsonMatch[0]
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .trim(),
    );

    const opcoes = {
      A: sanitizar(parsed.A || ''),
      B: sanitizar(parsed.B || ''),
      C: sanitizar(parsed.C || ''),
    };

    return ok({ success: true, opcoes });
  } catch (err) {
    console.error('gerar-post-linkedin:', err);
    return ok({ success: false, error: err instanceof Error ? err.message : 'Erro inesperado' });
  }
});
