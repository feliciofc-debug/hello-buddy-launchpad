import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Iniciando busca de leads enriquecidos...');
    
    const { 
      estados, 
      cidades, 
      orcamento_min, 
      orcamento_max, 
      tipos_imovel, 
      quartos_min 
    } = await req.json();
    
    console.log('Parâmetros:', { estados, cidades, orcamento_min, orcamento_max, tipos_imovel, quartos_min });
    
    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extrair user_id do token JWT
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    console.log('User ID:', userId);
    
    // Por enquanto, gerar leads simulados baseados nos parâmetros
    // (A integração real com Google Places será implementada depois)
    
    const leadsSimulados = gerarLeadsSimulados(estados, cidades, tipos_imovel, orcamento_min, orcamento_max, quartos_min);
    
    console.log(`✅ ${leadsSimulados.length} leads gerados`);
    
    // Salvar no banco se tiver userId
    if (userId) {
      for (const lead of leadsSimulados) {
        const { error } = await supabase.from('leads_imoveis_enriquecidos').insert({
          user_id: userId,
          ...lead,
          created_at: new Date().toISOString()
        });
        
        if (error) {
          console.error('Erro ao salvar lead:', error);
        }
      }
      console.log('💾 Leads salvos no banco');
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        total: leadsSimulados.length,
        leads: leadsSimulados
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error: unknown) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

// Função para gerar leads simulados para teste
function gerarLeadsSimulados(
  estados: string[], 
  cidades: string[], 
  tipos: string[], 
  orcMin: number, 
  orcMax: number, 
  quartosMin: number
) {
  const nomes = [
    'Maria Silva Santos',
    'João Carlos Oliveira', 
    'Ana Paula Ferreira',
    'Pedro Henrique Costa',
    'Juliana Almeida Rodrigues',
    'Carlos Eduardo Lima',
    'Fernanda Souza Martins',
    'Ricardo Pereira Gomes',
    'Patrícia Nascimento',
    'Lucas Andrade Silva'
  ];

  const cargos = [
    'Diretor Comercial',
    'Empresário',
    'Médico Cardiologista',
    'Advogada Tributarista',
    'CEO',
    'Engenheiro Civil',
    'Gerente de Investimentos',
    'Consultor Financeiro',
    'Dentista',
    'Arquiteta'
  ];

  const empresas = [
    'Grupo Votorantim',
    'Clínica Premium Saúde',
    'Escritório Advocacia Silva',
    'Tech Solutions Brasil',
    'Construtora Alpha',
    'Banco Safra',
    'Hospital São Lucas',
    'Studio Arquitetura',
    'Consultoria XP',
    'Empresa Própria'
  ];

  const corretoras = [
    'Imobiliária Premium Rio',
    'Barra Gold Imóveis',
    'Cyrela Rio',
    'Gafisa Prime',
    'Lopes Consultoria',
    'Fernandez Mera',
    'Brasil Brokers',
    'Elite Imóveis',
    'Coelho da Fonseca',
    'RE/MAX Premium'
  ];

  return nomes.slice(0, 6).map((nome, idx) => {
    const numCorretoras = Math.floor(Math.random() * 4) + 2;
    const corretorasVisitadas = [];
    
    for (let i = 0; i < numCorretoras; i++) {
      corretorasVisitadas.push({
        nome: corretoras[Math.floor(Math.random() * corretoras.length)],
        data: `há ${Math.floor(Math.random() * 20) + 1} dias`,
        review: `Estou procurando ${tipos[0] || 'apartamento'} com ${quartosMin}+ quartos na região da ${cidades[0] || 'Barra da Tijuca'}. Orçamento de até R$ ${(orcMax / 1000000).toFixed(1)} milhões.`,
        rating: Math.floor(Math.random() * 2) + 4
      });
    }

    const score = 50 + Math.floor(Math.random() * 50);
    let qualificacao = 'MORNO';
    if (score >= 80) qualificacao = 'SUPER QUENTE';
    else if (score >= 60) qualificacao = 'QUENTE';

    const instagramFollowers = Math.floor(Math.random() * 15000) + 500;
    const rendaEstimada = 25000 + Math.floor(Math.random() * 75000);

    return {
      nome,
      foto_url: `https://i.pravatar.cc/150?u=${nome.replace(/\s/g, '')}`,
      google_profile_url: `https://www.google.com/maps/contrib/${100000000000 + idx}`,
      
      corretoras_visitadas: corretorasVisitadas,
      total_corretoras: numCorretoras,
      ultima_visita_dias: Math.floor(Math.random() * 15) + 1,
      
      tipo_imovel_desejado: tipos[0] || 'apartamento',
      quartos_desejado: quartosMin + Math.floor(Math.random() * 2),
      localizacao_desejada: cidades[0] || estados[0],
      orcamento_min: orcMin,
      orcamento_max: orcMax,
      objecoes: Math.random() > 0.5 ? ['Preço alto'] : [],
      
      linkedin_url: `https://linkedin.com/in/${nome.toLowerCase().replace(/\s/g, '-')}`,
      linkedin_foto: `https://i.pravatar.cc/150?u=li${nome.replace(/\s/g, '')}`,
      cargo: cargos[idx % cargos.length],
      empresa: empresas[idx % empresas.length],
      setor: 'Negócios',
      experiencia_anos: 10 + Math.floor(Math.random() * 15),
      formacao: 'MBA FGV',
      linkedin_connections: ['500+', '1000+', '2000+'][Math.floor(Math.random() * 3)],
      linkedin_encontrado: true,
      
      instagram_username: nome.toLowerCase().replace(/\s/g, '_'),
      instagram_url: `https://instagram.com/${nome.toLowerCase().replace(/\s/g, '_')}`,
      instagram_foto: `https://i.pravatar.cc/150?u=ig${nome.replace(/\s/g, '')}`,
      instagram_followers: instagramFollowers,
      instagram_posts: Math.floor(Math.random() * 500) + 50,
      instagram_bio: 'Lifestyle | Investimentos | Família 🏠',
      instagram_interesses: ['golf', 'investimentos', 'viagens', 'gastronomia'].slice(0, 2 + Math.floor(Math.random() * 3)),
      instagram_encontrado: true,
      
      facebook_url: `https://facebook.com/${nome.toLowerCase().replace(/\s/g, '')}`,
      facebook_foto: `https://i.pravatar.cc/150?u=fb${nome.replace(/\s/g, '')}`,
      facebook_cidade: cidades[0] || 'Rio de Janeiro',
      facebook_trabalho: empresas[idx % empresas.length],
      facebook_clubes: ['Iate Clube Rio', 'Clube Olímpico'][Math.floor(Math.random() * 2)] ? ['Iate Clube Rio'] : [],
      facebook_encontrado: Math.random() > 0.3,
      
      score_total: score,
      qualificacao,
      renda_estimada: rendaEstimada,
      patrimonio_estimado: rendaEstimada * 24,
      probabilidade_compra: 40 + Math.floor(Math.random() * 50),
      
      dados_completos: true,
      status: 'novo',
      telefone: `21${Math.floor(Math.random() * 900000000) + 100000000}`
    };
  });
}
