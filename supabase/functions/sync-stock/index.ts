import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper para pegar valores nested (ex: "categoria.descricao")
function getNestedValue(obj: any, path: string): any {
  if (!path) return undefined;
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const integrationId = body.integration_id;
    const testOnly = body.test_only || false;

    console.log('🔄 Iniciando sincronização de estoque...');
    console.log('Integration ID:', integrationId);
    console.log('Test Only:', testOnly);

    // Buscar integrações ativas
    let query = supabase
      .from('stock_integrations')
      .select('*')
      .eq('active', true);

    // Se for uma integração específica
    if (integrationId) {
      query = supabase
        .from('stock_integrations')
        .select('*')
        .eq('id', integrationId);
    } else {
      // Só buscar as que têm auto_sync ativo
      query = query.eq('auto_sync', true);
    }

    const { data: integrations, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ Erro ao buscar integrações:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📡 Encontradas ${integrations?.length || 0} integrações`);

    const results: any[] = [];

    for (const integration of integrations || []) {
      const integrationResult: any = {
        id: integration.id,
        name: integration.name,
        type: integration.integration_type,
        status: 'pending',
        productsFound: 0,
        productsUpdated: 0,
        error: null
      };

      try {
        console.log(`\n📦 Sincronizando: ${integration.name} (${integration.integration_type})`);

        // Montar headers de autenticação
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        if (integration.auth_type === 'api_key' && integration.api_key) {
          headers['apikey'] = integration.api_key;
          headers['X-API-Key'] = integration.api_key;
        } else if (integration.auth_type === 'bearer' && integration.api_token) {
          headers['Authorization'] = `Bearer ${integration.api_token}`;
        } else if (integration.auth_type === 'token' && integration.api_token) {
          headers['token'] = integration.api_token;
        } else if (integration.auth_type === 'basic' && integration.api_key) {
          headers['Authorization'] = `Basic ${btoa(integration.api_key)}`;
        }

        console.log('🔑 Headers configurados:', Object.keys(headers));

        // Montar URL com parâmetros
        let apiUrl = integration.api_url;
        
        // Para APIs que usam query params para autenticação
        if (integration.integration_type === 'tiny' && integration.api_token) {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `token=${integration.api_token}&formato=json`;
        } else if (integration.integration_type === 'bling' && integration.api_key) {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `apikey=${integration.api_key}`;
        }

        console.log('📡 Chamando API:', apiUrl.substring(0, 50) + '...');

        // Buscar produtos da API externa
        const response = await fetch(apiUrl, { 
          method: 'GET',
          headers 
        });

        console.log('📬 Status da resposta:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API retornou ${response.status}: ${errorText.substring(0, 200)}`);
        }

        let externalData = await response.json();
        console.log('📥 Dados recebidos:', JSON.stringify(externalData).substring(0, 500));

        // Normalizar dados (diferentes APIs retornam em formatos diferentes)
        let products: any[] = [];
        
        if (Array.isArray(externalData)) {
          products = externalData;
        } else if (externalData.produtos) {
          products = externalData.produtos;
        } else if (externalData.retorno?.produtos) {
          products = externalData.retorno.produtos.map((p: any) => p.produto);
        } else if (externalData.data) {
          products = Array.isArray(externalData.data) ? externalData.data : [externalData.data];
        } else if (externalData.items) {
          products = externalData.items;
        }

        console.log(`📦 ${products.length} produtos encontrados na API externa`);
        integrationResult.productsFound = products.length;

        if (products.length === 0) {
          console.log('⚠️ Nenhum produto encontrado na API');
          integrationResult.status = 'success';
          integrationResult.message = 'Nenhum produto encontrado na API externa';
        } else {
          // Processar cada produto
          const mapping = integration.field_mapping || {};
          let updated = 0;

          for (const item of products) {
            // Extrair dados conforme mapeamento
            const sku = getNestedValue(item, mapping.sku || 'sku') || getNestedValue(item, 'codigo') || getNestedValue(item, 'sku');
            const estoque = getNestedValue(item, mapping.estoque || 'estoque');
            const preco = getNestedValue(item, mapping.preco || 'preco');
            const nome = getNestedValue(item, mapping.nome || 'nome');

            if (!sku) {
              console.log('⚠️ Produto sem SKU, pulando:', JSON.stringify(item).substring(0, 100));
              continue;
            }

            console.log(`🔄 Processando SKU: ${sku}, Estoque: ${estoque}, Preço: ${preco}`);

            // Atualizar produto na AMZ (buscar por SKU)
            const updateData: any = { 
              updated_at: new Date().toISOString() 
            };
            
            if (estoque !== undefined && estoque !== null) {
              updateData.estoque = parseInt(String(estoque)) || 0;
            }
            if (preco !== undefined && preco !== null) {
              updateData.preco = parseFloat(String(preco).replace(',', '.')) || 0;
            }
            if (nome && mapping.sync_nome) {
              updateData.nome = nome;
            }

            if (!testOnly) {
              const { data: updatedProduct, error: updateError } = await supabase
                .from('produtos')
                .update(updateData)
                .eq('user_id', integration.user_id)
                .eq('sku', sku)
                .select('id, sku, nome')
                .single();

              if (updateError) {
                if (updateError.code === 'PGRST116') {
                  console.log(`⚠️ Produto com SKU ${sku} não encontrado no AMZ`);
                } else {
                  console.error(`❌ Erro ao atualizar SKU ${sku}:`, updateError);
                }
              } else if (updatedProduct) {
                console.log(`✅ Atualizado: ${updatedProduct.nome} (SKU: ${sku})`);
                updated++;
              }
            } else {
              console.log(`🧪 [TESTE] Atualizaria SKU ${sku}:`, updateData);
              updated++;
            }
          }

          integrationResult.productsUpdated = updated;
          integrationResult.status = 'success';

          // Atualizar status da integração
          if (!testOnly) {
            await supabase
              .from('stock_integrations')
              .update({
                last_sync_at: new Date().toISOString(),
                last_sync_status: 'success',
                last_error: null,
                sync_count: (integration.sync_count || 0) + 1,
                products_synced: updated
              })
              .eq('id', integration.id);
          }

          console.log(`✅ ${integration.name}: ${updated} produtos atualizados`);
        }

      } catch (error: any) {
        console.error(`❌ Erro em ${integration.name}:`, error);
        
        integrationResult.status = 'error';
        integrationResult.error = error.message;

        // Registrar erro na integração
        if (!testOnly) {
          await supabase
            .from('stock_integrations')
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: 'error',
              last_error: error.message
            })
            .eq('id', integration.id);
        }
      }

      results.push(integrationResult);
    }

    console.log('\n🏁 Sincronização finalizada!');
    console.log('Resultados:', JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({ 
      success: true, 
      integrations_processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
