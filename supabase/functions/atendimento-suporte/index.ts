import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base de conhecimento completa da plataforma AMZ Ofertas
const KNOWLEDGE_BASE = `
# AMZ OFERTAS - BASE DE CONHECIMENTO COMPLETA

## SOBRE A PLATAFORMA
A AMZ Ofertas é uma plataforma completa de marketing digital com inteligência artificial para pequenas e médias empresas. Ajudamos empresas a criar, agendar e publicar conteúdo profissional em redes sociais de forma automatizada.

## PRINCIPAIS FUNCIONALIDADES

### 1. CRIAÇÃO DE CONTEÚDO COM IA
- Geração automática de textos para posts usando IA avançada (Google Gemini)
- 3 variações de texto para cada post
- Otimização específica para cada rede social (Instagram, Facebook, WhatsApp)
- Criação de legendas persuasivas e hashtags relevantes

### 2. AGENDAMENTO DE POSTS
- Agendamento para Instagram Feed e Stories
- Agendamento para Facebook
- Frequências: Imediato, Uma vez, Diário, Semanal, Personalizado
- Múltiplos horários por dia
- Calendário visual de publicações

### 3. CATÁLOGO DE PRODUTOS
- Upload de fotos de produtos
- Análise automática de produtos com IA
- Organização por categorias
- Histórico completo de campanhas por produto

### 4. CAMPANHAS DE WHATSAPP
- Envio em massa para listas de transmissão
- Personalização com {{nome}}, {{produto}}, {{preco}}
- Agendamento de campanhas
- Métricas de envio e resposta

### 5. BIBLIOTECA DE CAMPANHAS
- Histórico de todas as campanhas realizadas
- Métricas de desempenho (alcance, engajamento, conversões)
- Reutilização de campanhas de sucesso
- Integração com Google Ads para remarketing

### 6. GESTÃO DE LEADS/PROSPECTS (B2B e B2C)
- Descoberta automática de leads qualificados
- Enriquecimento de dados (LinkedIn, Instagram, telefone)
- Score de qualificação automático
- Funil Kanban com 7 estágios
- Geração de mensagens personalizadas com IA
- Validação manual de leads

### 7. ATENDIMENTO COM IA (WhatsApp)
- Respostas automáticas humanizadas
- Contexto completo do produto/serviço
- Detecção de leads quentes
- Handoff para atendimento humano
- Histórico de conversas

### 8. MARKETPLACE PÚBLICO
- Vitrine de produtos de todos os vendedores
- 15 categorias principais
- Busca e filtros avançados
- Compra direta via link do vendedor
- Contato via WhatsApp

### 9. ANALYTICS/MÉTRICAS
- Dashboard com métricas em tempo real
- Total de mensagens enviadas
- Taxa de conversão
- Leads no funil
- Comparativo de campanhas
- Exportação PDF/Excel

### 10. GESTÃO DE VENDEDORES
- Cadastro de equipe de vendas
- Atribuição de leads por vendedor
- Metas e comissões
- Painel exclusivo do vendedor
- Controle de acesso

## PLANOS E PREÇOS

### PLANO EMPRESAS - R$ 447/mês
Ou R$ 4.470/ano (2 meses grátis)

Inclui:
- Postagens Ilimitadas
- IA Avançada (Google Gemini)
- Instagram + Facebook
- Agendamento Automático
- Biblioteca de Conteúdo
- Catálogo de Produtos
- Análise de Desempenho
- Suporte Prioritário
- Atualizações Gratuitas
- 7 Dias de Teste Grátis (sem cartão)

## FORMAS DE PAGAMENTO
- Cartão de Crédito (todas as bandeiras)
- Boleto Bancário
- PIX
- Pagamento anual com desconto

## TESTE GRÁTIS
- 7 dias completos
- Acesso a todas as funcionalidades
- Sem necessidade de cartão de crédito
- Sem compromisso

## SUPORTE TÉCNICO
- Chat ao vivo na plataforma
- WhatsApp: (21) 99537-9550
- Email: suporte@amzofertas.com.br
- Horário: Segunda a Sexta, 9h às 18h

## COMO COMEÇAR
1. Acesse amzofertas.com.br
2. Clique em "Começar Agora"
3. Crie sua conta gratuitamente
4. Configure seu perfil e empresa
5. Adicione seus produtos
6. Comece a criar conteúdo com IA!

## INTEGRAÇÕES DISPONÍVEIS
- Instagram (Feed e Stories)
- Facebook
- WhatsApp Business
- Google Ads
- Meta Ads (em breve)

## SEGURANÇA
- Dados criptografados
- Autenticação segura
- Backups diários
- LGPD compliance

## CANCELAMENTO
- Cancele a qualquer momento
- Sem multa ou taxa de cancelamento
- Seus dados ficam disponíveis por 30 dias após cancelamento
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Mensagem não fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Construir histórico de conversa
    const historyMessages = conversationHistory.slice(-6).map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    const systemPrompt = `Você é a assistente virtual oficial da AMZ Ofertas, uma plataforma de marketing digital com IA.

PERSONALIDADE:
- Seja simpática, prestativa e profissional
- Use linguagem informal mas educada (pode usar "você", "vc", "tá")
- Seja objetiva nas respostas (máximo 3-4 parágrafos)
- Use emojis com moderação (1-2 por mensagem)
- Sempre ofereça ajuda adicional no final

CONHECIMENTO COMPLETO DA PLATAFORMA:
${KNOWLEDGE_BASE}

REGRAS:
1. Responda APENAS sobre a AMZ Ofertas e seus serviços
2. Se não souber algo específico, direcione para o suporte: (21) 99537-9550
3. Para dúvidas sobre pagamento, sempre mencione as opções disponíveis
4. Para problemas técnicos, peça mais detalhes antes de sugerir soluções
5. Incentive o teste grátis de 7 dias quando apropriado
6. Nunca invente funcionalidades que não existem

FORMATO DAS RESPOSTAS:
- Seja direta e objetiva
- Use bullet points quando listar funcionalidades
- Inclua links ou números de contato quando relevante
- Termine oferecendo mais ajuda`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API:', response.status, errorText);
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta. Por favor, entre em contato pelo WhatsApp: (21) 99537-9550';

    console.log('[ATENDIMENTO-SUPORTE] Mensagem recebida:', message);
    console.log('[ATENDIMENTO-SUPORTE] Resposta gerada:', aiResponse.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ATENDIMENTO-SUPORTE] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar mensagem',
        response: 'Ops! Tive um probleminha técnico. 😅 Por favor, tente novamente ou fale diretamente conosco pelo WhatsApp: (21) 99537-9550'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
