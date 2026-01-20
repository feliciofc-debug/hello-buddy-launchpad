// ============================================
// EXECUTAR ENVIO PROGRAMADO - EDGE FUNCTION
// AMZ Ofertas - Envio Automático para Grupos
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONFIG = {
  DELAY_ENTRE_GRUPOS_MS: 2000,
  MAX_PROGRAMACOES_POR_EXECUCAO: 5,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Verifica se a URL é uma imagem válida
function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  
  // Deve conter extensão de imagem ou ser de CDN de imagens conhecida
  const imagePatterns = [
    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i,
    /images-na\.ssl-images-amazon\.com/i,
    /m\.media-amazon\.com\/images/i,
    /mlstatic\.com/i,
    /cloudinary\.com/i,
    /imgur\.com/i,
    /susercontent\.com/i,  // CDN da Shopee
    /down-br\.img\.susercontent\.com/i,  // CDN Shopee Brasil
    /cf\.shopee/i  // CDN alternativa Shopee
  ];
  
  return imagePatterns.some(pattern => pattern.test(url));
}

// Resolve imagem da Amazon a partir do link do produto
async function resolverImagemAmazon(produtoUrl: string): Promise<string | null> {
  try {
    if (!produtoUrl.includes('amazon.com.br')) return null;
    
    console.log("🔍 Resolvendo imagem da Amazon...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/resolve-amazon-image`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: produtoUrl })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.imageUrl && isValidImageUrl(data.imageUrl)) {
        console.log(`✅ Imagem resolvida: ${data.imageUrl.substring(0, 50)}...`);
        return data.imageUrl;
      }
    }
    
    return null;
  } catch (error) {
    console.error("❌ Erro ao resolver imagem:", error);
    return null;
  }
}

// Obtém a melhor URL de imagem disponível
async function obterImagemProduto(produto: any): Promise<string | null> {
  const imagemUrl = produto.imagem_url;
  
  if (!imagemUrl) {
    console.log("⚠️ Produto sem imagem cadastrada");
    return null;
  }
  
  // Se já é uma URL de imagem válida, usar diretamente
  if (isValidImageUrl(imagemUrl)) {
    console.log(`📷 Usando imagem direta: ${imagemUrl.substring(0, 60)}...`);
    return imagemUrl;
  }
  
  // Se é um link de produto Amazon, tentar extrair a imagem
  if (imagemUrl.includes('amazon.com.br')) {
    const imagemResolvida = await resolverImagemAmazon(imagemUrl);
    if (imagemResolvida) {
      return imagemResolvida;
    }
  }
  
  // Fallback: tentar usar o link_afiliado para resolver imagem
  if (produto.link_afiliado && produto.link_afiliado.includes('amazon.com.br')) {
    console.log("🔄 Tentando resolver imagem via link afiliado...");
    const imagemDoLink = await resolverImagemAmazon(produto.link_afiliado);
    if (imagemDoLink) {
      return imagemDoLink;
    }
  }
  
  console.log("⚠️ Não foi possível obter imagem válida");
  return null;
}

