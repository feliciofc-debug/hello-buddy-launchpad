import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { userId } = await req.json();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 GET-PRODUCTS-FOR-AI PREMIUM');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 User ID:', userId);
    
    // Buscar produtos do cliente
    const { data: products, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('nome');
    
    if (error) throw error;
    
    console.log('📦 Produtos encontrados:', products?.length || 0);
    
    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({
          catalogoMD: '',
          catalogoJSON: [],
          totalProdutos: 0,
          message: 'Nenhum produto cadastrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Formatar para a IA (Markdown estruturado) - COM LINKS SEMPRE
    const catalogoMD = products.map(p => {
      let md = `### 📦 ${p.nome}\n\n`;
      
      // Informações básicas
      md += `**Categoria:** ${p.categoria || 'Não informada'}\n`;
      md += `**Preço:** R$ ${Number(p.preco || 0).toFixed(2)}\n`;
      if (p.sku) md += `**SKU:** ${p.sku}\n`;
      
      // Estoque
      const estoque = p.estoque || 0;
      if (estoque > 10) {
        md += `**Estoque:** ✅ Disponível\n`;
      } else if (estoque > 0) {
        md += `**Estoque:** ⚠️ Últimas ${estoque} unidades!\n`;
      } else {
        md += `**Estoque:** ❌ Esgotado\n`;
      }
      
      // 🔗 LINK (SEMPRE INCLUIR - REGRA #1)
      const link = p.checkout_url || p.link_marketplace || p.link;
      if (link) {
        md += `**🔗 LINK DE COMPRA:** ${link}\n`;
      } else {
        md += `**🔗 LINK:** Não cadastrado\n`;
      }
      
      md += `\n`;
      
      // Descrição
      if (p.descricao) {
        md += `**Descrição:**\n${p.descricao}\n\n`;
      }
      
      // Detalhes técnicos
      if (p.ficha_tecnica) {
        md += `**Ficha Técnica:**\n${p.ficha_tecnica}\n\n`;
      }
      
      if (p.informacao_nutricional) {
        md += `**Informação Nutricional:**\n${p.informacao_nutricional}\n\n`;
      }
      
      if (p.ingredientes) {
        md += `**Ingredientes:**\n${p.ingredientes}\n\n`;
      }
      
      if (p.modo_uso) {
        md += `**Modo de Uso:**\n${p.modo_uso}\n\n`;
      }
      
      if (p.beneficios) {
        md += `**Benefícios:**\n${p.beneficios}\n\n`;
      }
      
      if (p.especificacoes) {
        md += `**Especificações:**\n${p.especificacoes}\n\n`;
      }
      
      // Especificações físicas
      if (p.dimensoes || p.peso || p.cor || p.tamanhos) {
        md += `**Características Físicas:**\n`;
        if (p.dimensoes) md += `- Dimensões: ${p.dimensoes}\n`;
        if (p.peso) md += `- Peso: ${p.peso}\n`;
        if (p.cor) md += `- Cores disponíveis: ${p.cor}\n`;
        if (p.tamanhos) md += `- Tamanhos: ${p.tamanhos}\n`;
        md += `\n`;
      }
      
      if (p.garantia) {
        md += `**Garantia:** ${p.garantia}\n\n`;
      }
      
      if (p.brand) {
        md += `**Marca:** ${p.brand}\n\n`;
      }
      
      // Imagem
      if (p.imagem_url) {
        md += `**Imagem:** ${p.imagem_url}\n\n`;
      }
      
      md += `---\n\n`;
      
      return md;
    }).join('');
    
    // Também retornar versão JSON simples para buscas rápidas
    const catalogoJSON = products.map(p => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      preco: p.preco,
      estoque: p.estoque,
      link: p.checkout_url || p.link_marketplace || p.link,
      checkout_url: p.checkout_url,
      link_marketplace: p.link_marketplace,
      sku: p.sku,
      imagem_url: p.imagem_url,
      descricao: p.descricao?.substring(0, 200),
      ficha_tecnica: p.ficha_tecnica?.substring(0, 500),
      informacao_nutricional: p.informacao_nutricional?.substring(0, 500),
      ingredientes: p.ingredientes?.substring(0, 300),
      modo_uso: p.modo_uso?.substring(0, 300),
      beneficios: p.beneficios?.substring(0, 300),
      garantia: p.garantia,
      brand: p.brand,
      dimensoes: p.dimensoes,
      peso: p.peso,
      cor: p.cor,
      tamanhos: p.tamanhos
    }));
    
    console.log('✅ Catálogo gerado com sucesso');
    console.log('   Total produtos:', products.length);
    console.log('   MD length:', catalogoMD.length);
    
    return new Response(
      JSON.stringify({
        catalogoMD,
        catalogoJSON,
        totalProdutos: products.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err) {
    console.error('❌ Erro ao buscar produtos:', err);
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
