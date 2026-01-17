import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para extrair ASIN de link Amazon
function extractAsin(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Função para converter link Amazon para formato de afiliado
function convertAmazonLink(originalLink: string, affiliateTag: string): string {
  const asin = extractAsin(originalLink);
  if (asin && affiliateTag) {
    return `https://www.amazon.com.br/dp/${asin}?tag=${affiliateTag}`;
  }
  return originalLink;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { user_id, titulo, preco, imagem_url, link_afiliado, marketplace, descricao, categoria } = body;

    console.log('📦 Recebendo produto:', { user_id, titulo, marketplace, categoria });

    // 22 categorias Amazon válidas (nomes exatos)
    const CATEGORIAS_VALIDAS = [
      'Alimentos e Bebidas', 'Automotivo', 'Bebês', 'Beleza', 'Brinquedos e Jogos',
      'Casa', 'Construção', 'Cozinha', 'Cuidados Pessoais e Limpeza', 'Eletrodomésticos',
      'Eletrônicos e Celulares', 'Esportes e Aventura', 'Ferramentas e Construção',
      'Informática', 'Jardim e Piscina', 'Livros', 'eBooks', 'Moda', 'Móveis',
      'Papelaria e Escritório', 'Pet Shop', 'Video Games'
    ];

    // Validações básicas
    if (!user_id) {
      console.error('❌ user_id não fornecido');
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!titulo || !link_afiliado || !marketplace) {
      console.error('❌ Campos obrigatórios faltando:', { titulo, link_afiliado, marketplace });
      return new Response(
        JSON.stringify({ error: 'titulo, link_afiliado e marketplace são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar se user_id existe em clientes_afiliados e buscar amazon_affiliate_tag
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes_afiliados')
      .select('id, nome, amazon_affiliate_tag')
      .eq('user_id', user_id)
      .single();

    if (clienteError || !cliente) {
      console.error('❌ Cliente afiliado não encontrado:', clienteError);
      return new Response(
        JSON.stringify({ error: 'Usuário não é um cliente afiliado válido' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Cliente afiliado validado:', cliente.nome);

    // Processar link de afiliado
    let linkFinal = link_afiliado;
    
    // Se for Amazon e o cliente tiver tag configurado, converter automaticamente
    if (marketplace.toLowerCase().includes('amazon') && cliente.amazon_affiliate_tag) {
      const linkConvertido = convertAmazonLink(link_afiliado, cliente.amazon_affiliate_tag);
      if (linkConvertido !== link_afiliado) {
        console.log('🔗 Link Amazon convertido:', linkConvertido);
        linkFinal = linkConvertido;
      }
    }

    // Determinar categoria: usar a enviada se válida, senão default "Casa"
    let categoriaFinal = 'Casa'; // DEFAULT
    if (categoria && CATEGORIAS_VALIDAS.includes(categoria)) {
      categoriaFinal = categoria;
      console.log('📂 Categoria recebida da extensão:', categoriaFinal);
    } else if (categoria) {
      console.log('⚠️ Categoria inválida recebida:', categoria, '- usando default Casa');
    } else {
      console.log('📂 Categoria não enviada - usando default Casa');
    }

    // Inserir produto usando service role (bypassa RLS)
    const { data: produto, error: insertError } = await supabaseAdmin
      .from('afiliado_produtos')
      .insert({
        user_id,
        titulo: titulo.substring(0, 500),
        preco: preco ? parseFloat(preco) : null,
        imagem_url: imagem_url || null,
        link_afiliado: linkFinal,
        marketplace: marketplace.substring(0, 50),
        descricao: descricao ? descricao.substring(0, 2000) : null,
        categoria: categoriaFinal,
        status: 'ativo'
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao inserir produto:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar produto', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Produto inserido com sucesso:', produto.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Produto salvo com sucesso!',
        produto: {
          id: produto.id,
          titulo: produto.titulo,
          marketplace: produto.marketplace,
          linkConvertido: linkFinal !== link_afiliado
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
