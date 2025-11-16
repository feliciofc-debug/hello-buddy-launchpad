import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = "http://191.252.193.73:8080";
const EVOLUTION_API_KEY = "AMZ_2024_SECRET";

interface WebhookPayload {
  from: string;
  mediaUrl: string;
  instanceName: string;
  messageId: string;
}

interface DadosComprovante {
  numero_pedido: string;
  valor_total: number;
  nome_produto: string;
  data_compra: string;
  status_pedido: string;
  e_comprovante_shopee: boolean;
  confianca: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const payload: WebhookPayload = await req.json();
    const { from, mediaUrl, instanceName, messageId } = payload;
    
    console.log('📥 Webhook recebido:', { from, instanceName, messageId });

    // Validar payload
    if (!from || !mediaUrl || !instanceName) {
      throw new Error('Dados incompletos no webhook');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. BAIXAR IMAGEM DO MEDIAURL
    console.log('📸 Baixando imagem...');
    const imageResponse = await fetch(mediaUrl);
    if (!imageResponse.ok) {
      throw new Error(`Erro ao baixar imagem: ${imageResponse.status}`);
    }
    
    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

    // 2. ANALISAR COM LOVABLE AI
    console.log('🤖 Analisando comprovante com IA...');
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurado');
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise esta imagem e determine se é um comprovante VÁLIDO da Shopee Brasil.

EXTRAIA os seguintes dados (se for comprovante válido):
- Número do pedido
- Valor total pago
- Nome do produto
- Data da compra
- Status do pedido

IMPORTANTE:
- Se NÃO for um comprovante da Shopee, retorne e_comprovante_shopee: false
- Se os dados não estiverem legíveis, reduza a confiança
- Seja preciso nos valores e datas
- Status comum: "Pedido confirmado", "Em transporte", "Entregue"

Retorne APENAS JSON válido no formato especificado.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_dados_comprovante",
              description: "Extrai dados estruturados do comprovante da Shopee",
              parameters: {
                type: "object",
                properties: {
                  numero_pedido: { 
                    type: "string",
                    description: "Número do pedido da Shopee"
                  },
                  valor_total: { 
                    type: "number",
                    description: "Valor total pago em reais"
                  },
                  nome_produto: { 
                    type: "string",
                    description: "Nome do produto comprado"
                  },
                  data_compra: { 
                    type: "string", 
                    format: "date",
                    description: "Data da compra no formato YYYY-MM-DD"
                  },
                  status_pedido: {
                    type: "string",
                    description: "Status atual do pedido"
                  },
                  e_comprovante_shopee: {
                    type: "boolean",
                    description: "true se for comprovante válido da Shopee, false caso contrário"
                  },
                  confianca: {
                    type: "number",
                    description: "Nível de confiança da análise (0-100)"
                  }
                },
                required: ["e_comprovante_shopee", "confianca"]
              }
            }
          }
        ],
        tool_choice: { 
          type: "function", 
          function: { name: "extrair_dados_comprovante" } 
        }
      })
    });

    // TRATAR ERROS DA API
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      
      if (aiResponse.status === 429) {
        console.error('⚠️ Rate limit excedido');
        await enviarMensagemWhatsApp(
          instanceName, 
          from,
          "⏳ Sistema temporariamente sobrecarregado. Aguarde alguns minutos e envie novamente."
        );
        
        await logAnalise(supabase, {
          tipo: 'rate_limit',
          whatsapp_cliente: from,
          erro: 'Rate limit excedido',
          tempo_processamento: Date.now() - startTime
        });
        
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      if (aiResponse.status === 402) {
        console.error('💳 Créditos insuficientes');
        await notificarAdmin('Créditos Lovable AI esgotados!');
        
        await enviarMensagemWhatsApp(
          instanceName,
          from,
          "⚠️ Sistema em manutenção. Sua solicitação será processada em breve."
        );
        
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      throw new Error(`Erro na API: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('Resposta da IA sem tool call');
    }

    const dadosExtraidos: DadosComprovante = JSON.parse(toolCall.function.arguments);
    
    console.log('✅ Dados extraídos:', dadosExtraidos);

    // 3. SALVAR NO BANCO
    const validacao = {
      numero_pedido: dadosExtraidos.numero_pedido || 'N/A',
      whatsapp_cliente: from,
      nome_cliente: null,
      produto_nome: dadosExtraidos.nome_produto || null,
      valor_compra: dadosExtraidos.valor_total || null,
      data_compra: dadosExtraidos.data_compra || null,
      status: dadosExtraidos.e_comprovante_shopee && dadosExtraidos.confianca >= 80 
        ? 'aprovado' 
        : 'pendente',
      imagem_url: mediaUrl,
      dados_ia: dadosExtraidos,
      confianca_ia: dadosExtraidos.confianca,
      ebook_enviado: false,
      message_id: messageId,
      instance_name: instanceName
    };

    const { data: validacaoSalva, error: dbError } = await supabase
      .from('validacoes_pedidos')
      .insert(validacao)
      .select()
      .single();

    if (dbError) {
      console.error('❌ Erro ao salvar no banco:', dbError);
      throw dbError;
    }

    // 4. LOG DE ANÁLISE
    await logAnalise(supabase, {
      tipo: 'analise_comprovante',
      whatsapp_cliente: from,
      confianca: dadosExtraidos.confianca,
      dados_extraidos: dadosExtraidos,
      tempo_processamento: Date.now() - startTime
    });

    // 5. DECIDIR AÇÃO BASEADO NA ANÁLISE
    if (!dadosExtraidos.e_comprovante_shopee) {
      // NÃO É COMPROVANTE SHOPEE
      await enviarMensagemWhatsApp(
        instanceName,
        from,
        `❌ *Ops!* A imagem enviada não parece ser um comprovante da Shopee.

Por favor, envie:
✅ Print da tela de confirmação do pedido
✅ Comprovante de pagamento da Shopee
✅ Imagem clara e legível

Precisa de ajuda? Fale com nosso suporte.`
      );

    } else if (dadosExtraidos.confianca < 80) {
      // CONFIANÇA BAIXA - REVISAR MANUALMENTE
      await enviarMensagemWhatsApp(
        instanceName,
        from,
        `⏳ *Comprovante em análise*

Recebemos sua imagem, mas alguns dados não estão claros.

Nossa equipe está validando manualmente e você receberá o e-book em até 2 horas.

Pedido: ${dadosExtraidos.numero_pedido || 'Em verificação'}

Obrigado pela paciência! 🙏`
      );

      await notificarAdmin(`Comprovante pendente de validação manual - WhatsApp: ${from}`);

    } else {
      // VÁLIDO - ENVIAR E-BOOK
      await processarComprovanteValido(
        supabase,
        validacaoSalva.id,
        instanceName,
        from,
        dadosExtraidos
      );
    }

    return new Response(JSON.stringify({ 
      success: true,
      validacao_id: validacaoSalva.id,
      status: validacao.status,
      confianca: dadosExtraidos.confianca
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Log do erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await logAnalise(supabase, {
        tipo: 'erro_fatal',
        erro: errorMessage,
        tempo_processamento: Date.now() - startTime
      });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// FUNÇÕES AUXILIARES

async function processarComprovanteValido(
  supabase: any,
  validacaoId: string,
  instanceName: string,
  clienteWhatsApp: string,
  dados: DadosComprovante
) {
  try {
    console.log('✅ Processando comprovante válido...');

    // Buscar e-book do produto
    const { data: produto } = await supabase
      .from('produtos_marketplace')
      .select('titulo, ebook_bonus')
      .ilike('titulo', `%${dados.nome_produto.substring(0, 30)}%`)
      .limit(1)
      .single();

    const ebookUrl = produto?.ebook_bonus || null;

    // Mensagem de aprovação
    const mensagem = `✅ *Comprovante APROVADO!*

Parabéns pela sua compra! 🎉

📦 Produto: ${dados.nome_produto}
💰 Valor: R$ ${dados.valor_total?.toFixed(2)}
📋 Pedido: ${dados.numero_pedido}

${ebookUrl ? '📚 Seu e-book está sendo enviado agora...' : '⚠️ E-book será enviado em breve.'}

Aproveite seu bônus! 🎁`;

    await enviarMensagemWhatsApp(instanceName, clienteWhatsApp, mensagem);

    // Enviar PDF se houver
    if (ebookUrl) {
      await enviarPDFWhatsApp(
        instanceName,
        clienteWhatsApp,
        ebookUrl,
        'Seu-Ebook-Gratis.pdf'
      );

      // Atualizar que e-book foi enviado
      await supabase
        .from('validacoes_pedidos')
        .update({ 
          ebook_enviado: true,
          validated_at: new Date().toISOString()
        })
        .eq('id', validacaoId);
    }

    console.log('📧 E-book enviado com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao processar comprovante válido:', error);
    throw error;
  }
}

async function enviarMensagemWhatsApp(
  instanceName: string,
  numero: string,
  texto: string
) {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: numero,
          text: texto
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao enviar mensagem: ${response.status} - ${errorText}`);
    }

    console.log('📱 Mensagem enviada:', numero);
    return await response.json();

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
    throw error;
  }
}

