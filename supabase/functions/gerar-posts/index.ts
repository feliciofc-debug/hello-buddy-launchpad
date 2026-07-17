import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { produto } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log(`Gerando posts para produto: ${produto.nome}`);

    const descricao = (produto.descricao || '').toString().trim();
    const temBriefing = descricao.length > 10;
    const tagsArr = Array.isArray(produto.tags) ? produto.tags.filter(Boolean) : [];
    const beneficios = (produto.beneficios || '').toString().trim();
    const categoria = (produto.categoria || '').toString().trim();

    const nomeLower = (produto.nome || '').toLowerCase();
    const descLower = descricao.toLowerCase();
    const categLower = categoria.toLowerCase();
    const ehConsorcio = /consorci|consórci/.test(nomeLower + ' ' + descLower + ' ' + categLower);

    // Extrai nomes próprios do briefing (heurística: sequência de palavras Capitalizadas)
    const nomesDetectados: string[] = [];
    if (temBriefing) {
      const matches = descricao.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){0,3}\b/g) || [];
      const stop = new Set(['Consórcio','Consorcio','Ademicon','Facebook','Instagram','WhatsApp','Brasil','Rio','São','Paulo','Janeiro']);
      for (const m of matches) {
        if (!stop.has(m) && !nomesDetectados.includes(m)) nomesDetectados.push(m);
      }
    }

    const blocoBriefing = temBriefing
      ? `\n========================================\n⚠️ BRIEFING DO CLIENTE (FONTE ÚNICA DE VERDADE):\n"${descricao}"\n\n${nomesDetectados.length ? `NOMES PRÓPRIOS DETECTADOS NO BRIEFING (ÚNICOS PERMITIDOS): ${nomesDetectados.join(', ')}\n` : ''}REGRAS ABSOLUTAS SOBRE O BRIEFING:\n1. Use SOMENTE fatos, nomes, pessoas, contextos e chamadas que estão explicitamente no briefing ou nos campos do produto abaixo. NÃO invente NADA.\n2. Se o briefing citar uma PESSOA (ex: quem indica, quem é o especialista/consultor, quem aparece no vídeo, cliente, atleta, celebridade), essa pessoa DEVE aparecer nominalmente em TODAS as 9 variações, com o papel descrito no briefing.\n3. É TERMINANTEMENTE PROIBIDO usar QUALQUER nome próprio que NÃO esteja na lista de nomes detectados acima. Nada de "Felício", "João", "Maria", "Ana", "Carlos" ou qualquer outro nome — só os nomes literais do briefing.\n4. NÃO troque, abrevie nem substitua nomes próprios. Se o briefing diz "Marcelo Martins", use "Marcelo Martins" (ou "Marcelo") — nunca outro nome.\n5. Respeite o TOM do briefing (institucional, agradecimento, indicação, comemorativo, educativo). NÃO force pitch de venda se o briefing não pede.\n6. Se o briefing descreve um VÍDEO/DEPOIMENTO/INDICAÇÃO de alguém, TODAS as 9 variações devem citar essa pessoa e esse formato — nunca contradizer.\n========================================\n`
      : `\n========================================\n⚠️ SEM BRIEFING ESPECÍFICO. REGRAS:\n- É PROIBIDO inventar nome próprio de pessoa (consultor, cliente, especialista). NÃO escreva "Felício", "João", "Marcelo" nem qualquer nome — o post fala do produto, não de uma pessoa.\n- Fale apenas do produto e seus benefícios reais listados abaixo.\n========================================\n`;

    const blocoAntiInvencao = `\n🚫 PROIBIDO INVENTAR (regra dura, vale para TODAS as 9 variações):\n- Preços, descontos, "de/por", % OFF, cupom, frete grátis que não estejam nos campos do produto.\n- Prazos artificiais: "só hoje", "últimas horas", "acaba meia-noite", "contagem regressiva" — a menos que o briefing explicitamente peça.\n- Escassez de estoque: "estoque limitado", "últimas unidades", "poucas peças", "vagas limitadas", "restam X" — NUNCA usar.\n${ehConsorcio ? '- Este produto é CONSÓRCIO: é PROIBIDO qualquer linguagem de estoque, unidades, peças, "compre agora que acaba", pronta-entrega. Consórcio trabalha com carta de crédito, assembleias mensais, contemplação por sorteio/lance, parcelas — use APENAS esse vocabulário. Fale de planejamento, poder de compra, parcela que cabe no bolso, sonho do imóvel/veículo, contemplação.\n' : ''}- Depoimentos, números de clientes, prêmios, garantias que não estejam no briefing.\n- Nomes de pessoas que não estejam no briefing. Se o briefing cita um nome, use EXATAMENTE esse nome.\n`;

    const prompt = `Crie posts para o seguinte produto:
${blocoBriefing}${blocoAntiInvencao}
Produto: ${produto.nome}
${produto.preco ? `Preço: R$ ${produto.preco}` : ''}
${categoria ? `Categoria: ${categoria}` : ''}
${tagsArr.length ? `Tags: ${tagsArr.join(', ')}` : ''}
${beneficios ? `Benefícios: ${beneficios}` : ''}
${produto.rating ? `Avaliação: ${produto.rating} estrelas (${produto.reviews} reviews)` : ''}
${produto.comissao ? `Comissão: R$ ${produto.comissao}` : ''}

${temBriefing
  ? 'Gere 9 variações de posts (3 por formato) SEMPRE respeitando fielmente o briefing acima (pessoas citadas, formato, tom). As "variações" são de FORMATO/ABORDAGEM, nunca contradizem o briefing:'
  : 'Gere 9 variações de posts, 3 para cada tipo:'}

INSTAGRAM (3 variações):
- Opção A: Direto, com CTA claro (sem inventar urgência/escassez)
- Opção B: Storytelling — conte a história descrita no briefing
- Opção C: Educativo — ensine algo real sobre o tema${ehConsorcio ? ' (consórcio, planejamento, contemplação)' : ''}

FACEBOOK (3 variações):
- Opção A: Casual/amigável, tom de conversa
- Opção B: Profissional/informativo, com benefícios reais do briefing
- Opção C: Chamada para ação forte${ehConsorcio ? ' focada em simulação/atendimento com o consultor citado no briefing (nunca escassez)' : ' (sem inventar prazo/estoque)'}

STORY INSTAGRAM (3 variações, MAX 80 caracteres cada):
- Opção A: Curto e impactante com emoji
- Opção B: Pergunta interativa para engajamento
- Opção C: Convite direto pra falar com o consultor/especialista citado no briefing


Retorne APENAS um JSON válido no formato:
{
  "instagram": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
  },
  "facebook": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
  },
  "story": {
    "opcaoA": "texto curto aqui (max 80 chars)",
    "opcaoB": "texto curto aqui (max 80 chars)",
    "opcaoC": "texto curto aqui (max 80 chars)"
  }
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em marketing digital. Retorne APENAS o JSON solicitado, sem texto adicional, sem introduções, sem repetir o prompt ou instruções.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 1500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns instantes.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Por favor, adicione créditos ao workspace.');
      }
      
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    let texto = data.choices[0].message.content;
    
    console.log('Resposta da Lovable AI:', texto);

    // Remover marcadores de código markdown (```json e ```)
    texto = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    console.log('Texto após remover markdown:', texto);

    // Extrair JSON da resposta
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta da IA não contém JSON válido');
    }

    // Remover vírgulas extras antes de fechar chaves/colchetes (trailing commas)
    let jsonStr = jsonMatch[0]
      .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
      .replace(/[\u201C\u201D]/g, '"') // Substitui aspas curvas por aspas normais
      .replace(/[\u2018\u2019]/g, "'") // Substitui aspas simples curvas
      .trim();
    
    console.log('JSON limpo para parse:', jsonStr);

    const resultado = JSON.parse(jsonStr);
    
    console.log(`Posts gerados com sucesso para 3 plataformas`);

    return new Response(
      JSON.stringify({ posts: resultado }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao gerar posts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});