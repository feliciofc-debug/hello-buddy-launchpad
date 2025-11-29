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
    const { lead, produto, objetivo } = await req.json();

    console.log("[CREATE-STRATEGY] Criando estratégia para:", lead?.nome_completo);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const prompt = `Você é um estrategista comercial especializado em vendas B2B.

INFORMAÇÕES DO LEAD:
- Nome: ${lead?.nome_completo || 'Não informado'}
- Profissão: ${lead?.profissao || 'Não informado'}
- Especialidade: ${lead?.especialidade || 'Não informado'}
- Cidade: ${lead?.cidade || 'Não informado'}/${lead?.estado || 'Não informado'}
- LinkedIn: ${lead?.linkedin_url || 'Não disponível'}
- Instagram: ${lead?.instagram_username || 'Não disponível'}
- Email: ${lead?.email || 'Não disponível'}
- Score: ${lead?.score || 0}

PRODUTO A OFERECER: ${produto || 'Solução empresarial'}
OBJETIVO: ${objetivo || 'Agendar reunião comercial'}

TAREFA:
Crie uma estratégia de abordagem comercial PERSONALIZADA baseada no perfil deste profissional.

Retorne APENAS o JSON válido (sem markdown):
{
  "perfil_comportamental": "descrição do perfil",
  "dores_identificadas": ["dor1", "dor2", "dor3"],
  "pontos_de_conexao": ["ponto1", "ponto2"],
  "abordagem_recomendada": "como abordar",
  "horario_ideal": "melhor horário para contato",
  "tom_mensagem": "formal/informal/técnico",
  "gatilhos_mentais": ["gatilho1", "gatilho2"],
  "call_to_action": "ação desejada"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um estrategista de vendas B2B experiente. Sempre responda apenas com JSON válido." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CREATE-STRATEGY] Erro na API:", errorText);
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("[CREATE-STRATEGY] Resposta IA:", content);

    // Extrair JSON da resposta
    let strategy;
    try {
      // Tentar parsear diretamente
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        strategy = JSON.parse(jsonMatch[0]);
      } else {
        strategy = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("[CREATE-STRATEGY] Erro ao parsear JSON:", parseError);
      // Fallback com estratégia padrão
      strategy = {
        perfil_comportamental: `Profissional de ${lead?.profissao || 'área técnica'} em ${lead?.cidade || 'região'}`,
        dores_identificadas: ["Otimização de processos", "Redução de custos", "Aumento de eficiência"],
        pontos_de_conexao: [`Atuação em ${lead?.especialidade || lead?.profissao}`, `Localização em ${lead?.cidade}`],
        abordagem_recomendada: "Abordagem consultiva focada em resultados",
        horario_ideal: "Entre 10h e 12h ou 14h e 16h",
        tom_mensagem: "informal",
        gatilhos_mentais: ["Prova social", "Escassez"],
        call_to_action: "Agendar conversa rápida de 15 minutos"
      };
    }

    console.log("[CREATE-STRATEGY] Estratégia criada:", strategy);

    return new Response(JSON.stringify(strategy), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[CREATE-STRATEGY] Erro:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
