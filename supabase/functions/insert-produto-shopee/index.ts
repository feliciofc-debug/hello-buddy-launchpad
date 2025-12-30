import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { user_id, titulo, preco, imagem_base64, link_afiliado, marketplace, descricao } = body;

    console.log('📦 Recebendo produto Shopee:', { user_id, titulo, marketplace });

    // Validações básicas
    if (!user_id) {
      console.error('❌ user_id não fornecido');
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!titulo || !link_afiliado) {
      console.error('❌ Campos obrigatórios faltando:', { titulo, link_afiliado });
      return new Response(
        JSON.stringify({ error: 'titulo e link_afiliado são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar se user_id existe em clientes_afiliados
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes_afiliados')
      .select('id, nome')
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

    let imagem_url: string | null = null;

    // Se tem imagem base64, fazer upload para o Storage
    if (imagem_base64) {
      try {
        console.log('📸 Processando imagem base64...');
        
        // Remover prefixo data:image/...;base64, se existir
        let base64Data = imagem_base64;
        let mimeType = 'image/jpeg';
        
        if (imagem_base64.includes(',')) {
          const parts = imagem_base64.split(',');
          base64Data = parts[1];
          
          // Extrair mime type
          const mimeMatch = parts[0].match(/data:([^;]+);/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
        }

        // Decodificar base64 para bytes
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Gerar filename único
        const extension = mimeType.split('/')[1] || 'jpg';
        const filename = `${crypto.randomUUID()}.${extension}`;
        const filePath = `shopee/${filename}`;

        console.log('📤 Fazendo upload para Storage:', filePath);

        // Upload para Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('produto-imagens')
          .upload(filePath, bytes, {
            contentType: mimeType,
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Erro no upload:', uploadError);
          // Continua sem imagem, não falha a operação
        } else {
          console.log('✅ Upload concluído:', uploadData);
          
          // Pegar URL pública
          const { data: urlData } = supabaseAdmin.storage
            .from('produto-imagens')
            .getPublicUrl(filePath);
          
          imagem_url = urlData.publicUrl;
          console.log('🔗 URL pública:', imagem_url);
        }
      } catch (imgError) {
        console.error('❌ Erro ao processar imagem:', imgError);
        // Continua sem imagem
      }
    }

    // Inserir produto usando service role (bypassa RLS)
    const { data: produto, error: insertError } = await supabaseAdmin
      .from('afiliado_produtos')
      .insert({
        user_id,
        titulo: titulo.substring(0, 500),
        preco: preco ? parseFloat(preco) : null,
        imagem_url,
        link_afiliado,
        marketplace: marketplace?.substring(0, 50) || 'Shopee',
        descricao: descricao ? descricao.substring(0, 2000) : null,
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

    console.log('✅ Produto Shopee inserido com sucesso:', produto.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Produto Shopee salvo com sucesso!',
        produto_id: produto.id,
        imagem_url: imagem_url,
        produto: {
          id: produto.id,
          titulo: produto.titulo,
          marketplace: produto.marketplace
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
