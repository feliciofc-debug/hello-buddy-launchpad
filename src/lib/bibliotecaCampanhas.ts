import { supabase } from "@/integrations/supabase/client";

interface SalvarCampanhaParams {
  produto: {
    id: string;
    nome: string;
    descricao?: string;
    preco?: number;
    imagem_url?: string;
    imagens?: string[];
    categoria?: string;
    link_marketplace?: string;
  };
  campanha: {
    id: string;
    nome: string;
    mensagem_template?: string;
    frequencia?: string;
    listas_ids?: string[];
  };
}

export async function salvarCampanhaNaBiblioteca(params: SalvarCampanhaParams) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      console.error('Usuário não autenticado');
      return null;
    }

    const { produto, campanha } = params;

    // Verificar se já existe essa campanha na biblioteca
    const { data: existente } = await supabase
      .from('biblioteca_campanhas')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('campanha_id', campanha.id)
      .single();

    if (existente) {
      console.log('📚 Campanha já existe na biblioteca:', existente.id);
      return existente;
    }

    // Inserir nova entrada na biblioteca
    const { data, error } = await supabase
      .from('biblioteca_campanhas')
      .insert({
        user_id: userData.user.id,
        produto_id: produto.id,
        campanha_id: campanha.id,
        produto_nome: produto.nome,
        produto_descricao: produto.descricao || null,
        produto_preco: produto.preco || null,
        produto_imagem_url: produto.imagem_url || null,
        produto_imagens: produto.imagens || [],
        produto_categoria: produto.categoria || null,
        produto_link_marketplace: produto.link_marketplace || null,
        campanha_nome: campanha.nome,
        mensagem_template: campanha.mensagem_template || null,
        frequencia: campanha.frequencia || null,
        listas_ids: campanha.listas_ids || null,
        status: 'ativa',
        data_campanha: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao salvar na biblioteca:', error);
      return null;
    }

    console.log('📚 Campanha salva na biblioteca:', data);
    return data;
  } catch (error) {
    console.error('❌ Erro ao salvar campanha na biblioteca:', error);
    return null;
  }
}

export async function atualizarMetricasBiblioteca(campanhaId: string, metricas: {
  total_enviados?: number;
  total_respostas?: number;
  total_conversoes?: number;
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    // Buscar registro atual
    const { data: atual } = await supabase
      .from('biblioteca_campanhas')
      .select('total_enviados, total_respostas, total_conversoes')
      .eq('campanha_id', campanhaId)
      .eq('user_id', userData.user.id)
      .single();

    if (!atual) return null;

    // Calcular novos totais
    const novosEnviados = (atual.total_enviados || 0) + (metricas.total_enviados || 0);
    const novasRespostas = (atual.total_respostas || 0) + (metricas.total_respostas || 0);
    const novasConversoes = (atual.total_conversoes || 0) + (metricas.total_conversoes || 0);

    // Calcular taxas
    const taxaResposta = novosEnviados > 0 ? (novasRespostas / novosEnviados) * 100 : 0;
    const taxaConversao = novasRespostas > 0 ? (novasConversoes / novasRespostas) * 100 : 0;

    const { data, error } = await supabase
      .from('biblioteca_campanhas')
      .update({
        total_enviados: novosEnviados,
        total_respostas: novasRespostas,
        total_conversoes: novasConversoes,
        taxa_resposta: parseFloat(taxaResposta.toFixed(1)),
        taxa_conversao: parseFloat(taxaConversao.toFixed(1)),
        updated_at: new Date().toISOString()
      })
      .eq('campanha_id', campanhaId)
      .eq('user_id', userData.user.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar métricas:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Erro ao atualizar métricas da biblioteca:', error);
    return null;
  }
}