async function enviarPDFWhatsApp(
  instanceName: string,
  numero: string,
  pdfUrl: string,
  nomeArquivo: string
) {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: numero,
          mediatype: 'document',
          media: pdfUrl,
          fileName: nomeArquivo
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao enviar PDF: ${response.status} - ${errorText}`);
    }

    console.log('📄 PDF enviado:', nomeArquivo);
    return await response.json();

  } catch (error) {
    console.error('❌ Erro ao enviar PDF WhatsApp:', error);
    throw error;
  }
}

async function logAnalise(
  supabase: any,
  dados: {
    tipo: string;
    whatsapp_cliente?: string;
    confianca?: number;
    dados_extraidos?: any;
    erro?: string;
    tempo_processamento: number;
  }
) {
  try {
    await supabase
      .from('logs_analise_ia')
      .insert(dados);
  } catch (error) {
    console.error('⚠️ Erro ao salvar log:', error);
  }
}

async function notificarAdmin(mensagem: string) {
  try {
    // Enviar para WhatsApp admin (número configurável)
    const ADMIN_WHATSAPP = "5511999999999"; // Configurar número real
    
    await enviarMensagemWhatsApp(
      'default', // Instance name
      ADMIN_WHATSAPP,
      `🚨 *ALERTA ADMIN*\n\n${mensagem}\n\n${new Date().toLocaleString('pt-BR')}`
    );
  } catch (error) {
    console.error('⚠️ Erro ao notificar admin:', error);
  }
}
