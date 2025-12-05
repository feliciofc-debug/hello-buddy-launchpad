import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mensagemCliente, conversationId, userId, forceEnvio } = await req.json();
    
    console.log("📥 Recebido:", { mensagemCliente, conversationId, userId, forceEnvio });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todos os produtos ativos do usuário
    const { data: produtos, error: produtosError } = await supabase
      .from("produtos")
      .select("*")
      .eq("user_id", userId)
      .eq("ativo", true);

    if (produtosError) {
      console.error("❌ Erro ao buscar produtos:", produtosError);
      throw new Error("Erro ao buscar produtos");
    }

    console.log(`📦 ${produtos?.length || 0} produtos encontrados`);

    if (!produtos || produtos.length === 0) {
      return new Response(
        JSON.stringify({
          mensagem: "Desculpe, não temos produtos cadastrados no momento. 😅",
          produto: null,
          enviar_foto: false,
          enviar_link: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FASE 1: Busca por palavras-chave (sem IA externa)
    const mensagemLower = mensagemCliente.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Função para normalizar texto para busca
    const normalizar = (texto: string) => 
      texto?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

    // Buscar produtos que correspondam à mensagem
    const produtosEncontrados = produtos.filter((p: any) => {
      const nome = normalizar(p.nome);
      const descricao = normalizar(p.descricao || "");
      const categoria = normalizar(p.categoria || "");
      const marca = normalizar(p.brand || "");
      const tags = (p.tags || []).map(normalizar).join(" ");
      
      // Verificar se alguma palavra da mensagem está no produto
      const palavrasMensagem = mensagemLower.split(/\s+/).filter((p: string) => p.length > 2);
      
      return palavrasMensagem.some((palavra: string) =>
        nome.includes(palavra) || 
        descricao.includes(palavra) || 
        categoria.includes(palavra) ||
        marca.includes(palavra) ||
        tags.includes(palavra)
      );
    });

    console.log(`🔍 ${produtosEncontrados.length} produtos correspondentes`);

    // Se forçar envio (menu vendedor), usar o produto pelo nome exato
    if (forceEnvio) {
      const produtoExato = produtos.find((p: any) => 
        normalizar(p.nome) === mensagemLower || p.nome === mensagemCliente
      );
      
      if (produtoExato) {
        const resposta = formatarProduto(produtoExato);
        return new Response(
          JSON.stringify({
            mensagem: resposta,
            produto: produtoExato,
            enviar_foto: true,
            enviar_link: true,
            imagem_url: produtoExato.imagem_url,
            checkout_url: produtoExato.link_marketplace || produtoExato.link,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Se encontrou exatamente 1 produto
    if (produtosEncontrados.length === 1) {
      const produto = produtosEncontrados[0];
      const resposta = formatarProduto(produto);
      
      return new Response(
        JSON.stringify({
          mensagem: resposta,
          produto: produto,
          enviar_foto: true,
          enviar_link: detectarIntencaoCompra(mensagemLower),
          imagem_url: produto.imagem_url,
          checkout_url: produto.link_marketplace || produto.link,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se encontrou múltiplos produtos
    if (produtosEncontrados.length > 1 && produtosEncontrados.length <= 5) {
      const lista = produtosEncontrados.map((p: any, i: number) => 
        `${i + 1}. ${p.nome} - R$ ${p.preco?.toFixed(2) || "Consulte"}`
      ).join("\n");
      
      return new Response(
        JSON.stringify({
          mensagem: `Encontrei ${produtosEncontrados.length} opções! 🎯\n\n${lista}\n\nQual você prefere? Digite o número! 😊`,
          produto: null,
          enviar_foto: false,
          enviar_link: false,
          produtos_encontrados: produtosEncontrados,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se encontrou muitos produtos ou nenhum
    if (produtosEncontrados.length > 5) {
      return new Response(
        JSON.stringify({
          mensagem: `Temos várias opções! 😊 Pode me dizer mais sobre o que você procura? Tipo marca, tamanho ou preço?`,
          produto: null,
          enviar_foto: false,
          enviar_link: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Nenhum produto encontrado - usar Lovable AI para resposta genérica
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (LOVABLE_API_KEY) {
      try {
        const catalogoProdutos = produtos.map((p: any) => 
          `- ${p.nome} (${p.categoria || "geral"}): R$ ${p.preco?.toFixed(2) || "?"}`
        ).join("\n");

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            max_tokens: 150,
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content: `Você é um vendedor simpático. Responda em 2-3 linhas máximo, use emojis com moderação.
                
PRODUTOS DISPONÍVEIS:
${catalogoProdutos}

REGRAS:
- Seja breve e humanizado
- Use "vc", "tá", "pra" naturalmente
- Se cliente perguntar algo que não temos, diga educadamente
- Sugira produtos similares se possível`
              },
              {
                role: "user",
                content: mensagemCliente
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const mensagemIA = aiData.choices?.[0]?.message?.content || "Como posso te ajudar? 😊";
          
          return new Response(
            JSON.stringify({
              mensagem: mensagemIA,
              produto: null,
              enviar_foto: false,
              enviar_link: false,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (aiError) {
        console.error("⚠️ Erro na IA:", aiError);
      }
    }

    // Fallback sem IA
    return new Response(
      JSON.stringify({
        mensagem: "Não encontrei esse produto específico. 🤔 Quer ver o que temos disponível?",
        produto: null,
        enviar_foto: false,
        enviar_link: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        mensagem: "Ops, tive um probleminha! Pode repetir? 😅",
        produto: null,
        enviar_foto: false,
        enviar_link: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Formatar produto para resposta
function formatarProduto(produto: any): string {
  const categoria = produto.categoria?.toLowerCase() || "geral";
  let resposta = "";

  // Nome e preço sempre
  resposta += `*${produto.nome}*\n`;
  if (produto.preco) {
    resposta += `💰 R$ ${produto.preco.toFixed(2)}\n`;
  }

  // Estoque (só menciona se baixo)
  if (produto.estoque !== null && produto.estoque !== undefined) {
    if (produto.estoque <= 10 && produto.estoque > 0) {
      resposta += `⚠️ Últimas ${produto.estoque} unidades!\n`;
    } else if (produto.estoque === 0) {
      resposta += `❌ Esgotado no momento\n`;
    }
  }

  // Descrição breve
  if (produto.descricao) {
    const descBreve = produto.descricao.length > 100 
      ? produto.descricao.substring(0, 100) + "..." 
      : produto.descricao;
    resposta += `\n${descBreve}\n`;
  }

  // Atributos por categoria
  const attrs = produto.attributes || {};
  
  if (categoria === "alimentos") {
    if (attrs.peso) resposta += `📦 ${attrs.peso}\n`;
    if (attrs.proteinas) resposta += `💪 ${attrs.proteinas}g proteína\n`;
    if (attrs.sem_gluten) resposta += `✅ Sem glúten\n`;
    if (attrs.vegano) resposta += `🌱 Vegano\n`;
  } else if (categoria === "veiculos" || categoria === "veículos") {
    if (attrs.ano) resposta += `📅 ${attrs.ano}\n`;
    if (attrs.km) resposta += `🛣️ ${attrs.km} km\n`;
    if (attrs.cor) resposta += `🎨 ${attrs.cor}\n`;
    if (attrs.combustivel) resposta += `⛽ ${attrs.combustivel}\n`;
  } else if (categoria === "imoveis" || categoria === "imóveis") {
    if (attrs.quartos) resposta += `🛏️ ${attrs.quartos} quartos\n`;
    if (attrs.area) resposta += `📐 ${attrs.area}m²\n`;
    if (attrs.vagas) resposta += `🚗 ${attrs.vagas} vagas\n`;
  } else if (categoria === "eletronicos" || categoria === "eletrônicos") {
    if (attrs.marca) resposta += `🏷️ ${attrs.marca}\n`;
    if (attrs.garantia) resposta += `🛡️ Garantia: ${attrs.garantia}\n`;
  }

  // Marca se existir
  if (produto.brand) {
    resposta += `🏷️ ${produto.brand}\n`;
  }

  resposta += "\nInteressou? 😊";
  
  return resposta.trim();
}

// Detectar intenção de compra
function detectarIntencaoCompra(mensagem: string): boolean {
  const palavrasCompra = [
    "quero", "comprar", "pagar", "pix", "link", "fechado", 
    "aceita", "vou levar", "manda", "enviar", "sim", "beleza", 
    "ok", "pode ser", "vou querer", "fecha", "pode enviar"
  ];
  
  return palavrasCompra.some(palavra => mensagem.includes(palavra));
}