// Gera mensagem criativa via IA - VERSÃO VENDEDORA
async function gerarMensagemIA(produto: any, config: any): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.log("⚠️ LOVABLE_API_KEY não configurada, usando mensagem padrão");
      return null;
    }

    console.log(`🤖 Gerando post criativo com IA para: ${produto.titulo}`);

    // Formatar preço corretamente
    let precoFormatado = "Confira o preço";
    if (produto.preco) {
      const preco = parseFloat(produto.preco);
      if (preco > 0 && preco < 100 && String(produto.preco).includes('.') && String(produto.preco).split('.')[1]?.length === 3) {
        precoFormatado = `R$ ${(preco * 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      } else {
        precoFormatado = `R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      }
    }

    const prompt = `Você é um copywriter especialista em vendas por WhatsApp. Crie uma mensagem VENDEDORA e IRRESISTÍVEL para este produto:

PRODUTO:
- Nome: ${produto.titulo}
- Preço: ${precoFormatado}
- Categoria: ${produto.categoria || 'Geral'}

FORMATO DO POST (SIGA EXATAMENTE):

[GANCHO EMOCIONAL - 1 linha impactante que desperta desejo]

[BENEFÍCIO PRINCIPAL - o que resolve na vida da pessoa]

${precoFormatado}

👇 Compre aqui:
${produto.link_afiliado || ''}

REGRAS OBRIGATÓRIAS:
1. Comece com gancho emocional (pergunta, curiosidade ou dor)
2. Use NO MÁXIMO 2 emojis (moderação!)
3. Texto LEVE com quebras de linha
4. Linguagem NATURAL como se fosse um amigo indicando
5. Destaque o BENEFÍCIO, não só características
6. Crie URGÊNCIA ou ESCASSEZ quando fizer sentido
7. SEMPRE inclua o preço e o link exatos fornecidos
8. Varie o estilo: às vezes pergunta, às vezes afirmação, às vezes história
9. NUNCA use as palavras "cansado", "cansada" ou "cansou" - são repetitivas e feias!

EXEMPLOS DE BONS GANCHOS:
- "Sabe aquele problema de [dor]? Achei a solução!"
- "Você ainda está [problema]? Olha isso..."
- "Quem aí também [desejo comum]?"
- "Preço de [comparação barata] por esse [produto]!"
- "Esse aqui sumiu do estoque 3x esse mês..."
- "Quem mais quer [benefício]?"
- "Achei esse [produto] e precisei compartilhar!"

Retorne APENAS a mensagem pronta, sem explicações.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Você é um copywriter de alto nível especializado em vendas por WhatsApp. Cria mensagens que parecem recomendações de amigos, não propagandas. Usa poucos emojis (máx 2), linguagem leve e natural, e sempre destaca benefícios emocionais. Suas mensagens vendem muito porque parecem autênticas."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 400
      }),
    });

    if (!response.ok) {
      console.error("❌ Erro na IA:", response.status);
      return null;
    }

    const data = await response.json();
    let mensagem = data.choices?.[0]?.message?.content?.trim();

    if (!mensagem) {
      console.log("⚠️ IA retornou vazio");
      return null;
    }

    // Limpar possíveis marcações
    mensagem = mensagem.replace(/```[\s\S]*?```/g, "").trim();

    // 🚫 FILTRO OBRIGATÓRIO: Remover palavras proibidas (cansado/cansada/cansou)
    mensagem = mensagem
      .replace(/\bcansad[oa]s?\b/gi, 'ocupada')
      .replace(/\bcansou\b/gi, 'parou')
      .replace(/\bcansando\b/gi, 'sobrecarregando')
      .replace(/\bcansam\b/gi, 'ocupam')
      .replace(/\bcansar\b/gi, 'sobrecarregar');
    
    console.log(`🚫 Filtro anti-cansado aplicado`);

    // Garantir que o link está incluído
    if (produto.link_afiliado && !mensagem.includes(produto.link_afiliado)) {
      mensagem += `\n\n👇 Compre aqui:\n${produto.link_afiliado}`;
    }

    console.log(`✅ Mensagem IA gerada: ${mensagem.substring(0, 80)}...`);
    return mensagem;

  } catch (error) {
    console.error("❌ Erro ao gerar mensagem IA:", error);
    return null;
  }
}

function formatarMensagemProduto(produto: any, config: any): string {
  let msg = "";
  
  if (config.prefixo_mensagem) {
    msg += config.prefixo_mensagem + "\n\n";
  }
  
  msg += `*${produto.titulo}*\n\n`;
  
  if (config.incluir_preco && produto.preco) {
    msg += `💰 *R$ ${produto.preco.toFixed(2)}*\n\n`;
  }
  
  if (config.incluir_link && produto.link_afiliado) {
    msg += `🛒 ${produto.link_afiliado}\n\n`;
  }
  
  if (config.sufixo_mensagem) {
    msg += config.sufixo_mensagem;
  }
  
  return msg.trim();
}

async function enviarParaGrupo(
  wuzapiUrl: string,
  token: string,
  groupJid: string,
  message: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let jid = groupJid;
    if (!jid.includes("@")) {
      jid = jid + "@g.us";
    }

    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl;
    console.log(`📤 Enviando para grupo: ${jid}`);
    console.log(`📡 URL: ${baseUrl}`);

    // ============================================
    // 🆕 SOLUÇÃO CLAUDE OPUS: Baixar imagem e enviar como base64
    // Isso contorna o bloqueio do CDN da Shopee a IPs de datacenter
    // ============================================
    
    if (imageUrl) {
      const caption = message.length > 900 ? message.slice(0, 900) + "…" : message;
      
      // 🆕 ESTRATÉGIA 1: Baixar imagem e converter para base64
      console.log(`⬇️ Baixando imagem: ${imageUrl.substring(0, 60)}...`);
      let base64Image: string | null = null;
      
      try {
        const imgResponse = await fetch(imageUrl, {
          headers: {
            // Simular navegador para evitar bloqueio do CDN
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": "https://shopee.com.br/",
          },
        });

        if (imgResponse.ok) {
          const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
          const arrayBuffer = await imgResponse.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Converter para base64 (método compatível com Deno)
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);
          
          base64Image = `data:${contentType};base64,${base64}`;
          console.log(`✅ Imagem baixada: ${Math.round(arrayBuffer.byteLength / 1024)}KB`);
        } else {
          console.warn(`⚠️ Falha ao baixar imagem: ${imgResponse.status}`);
        }
      } catch (dlError) {
        console.warn(`⚠️ Erro ao baixar imagem:`, dlError);
      }

      // 🆕 Se conseguiu baixar, envia como base64
      if (base64Image) {
        try {
          console.log(`🖼️ Enviando imagem como BASE64...`);
          
          const imageResponse = await fetch(`${baseUrl}/chat/send/image`, {
            method: "POST",
            headers: {
              "Token": token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: jid,
              Image: base64Image,
              Caption: caption,
            }),
          });

          const resultText = await imageResponse.text();
          console.log(`📡 Resultado base64: ${imageResponse.ok ? '✅ SUCESSO' : '❌ FALHA'}`);
          
          if (imageResponse.ok) {
            try {
              const result = JSON.parse(resultText);
              if (result.success !== false && !result.error) {
                console.log(`✅ Enviado IMAGEM (base64) + LEGENDA para grupo: ${jid}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                return { success: true };
              }
            } catch {
              console.log(`✅ Enviado IMAGEM (base64) + LEGENDA para grupo: ${jid}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              return { success: true };
            }
          }
          console.warn("⚠️ Base64 falhou, tentando URL direta...", resultText.substring(0, 100));
        } catch (b64Error) {
          console.warn("⚠️ Erro no envio base64:", b64Error);
        }
      }

      // 🆕 ESTRATÉGIA 2: Fallback para URL direta
      console.log(`🔄 Tentando URL direta como fallback...`);
      try {
        const imageResponse = await fetch(`${baseUrl}/chat/send/image`, {
          method: "POST",
          headers: {
            "Token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            Phone: jid,
            Image: imageUrl,
            Caption: caption,
          }),
        });

        const resultText = await imageResponse.text();
        console.log(`📡 Resultado URL: ${imageResponse.ok ? '✅ SUCESSO' : '❌ FALHA'}`);
        
        if (imageResponse.ok) {
          try {
            const result = JSON.parse(resultText);
            if (result.success !== false && !result.error) {
              console.log(`✅ Enviado IMAGEM (URL) + LEGENDA para grupo: ${jid}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              return { success: true };
            }
          } catch {
            console.log(`✅ Enviado IMAGEM (URL) + LEGENDA para grupo: ${jid}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return { success: true };
          }
        }
        console.warn("⚠️ URL direta falhou, enviando só texto...", resultText.substring(0, 100));
      } catch (urlError) {
        console.warn("⚠️ Erro no envio URL:", urlError);
      }
    }

    // FALLBACK FINAL: Enviar só texto
    console.log(`📝 Enviando somente texto...`);
    const textResponse = await fetch(`${baseUrl}/chat/send/text`, {
      method: "POST",
      headers: {
        "Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Phone: jid,
        Body: message,
      }),
    });

    const textResult = await textResponse.text();
    console.log(`📡 Resultado texto: ${textResponse.ok ? '✅ SUCESSO' : '❌ FALHA'}`);

    if (!textResponse.ok) {
      console.error("❌ Falha ao enviar texto:", textResult);
      return { success: false, error: textResult };
    }

    console.log(`✅ Enviado TEXTO para grupo: ${jid}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Erro ao enviar para grupo:`, error);
    return { success: false, error: error.message };
  }
}

async function processarProgramacao(
  supabase: any,
  programacao: any
): Promise<{ success: boolean; error?: string; enviados?: number; tiktok?: boolean }> {
  console.log(`\n📋 ════════════════════════════════════════`);
  console.log(`📋 Processando: ${programacao.nome}`);
  console.log(`📋 Categorias: ${programacao.categorias?.join(", ") || "Todas"}`);
  console.log(`📋 ════════════════════════════════════════`);

  try {
    // 1. VERIFICAR HORÁRIO (sempre em horário de Brasília)
    const agora = new Date();
    const horaBrasilia = agora.toLocaleTimeString("pt-BR", { 
      timeZone: "America/Sao_Paulo", 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false 
    });
    const horaAtual = horaBrasilia;
    
    // Comparar horário em formato HH:MM
    const horarioInicio = programacao.horario_inicio.slice(0, 5);
    const horarioFim = programacao.horario_fim.slice(0, 5);
    
    if (horaAtual < horarioInicio || horaAtual > horarioFim) {
      console.log(`⏰ Fora do horário (${horaAtual} BRT). Permitido: ${horarioInicio} - ${horarioFim}`);
      
      const { data: proximoEnvio } = await supabase.rpc("calcular_proximo_envio", { 
        p_programacao_id: programacao.id 
      });
      
      await supabase
        .from("programacao_envio_afiliado")
        .update({ proximo_envio: proximoEnvio })
        .eq("id", programacao.id);
      
      return { success: true, enviados: 0 };
    }

    // 2. VERIFICAR DIA (sempre em horário de Brasília)
    const diaBrasiliaStr = agora.toLocaleDateString("pt-BR", { 
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      day: "numeric"
    });
    // Mapear dia da semana em português para número
    const diasMap: Record<string, number> = { "dom": 0, "seg": 1, "ter": 2, "qua": 3, "qui": 4, "sex": 5, "sáb": 6 };
    const diaAbrev = diaBrasiliaStr.slice(0, 3).toLowerCase();
    const diaSemana = diasMap[diaAbrev] ?? agora.getDay();
    const diaMes = parseInt(agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric" }));

    if (programacao.dias_mes && programacao.dias_mes.length > 0) {
      if (!programacao.dias_mes.includes(diaMes)) {
        console.log(`📅 Dia ${diaMes} não está na lista: ${programacao.dias_mes.join(", ")}`);
        
        const { data: proximoEnvio } = await supabase.rpc("calcular_proximo_envio", { 
          p_programacao_id: programacao.id 
        });
        
        await supabase
          .from("programacao_envio_afiliado")
          .update({ proximo_envio: proximoEnvio })
          .eq("id", programacao.id);
        
        return { success: true, enviados: 0 };
      }
    } else if (programacao.dias_semana && programacao.dias_semana.length > 0) {
      if (!programacao.dias_semana.includes(diaSemana)) {
        console.log(`📅 ${['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][diaSemana]} não está permitido`);
        
        const { data: proximoEnvio } = await supabase.rpc("calcular_proximo_envio", { 
          p_programacao_id: programacao.id 
        });
        
        await supabase
          .from("programacao_envio_afiliado")
          .update({ proximo_envio: proximoEnvio })
          .eq("id", programacao.id);
        
        return { success: true, enviados: 0 };
      }
    }

    // 3. BUSCAR PRÓXIMO PRODUTO (com deduplicação robusta baseada em histórico)
    const marketplaces = programacao.marketplaces_ativos || ['Amazon', 'Shopee', 'Magazine Luiza', 'Mercado Livre'];
    let ultimoMkt = programacao.ultimo_marketplace_enviado;
    let contadorMkt = programacao.produtos_no_marketplace_atual || 0;
    
    // 🆕 BUSCAR PRODUTOS JÁ ENVIADOS NAS ÚLTIMAS 24H (evita repetição)
    const { data: historicoRecente } = await supabase
      .from("historico_envio_programado")
      .select("produto_titulo")
      .eq("user_id", programacao.user_id)
      .gte("enviado_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("enviado_at", { ascending: false })
      .limit(100);
    
    const titulosEnviados = new Set<string>(
      (historicoRecente || []).map((h: { produto_titulo?: string }) => h.produto_titulo?.toLowerCase().trim() || '').filter((t: string) => t.length > 0)
    );
    console.log(`🔍 Produtos enviados nas últimas 24h: ${titulosEnviados.size}`);
    
    // 🎯 PRIORIZAÇÃO SHOPEE: Maquiagem, Material Escolar, Praia/Piscina, Saúde e Beleza
    // Keywords para identificar produtos prioritários (EXCLUI bebidas e comidas)
    const KEYWORDS_PRIORITARIAS = [
      // Maquiagem
      'maquiagem', 'make', 'batom', 'sombra', 'base', 'blush', 'rímel', 'delineador', 'corretivo', 'pó', 'gloss', 'paleta', 'máscara cílios', 'primer', 'contorno',
      // Material Escolar
      'material escolar', 'caderno', 'caneta', 'lápis', 'borracha', 'mochila escolar', 'estojo', 'fichário', 'agenda', 'régua', 'apontador', 'cola', 'tesoura escolar', 'marca texto', 'lapiseira',
      // Praia e Piscina
      'praia', 'piscina', 'biquíni', 'maiô', 'sunga', 'saída de praia', 'bolsa praia', 'toalha praia', 'protetor solar', 'bronzeador', 'óculos sol', 'chinelo', 'boia', 'guarda-sol', 'canga',
      // Saúde e Beleza
      'saúde', 'beleza', 'skincare', 'hidratante', 'shampoo', 'condicionador', 'creme', 'sérum', 'máscara facial', 'esfoliante', 'perfume', 'desodorante', 'escova cabelo', 'secador', 'chapinha', 'unha', 'esmalte'
    ];
    
    // 🚫 CATEGORIAS BLOQUEADAS para Shopee (bebidas e comidas)
    const CATEGORIAS_BLOQUEADAS_SHOPEE = [
      'alimento', 'comida', 'bebida', 'cerveja', 'vinho', 'refrigerante', 'suco', 'água', 'café', 'chá', 
      'biscoito', 'chocolate', 'doce', 'salgado', 'snack', 'lanche', 'refeição', 'comestível', 'alimentício',
      'energético', 'leite', 'iogurte', 'queijo', 'carne', 'fruta', 'verdura', 'legume'
    ];
    
    // Função para verificar se produto é bloqueado (bebidas/comidas)
    const isProdutoBloqueadoShopee = (p: { titulo?: string; descricao?: string; categoria?: string }): boolean => {
      const texto = `${p.titulo || ''} ${p.descricao || ''} ${p.categoria || ''}`.toLowerCase();
      return CATEGORIAS_BLOQUEADAS_SHOPEE.some(kw => texto.includes(kw));
    };
    
    // Função para verificar se produto é prioritário
    const isProdutoPrioritario = (p: { titulo?: string; descricao?: string; categoria?: string }): boolean => {
      const texto = `${p.titulo || ''} ${p.descricao || ''} ${p.categoria || ''}`.toLowerCase();
      return KEYWORDS_PRIORITARIAS.some(kw => texto.includes(kw));
    };
    
    // 🆕 ROTAÇÃO COM PRIORIZAÇÃO 2:1:1:1 para Shopee + foco em categorias femininas
    let mkAtual: string;
    
    // Verificar se Shopee está nos marketplaces ativos
    const shopeeAtiva = marketplaces.some((m: string) => m.toLowerCase().includes('shopee'));
    
    if (!ultimoMkt) {
      // Primeira execução: começar com Shopee se disponível
      mkAtual = shopeeAtiva ? 'Shopee' : marketplaces[0];
      contadorMkt = 0;
    } else if (shopeeAtiva) {
      // Rotação 2:1:1:1 - Shopee aparece 2x antes de trocar
      const ultimoEraShopee = ultimoMkt.toLowerCase().includes('shopee');
      
      if (!ultimoEraShopee) {
        // Último não foi Shopee, então agora é Shopee
        mkAtual = 'Shopee';
        contadorMkt = 0;
      } else if (contadorMkt < 1) {
        // Shopee ainda tem mais 1 envio
        mkAtual = 'Shopee';
        contadorMkt = contadorMkt + 1;
      } else {
        // Shopee já enviou 2x, trocar para outro marketplace
        const outrosMarketplaces = marketplaces.filter((m: string) => !m.toLowerCase().includes('shopee'));
        if (outrosMarketplaces.length > 0) {
          const idxAtual = outrosMarketplaces.indexOf(ultimoMkt);
          const proximoIdx = idxAtual >= 0 ? (idxAtual + 1) % outrosMarketplaces.length : 0;
          mkAtual = outrosMarketplaces[proximoIdx];
        } else {
          mkAtual = 'Shopee';
        }
        contadorMkt = 0;
      }
    } else {
      // Sem Shopee, rotação normal 1:1:1
      const idxAtual = marketplaces.indexOf(ultimoMkt);
      const proximoIdx = (idxAtual + 1) % marketplaces.length;
      mkAtual = marketplaces[proximoIdx];
      contadorMkt = 0;
    }
    
    console.log(`🏪 Rotação 2:1:1:1 (Shopee heavy + feminino): ${ultimoMkt || 'início'} → ${mkAtual}`);
    
    // 🆕 FILTRAR POR CATEGORIAS DA PROGRAMAÇÃO
    const categoriasPermitidas = programacao.categorias && programacao.categorias.length > 0 
      ? programacao.categorias 
      : null;
    
    if (categoriasPermitidas) {
      console.log(`🏷️ Filtrando por categorias: ${categoriasPermitidas.join(', ')}`);
    } else {
      console.log(`🏷️ Sem filtro de categoria (enviando de todas)`);
    }
    
    // Buscar mais produtos para ter opções de priorização
    const queryLimit = mkAtual.toLowerCase().includes('shopee') ? 200 : 80;
    const randomOffset = mkAtual.toLowerCase().includes('shopee') ? Math.floor(Math.random() * 300) : 0;
    
    // Construir query base
    let query = supabase
      .from("afiliado_produtos")
      .select("*")
      .eq("user_id", programacao.user_id)
      .ilike("marketplace", `%${mkAtual}%`);
    
    // 🆕 Aplicar filtro de categorias SE definidas
    if (categoriasPermitidas && categoriasPermitidas.length > 0) {
      query = query.in("categoria", categoriasPermitidas);
    }
    
    let { data: produtosDisponiveis, error: produtoError } = await query.range(randomOffset, randomOffset + queryLimit - 1);
    
    // Filtrar produtos que NÃO foram enviados nas últimas 24h
    let produtoData: any[] = [];
    if (produtosDisponiveis && produtosDisponiveis.length > 0) {
      console.log(`📦 ${produtosDisponiveis.length} produtos encontrados em ${mkAtual} com categorias filtradas`);
      
      // 🚫 Se for Shopee, filtrar bebidas e comidas
      const isShopee = mkAtual.toLowerCase().includes('shopee');
      let disponiveis = produtosDisponiveis.filter(
        (p: { titulo?: string }) => !titulosEnviados.has(p.titulo?.toLowerCase().trim() || '')
      );
      
      // Aplicar filtro de bloqueio apenas para Shopee
      if (isShopee) {
        const antes = disponiveis.length;
        disponiveis = disponiveis.filter((p: any) => !isProdutoBloqueadoShopee(p));
        console.log(`🚫 Shopee: ${antes - disponiveis.length} produtos de bebidas/comidas bloqueados`);
      }
      
      if (disponiveis.length > 0) {
        // 🎯 PRIORIZAR produtos das categorias permitidas
        const prioritarios = disponiveis.filter(isProdutoPrioritario);
        
        if (prioritarios.length > 0) {
          // 80% de chance de escolher um produto prioritário
          const usarPrioritario = Math.random() < 0.8;
          const listaFinal = usarPrioritario ? prioritarios : disponiveis;
          const randomIndex = Math.floor(Math.random() * listaFinal.length);
          produtoData = [listaFinal[randomIndex]];
          console.log(`🎯 ${prioritarios.length} produtos prioritários (maquiagem/escolar/praia/beleza), ${usarPrioritario ? 'SELECIONADO' : 'ignorado'}`);
        } else {
          // Sem prioritários, escolher qualquer um
          const randomIndex = Math.floor(Math.random() * disponiveis.length);
          produtoData = [disponiveis[randomIndex]];
        }
        console.log(`✅ ${disponiveis.length} produtos disponíveis em ${mkAtual}`);
      } else {
        console.log(`⚠️ Todos os ${produtosDisponiveis.length} produtos de ${mkAtual} já foram enviados ou bloqueados`);
      }
    }
    
    // Se não encontrou, tentar outros marketplaces (com priorização E RESPEITANDO CATEGORIAS)
    if (produtoData.length === 0) {
      console.log(`⚠️ Sem produtos novos em ${mkAtual}, tentando outros marketplaces...`);
      for (const mkt of marketplaces) {
        if (mkt !== mkAtual) {
          // 🆕 Construir query respeitando categorias
          let altQuery = supabase
            .from("afiliado_produtos")
            .select("*")
            .eq("user_id", programacao.user_id)
            .ilike("marketplace", `%${mkt}%`);
          
          // Aplicar filtro de categorias SE definidas
          if (categoriasPermitidas && categoriasPermitidas.length > 0) {
            altQuery = altQuery.in("categoria", categoriasPermitidas);
          }
          
          const { data: altData } = await altQuery.limit(100);
          
          if (altData && altData.length > 0) {
            let disponiveis = altData.filter(
              (p: { titulo?: string }) => !titulosEnviados.has(p.titulo?.toLowerCase().trim() || '')
            );
            
            // Aplicar filtro de bloqueio para Shopee
            const isShopeeAlt = mkt.toLowerCase().includes('shopee');
            if (isShopeeAlt) {
              disponiveis = disponiveis.filter((p: any) => !isProdutoBloqueadoShopee(p));
            }
            
            if (disponiveis.length > 0) {
              // Priorizar também nos fallbacks
              const prioritarios = disponiveis.filter(isProdutoPrioritario);
              const usarPrioritario = prioritarios.length > 0 && Math.random() < 0.8;
              const listaFinal = usarPrioritario ? prioritarios : disponiveis;
              const randomIndex = Math.floor(Math.random() * listaFinal.length);
              produtoData = [listaFinal[randomIndex]];
              mkAtual = mkt;
              contadorMkt = 0;
              console.log(`✅ Encontrado ${disponiveis.length} produtos novos em ${mkt} (categorias: ${categoriasPermitidas?.join(', ') || 'todas'})`);
              break;
            }
          }
        }
      }
    }
    
    // Último fallback: qualquer produto das categorias permitidas (resetar ciclo de 24h)
    if (produtoData.length === 0) {
      console.log("🔄 Ciclo completo! Reiniciando seleção (ignorando histórico 24h)...");
      
      // 🆕 Construir query respeitando categorias mesmo no fallback
      let fallbackQuery = supabase
        .from("afiliado_produtos")
        .select("*")
        .eq("user_id", programacao.user_id);
      
      // Aplicar filtro de categorias SE definidas
      if (categoriasPermitidas && categoriasPermitidas.length > 0) {
        fallbackQuery = fallbackQuery.in("categoria", categoriasPermitidas);
      }
      
      const { data: anyData } = await fallbackQuery.limit(100);
      
      if (anyData && anyData.length > 0) {
        // Mesmo no fallback, priorizar categorias prioritárias
        const prioritarios = anyData.filter(isProdutoPrioritario);
        const usarPrioritario = prioritarios.length > 0 && Math.random() < 0.8;
        const listaFinal = usarPrioritario ? prioritarios : anyData;
        const randomIndex = Math.floor(Math.random() * listaFinal.length);
        produtoData = [listaFinal[randomIndex]];
        console.log(`🔄 Fallback: ${anyData.length} produtos disponíveis nas categorias permitidas`);
      } else if (categoriasPermitidas) {
        // Se não encontrou nada nas categorias, avisar
        console.log(`⚠️ Nenhum produto encontrado nas categorias: ${categoriasPermitidas.join(', ')}`);
      }
    }

    if (produtoError || !produtoData || produtoData.length === 0) {
      console.log("⚠️ Nenhum produto disponível para enviar");
      
      const proximoEnvio = new Date(Date.now() + programacao.intervalo_minutos * 60000);
      await supabase
        .from("programacao_envio_afiliado")
        .update({ proximo_envio: proximoEnvio.toISOString() })
        .eq("id", programacao.id);
      
      return { success: true, enviados: 0 };
    }
    
    // Atualizar controle de rotação
    await supabase
      .from("programacao_envio_afiliado")
      .update({
        ultimo_produto_id: produtoData[0].id,
        ultimo_marketplace_enviado: mkAtual,
        produtos_no_marketplace_atual: contadorMkt + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", programacao.id);

    const produto = produtoData[0];
    console.log(`📦 Produto: ${produto.titulo}`);
    console.log(`💰 Preço: R$ ${produto.preco?.toFixed(2) || "N/A"}`);

    // 4. BUSCAR CREDENCIAIS WUZAPI DO AFILIADO
    // ✅ PRIORIDADE: clientes_afiliados (sistema de afiliados usa Contabo)
    let clienteData: { wuzapi_token: string; wuzapi_url: string } | null = null;
    
    // PRIMEIRO: Buscar token do afiliado na tabela correta
    const { data: afiliadoData } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token, wuzapi_jid")
      .eq("user_id", programacao.user_id)
      .single();

    if (afiliadoData?.wuzapi_token) {
      // ✅ Afiliados SEMPRE usam a URL da Contabo
      const contaboUrl = "https://api2.amzofertas.com.br";
      clienteData = {
        wuzapi_url: contaboUrl,
        wuzapi_token: afiliadoData.wuzapi_token
      };
      console.log('📡 [AFILIADO] Token encontrado! URL:', contaboUrl);
      console.log('📡 [AFILIADO] JID:', afiliadoData.wuzapi_jid || 'N/A');
    }
    
    // FALLBACK: Se não encontrou em clientes_afiliados, tentar wuzapi_instances (sistema PJ)
    if (!clienteData) {
      console.log('⚠️ Token não encontrado em clientes_afiliados, tentando wuzapi_instances...');
      
      const { data: userInstance } = await supabase
        .from('wuzapi_instances')
        .select('wuzapi_url, wuzapi_token, instance_name, is_connected')
        .eq('assigned_to_user', programacao.user_id)
        .eq('is_connected', true)
        .limit(1)
        .maybeSingle();
      
      if (userInstance?.wuzapi_token) {
        clienteData = {
          wuzapi_url: userInstance.wuzapi_url,
          wuzapi_token: userInstance.wuzapi_token
        };
        console.log('📡 [PJ] Usando instância:', userInstance.instance_name, userInstance.wuzapi_url);
      }
    }

    // ÚLTIMO FALLBACK: variáveis de ambiente
    if (!clienteData) {
      const envUrl = Deno.env.get('CONTABO_WUZAPI_URL') || "https://api2.amzofertas.com.br";
      const envToken = Deno.env.get('WUZAPI_TOKEN');
      
      if (envToken) {
        clienteData = {
          wuzapi_url: envUrl,
          wuzapi_token: envToken
        };
        console.log('📡 [ENV] Usando credenciais de ambiente:', envUrl);
      }
    }

    if (!clienteData) {
      throw new Error("Nenhuma instância WuzAPI disponível. Conecte seu WhatsApp primeiro!");
    }
    
    console.log('🔗 URL final para envio:', clienteData.wuzapi_url);

    // 5. BUSCAR GRUPOS
    let grupos: any[] = [];
    
    if (programacao.enviar_para_todos_grupos) {
      const { data: gruposData } = await supabase
        .from("whatsapp_grupos_afiliado")
        .select("id, group_jid, group_name")
        .eq("user_id", programacao.user_id)
        .eq("ativo", true);
      
      grupos = gruposData || [];
    } else if (programacao.grupos_ids?.length > 0) {
      const { data: gruposData } = await supabase
        .from("whatsapp_grupos_afiliado")
        .select("id, group_jid, group_name")
        .in("id", programacao.grupos_ids)
        .eq("ativo", true);
      
      grupos = gruposData || [];
    }

    if (grupos.length === 0) {
      console.log("⚠️ Nenhum grupo configurado");
      
      const proximoEnvio = new Date(Date.now() + programacao.intervalo_minutos * 60000);
      await supabase
        .from("programacao_envio_afiliado")
        .update({ proximo_envio: proximoEnvio.toISOString() })
        .eq("id", programacao.id);
      
      return { success: true, enviados: 0 };
    }

    console.log(`📱 Grupos para enviar: ${grupos.length}`);

    // 6. GERAR MENSAGEM CRIATIVA COM IA (ou fallback para template)
    let mensagem: string;

    // Verificar se IA criativa está ativada (default: true)
    const usarIACriativa = programacao.usar_ia_criativa !== false;

    if (usarIACriativa) {
      // Tentar gerar via IA (posts únicos e criativos)
      const mensagemIA = await gerarMensagemIA(produto, programacao);

      if (mensagemIA) {
        mensagem = mensagemIA;
        console.log("🤖 Usando mensagem gerada pela IA");
      } else {
        // Fallback se IA falhar
        mensagem = formatarMensagemProduto(produto, programacao);
        console.log("📝 IA indisponível, usando template padrão");
      }
    } else {
      // IA desativada, usar template padrão
      mensagem = formatarMensagemProduto(produto, programacao);
      console.log("📝 IA desativada, usando template padrão");
    }

    // ✅ Garantir que o link SEMPRE vai no texto enviado ao grupo (independente de config/IA)
    if (produto.link_afiliado && !mensagem.includes(produto.link_afiliado)) {
      mensagem = `${mensagem}\n\n🛒 ${produto.link_afiliado}`.trim();
    }

    // Obter imagem válida (resolve automaticamente links da Amazon)
    let imagemUrl: string | undefined = undefined;
    if (programacao.incluir_imagem) {
      const img = await obterImagemProduto(produto);
      if (img) imagemUrl = img;
    }

    // 7. ENVIAR PARA CADA GRUPO (com deduplicação)
    let gruposEnviados = 0;
    const gruposIdsEnviados: string[] = [];

    for (const grupo of grupos) {
      // ✅ DEDUPLICAÇÃO: verificar se já enviamos para este grupo nos últimos 2 minutos
      const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
      const { data: recentEnvio } = await supabase
        .from("historico_envios")
        .select("timestamp")
        .eq("whatsapp", grupo.group_jid)
        .eq("tipo", "grupo")
        .gte("timestamp", twoMinutesAgo)
        .limit(1);
      
      if (recentEnvio && recentEnvio.length > 0) {
        console.log(`⏭️ Grupo ${grupo.group_name} já recebeu mensagem nos últimos 2min, pulando...`);
        continue;
      }
      
      // ✅ REGISTRAR ANTES de enviar (evita race condition)
      await supabase.from("historico_envios").insert({
        whatsapp: grupo.group_jid,
        tipo: "grupo",
        mensagem: mensagem.substring(0, 200),
        sucesso: true,
        timestamp: new Date().toISOString()
      });
      
      const resultado = await enviarParaGrupo(
        clienteData.wuzapi_url,
        clienteData.wuzapi_token,
        grupo.group_jid,
        mensagem,
        imagemUrl
      );

      if (resultado.success) {
        gruposEnviados++;
        gruposIdsEnviados.push(grupo.id);
      } else {
        // Se falhou, atualizar registro para sucesso=false
        await supabase
          .from("historico_envios")
          .update({ sucesso: false, erro: resultado.error })
          .eq("whatsapp", grupo.group_jid)
          .eq("tipo", "grupo")
          .order("timestamp", { ascending: false })
          .limit(1);
      }

      await sleep(CONFIG.DELAY_ENTRE_GRUPOS_MS);
    }

    console.log(`✅ Enviado para ${gruposEnviados}/${grupos.length} grupos`);

    // 8. REGISTRAR PRODUTO COMO ENVIADO
    await supabase
      .from("produtos_enviados_programacao")
      .upsert({
        programacao_id: programacao.id,
        produto_id: produto.produto_id,
        enviado_at: new Date().toISOString()
      }, { onConflict: "programacao_id,produto_id" });

    // 9. REGISTRAR NO HISTÓRICO
    await supabase
      .from("historico_envio_programado")
      .insert({
        programacao_id: programacao.id,
        user_id: programacao.user_id,
        produto_id: produto.produto_id,
        produto_titulo: produto.titulo,
        produto_preco: produto.preco,
        produto_categoria: produto.categoria,
        produto_link: produto.link_afiliado,
        produto_imagem: produto.imagem_url,
        grupos_enviados: gruposEnviados,
        grupos_ids: gruposIdsEnviados,
        sucesso: gruposEnviados > 0
      });

    // 10. ENVIAR PARA TIKTOK (se configurado)
    let tiktokEnviado = false;
    if (programacao.enviar_tiktok) {
      try {
        console.log("📱 Enviando para TikTok...");
        
        // Verificar se o produto tem imagem
        if (!imagemUrl) {
          console.log("⚠️ TikTok requer imagem, produto sem imagem disponível");
        } else {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          
          // Gerar título para TikTok (mais curto)
          const tiktokTitle = produto.titulo.substring(0, 100) + 
            (produto.preco ? ` - R$ ${produto.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '') +
            " 🔥 Link na bio!";
          
          const tiktokResponse = await fetch(`${supabaseUrl}/functions/v1/tiktok-post-content`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              user_id: programacao.user_id,
              content_type: "image",
              content_url: imagemUrl,
              title: tiktokTitle,
              post_mode: programacao.tiktok_post_mode || "draft"
            })
          });
          
          const tiktokResult = await tiktokResponse.json();
          
          if (tiktokResult.success) {
            tiktokEnviado = true;
            console.log(`✅ TikTok: ${tiktokResult.message}`);
          } else {
            console.log(`⚠️ TikTok erro: ${tiktokResult.error}`);
          }
        }
      } catch (tiktokError: any) {
        console.error("❌ Erro ao enviar para TikTok:", tiktokError);
      }
    }

    // 11. ATUALIZAR PROGRAMAÇÃO
    const proximoEnvio = new Date(Date.now() + programacao.intervalo_minutos * 60000);
    const hoje = new Date().toISOString().slice(0, 10);
    const resetDiario = programacao.ultimo_reset_diario !== hoje;
    
    await supabase
      .from("programacao_envio_afiliado")
      .update({
        proximo_envio: proximoEnvio.toISOString(),
        ultimo_envio: new Date().toISOString(),
        ultimo_produto_id: produto.produto_id,
        total_enviados: (programacao.total_enviados || 0) + 1,
        total_enviados_hoje: resetDiario ? 1 : (programacao.total_enviados_hoje || 0) + 1,
        ultimo_reset_diario: hoje
      })
      .eq("id", programacao.id);

    console.log(`📅 Próximo envio: ${proximoEnvio.toLocaleString("pt-BR")}`);
    if (tiktokEnviado) {
      console.log(`📱 TikTok também foi atualizado!`);
    }

    return { success: true, enviados: gruposEnviados, tiktok: tiktokEnviado };

  } catch (error: any) {
    console.error(`❌ Erro ao processar programação:`, error);
    
    const proximoEnvio = new Date(Date.now() + programacao.intervalo_minutos * 60000);
    await supabase
      .from("programacao_envio_afiliado")
      .update({ proximo_envio: proximoEnvio.toISOString() })
      .eq("id", programacao.id);
    
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("\n🚀 ════════════════════════════════════════");
    console.log("🚀 EXECUTANDO ENVIOS PROGRAMADOS");
    console.log(`🚀 ${new Date().toLocaleString("pt-BR")}`);
    console.log("🚀 ════════════════════════════════════════\n");

    const body = await req.json().catch(() => ({}));
    const userId = body.userId || null;
    const programacaoId = body.programacaoId || null;

    // BUSCAR PROGRAMAÇÕES PENDENTES
    let query = supabase
      .from("programacao_envio_afiliado")
      .select("*")
      .eq("ativo", true);
    
    // Se programacaoId específico, ignorar verificação de tempo (permite forçar execução)
    if (programacaoId) {
      query = query.eq("id", programacaoId);
    } else {
      // Só verificar tempo se for execução normal
      query = query.or("proximo_envio.is.null,proximo_envio.lte.now()");
    }
    
    query = query.order("proximo_envio", { ascending: true, nullsFirst: true })
      .limit(CONFIG.MAX_PROGRAMACOES_POR_EXECUCAO);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: programacoes, error: queryError } = await query;

    if (queryError) {
      throw queryError;
    }

    if (!programacoes || programacoes.length === 0) {
      console.log("📭 Nenhuma programação pendente");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma programação pendente",
          processed: 0,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 ${programacoes.length} programações para processar`);

    let totalProcessadas = 0;
    let totalEnviados = 0;
    let erros = 0;

    for (const prog of programacoes) {
      const resultado = await processarProgramacao(supabase, prog);
      
      totalProcessadas++;
      
      if (resultado.success) {
        totalEnviados += resultado.enviados || 0;
      } else {
        erros++;
      }

      await sleep(1000);
    }

    const duracao = Date.now() - startTime;

    console.log("\n🚀 ════════════════════════════════════════");
    console.log(`✅ Processamento concluído!`);
    console.log(`   📋 Programações: ${totalProcessadas}`);
    console.log(`   📤 Grupos enviados: ${totalEnviados}`);
    console.log(`   ❌ Erros: ${erros}`);
    console.log(`   ⏱️ Duração: ${duracao}ms`);
    console.log("🚀 ════════════════════════════════════════\n");

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: totalProcessadas,
        sent: totalEnviados,
        errors: erros,
        duration_ms: duracao
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("💥 Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
