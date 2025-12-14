import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════
// FUNÇÃO NORMALIZAR NOME (para comparação)
// ═══════════════════════════════════════════
function normalizarNome(nome: string): string[] {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z\s]/g, '') // Remove caracteres especiais
    .split(/\s+/)
    .filter(p => p.length > 2); // Ignora partículas pequenas (de, da, do, etc)
}

// ═══════════════════════════════════════════
// FUNÇÃO VERIFICAR SE NOMES CORRESPONDEM
// ═══════════════════════════════════════════
function nomesCorrespondem(nomeLead: string, nomeEncontrado: string): boolean {
  const partesLead = normalizarNome(nomeLead);
  const partesEncontrado = normalizarNome(nomeEncontrado);
  
  if (partesLead.length === 0 || partesEncontrado.length === 0) {
    return false;
  }
  
  // Verificar se primeiro nome corresponde
  const primeiroNomeLead = partesLead[0];
  const primeiroNomeEncontrado = partesEncontrado[0];
  
  // Primeiro nome deve corresponder (ou ser muito similar)
  if (primeiroNomeLead !== primeiroNomeEncontrado) {
    // Verificar se um começa com o outro (ex: "Lu" vs "Luciana")
    if (!primeiroNomeLead.startsWith(primeiroNomeEncontrado.substring(0, 3)) &&
        !primeiroNomeEncontrado.startsWith(primeiroNomeLead.substring(0, 3))) {
      console.log(`❌ Primeiro nome não corresponde: "${primeiroNomeLead}" vs "${primeiroNomeEncontrado}"`);
      return false;
    }
  }
  
  // Verificar se pelo menos uma parte do sobrenome corresponde
  const sobrenomesLead = partesLead.slice(1);
  const sobrenomesEncontrado = partesEncontrado.slice(1);
  
  if (sobrenomesLead.length > 0 && sobrenomesEncontrado.length > 0) {
    const temSobrenomeEmComum = sobrenomesLead.some(s1 => 
      sobrenomesEncontrado.some(s2 => s1 === s2 || s1.includes(s2) || s2.includes(s1))
    );
    
    if (!temSobrenomeEmComum) {
      console.log(`❌ Nenhum sobrenome em comum: ${sobrenomesLead.join(',')} vs ${sobrenomesEncontrado.join(',')}`);
      return false;
    }
  }
  
  console.log(`✅ Nomes correspondem: "${nomeLead}" ≈ "${nomeEncontrado}"`);
  return true;
}

// ═══════════════════════════════════════════
// FUNÇÃO BUSCAR LINKEDIN (SERPAPI) COM VALIDAÇÃO DE NOME
// ═══════════════════════════════════════════
async function buscarLinkedIn(nomeLead: string, cidade?: string, empresaOuCargo?: string): Promise<string | null> {
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
  
  if (!SERPAPI_KEY) {
    console.log('⚠️ SERPAPI_KEY não configurada');
    return null;
  }
  
  try {
    const queryParts = [nomeLead];
    
    // Adicionar cidade para maior precisão
    if (cidade) {
      queryParts.push(cidade);
    }
    
    if (empresaOuCargo) {
      queryParts.push(empresaOuCargo);
    }
    queryParts.push('site:linkedin.com/in/');
    
    const query = encodeURIComponent(queryParts.join(' '));
    const url = `https://serpapi.com/search.json?q=${query}&api_key=${SERPAPI_KEY}&num=5`;
    
    console.log(`🔍 Buscando LinkedIn via SerpAPI: ${nomeLead}`);
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const results = data.organic_results || [];
    
    for (const result of results) {
      const link = result.link || '';
      if (link.includes('linkedin.com/in/')) {
        // VALIDAR NOME antes de aceitar
        const titulo = result.title || '';
        // LinkedIn títulos geralmente são "Nome Sobrenome - Cargo | LinkedIn"
        const nomeDoTitulo = titulo.split(' - ')[0].split(' | ')[0].trim();
        
        console.log(`🔍 Verificando correspondência: "${nomeLead}" vs "${nomeDoTitulo}"`);
        
        if (nomesCorrespondem(nomeLead, nomeDoTitulo)) {
          console.log(`✅ LinkedIn VALIDADO: ${link}`);
          return link;
        } else {
          console.log(`⚠️ LinkedIn rejeitado (nome não corresponde): ${nomeDoTitulo}`);
        }
      }
    }
    
    console.log(`⚠️ LinkedIn não encontrado para ${nomeLead} (nenhum resultado válido)`);
    return null;
  } catch (e) {
    console.log(`❌ Erro ao buscar LinkedIn: ${e}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// FUNÇÃO BUSCAR INSTAGRAM (SERPAPI) COM VALIDAÇÃO DE NOME
// ═══════════════════════════════════════════
async function buscarInstagram(nomeLead: string, cidade?: string): Promise<{ url: string | null, username: string | null }> {
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
  
  if (!SERPAPI_KEY) {
    console.log('⚠️ SERPAPI_KEY não configurada');
    return { url: null, username: null };
  }
  
  try {
    const queryParts = [nomeLead];
    if (cidade) {
      queryParts.push(cidade);
    }
    queryParts.push('site:instagram.com');
    
    const query = encodeURIComponent(queryParts.join(' '));
    const url = `https://serpapi.com/search.json?q=${query}&api_key=${SERPAPI_KEY}&num=5`;
    
    console.log(`📸 Buscando Instagram via SerpAPI: ${nomeLead}`);
    
    const response = await fetch(url);
    if (!response.ok) return { url: null, username: null };
    
    const data = await response.json();
    const results = data.organic_results || [];
    
    for (const result of results) {
      const link = result.link || '';
      // Procurar perfis do Instagram (não posts ou reels)
      const match = link.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?$/);
      if (match && !['p', 'reel', 'stories', 'explore', 'accounts'].includes(match[1])) {
        const username = match[1];
        
        // VALIDAR: verificar se o título/snippet contém partes do nome
        const titulo = result.title || '';
        const snippet = result.snippet || '';
        const textoCompleto = `${titulo} ${snippet}`.toLowerCase();
        
        const partesNome = normalizarNome(nomeLead);
        const temNomeNoTexto = partesNome.slice(0, 2).some(parte => textoCompleto.includes(parte));
        
        if (temNomeNoTexto) {
          console.log(`✅ Instagram VALIDADO: @${username}`);
          return { url: link, username };
        } else {
          console.log(`⚠️ Instagram rejeitado (nome não encontrado no resultado): @${username}`);
        }
      }
    }
    
    console.log(`⚠️ Instagram não encontrado para ${nomeLead}`);
    return { url: null, username: null };
  } catch (e) {
    console.log(`❌ Erro ao buscar Instagram: ${e}`);
    return { url: null, username: null };
  }
}

// ═══════════════════════════════════════════
// FUNÇÃO BUSCAR FACEBOOK (SERPAPI) COM VALIDAÇÃO DE NOME
// ═══════════════════════════════════════════
async function buscarFacebook(nomeLead: string, cidade?: string): Promise<string | null> {
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
  
  if (!SERPAPI_KEY) {
    console.log('⚠️ SERPAPI_KEY não configurada');
    return null;
  }
  
  try {
    const queryParts = [nomeLead];
    if (cidade) {
      queryParts.push(cidade);
    }
    queryParts.push('site:facebook.com');
    
    const query = encodeURIComponent(queryParts.join(' '));
    const url = `https://serpapi.com/search.json?q=${query}&api_key=${SERPAPI_KEY}&num=5`;
    
    console.log(`👤 Buscando Facebook via SerpAPI: ${nomeLead}`);
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const results = data.organic_results || [];
    
    for (const result of results) {
      const link = result.link || '';
      // Procurar perfis do Facebook (não páginas de posts)
      if (link.includes('facebook.com/') && 
          !link.includes('/posts/') && 
          !link.includes('/photos/') &&
          !link.includes('/videos/')) {
        
        // VALIDAR: verificar se o título contém partes do nome
        const titulo = result.title || '';
        const partesNome = normalizarNome(nomeLead);
        const tituloNormalizado = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        const temNomeNoTitulo = partesNome.slice(0, 2).some(parte => tituloNormalizado.includes(parte));
        
        if (temNomeNoTitulo) {
          console.log(`✅ Facebook VALIDADO: ${link}`);
          return link;
        } else {
          console.log(`⚠️ Facebook rejeitado (nome não encontrado): ${titulo}`);
        }
      }
    }
    
    console.log(`⚠️ Facebook não encontrado para ${nomeLead}`);
    return null;
  } catch (e) {
    console.log(`❌ Erro ao buscar Facebook: ${e}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// EDGE FUNCTION PRINCIPAL
// ═══════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    
    console.log('═══════════════════════════════════════');
    console.log('🔍 Validando lead:', leadId);
    console.log('Tipo do ID:', typeof leadId);
    console.log('═══════════════════════════════════════');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Buscar lead no banco
    const { data: lead, error: leadError } = await supabase
      .from('leads_imoveis_enriquecidos')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();
    
    console.log('Lead encontrado?', !!lead);
    console.log('Erro na busca?', leadError?.message);
    
    if (leadError || !lead) {
      // Listar leads disponíveis para debug
      const { data: todosLeads } = await supabase
        .from('leads_imoveis_enriquecidos')
        .select('id, nome')
        .limit(5);
      
      console.log('❌ Lead não encontrado! IDs disponíveis:', todosLeads?.map(l => ({ id: l.id, nome: l.nome })));
      throw new Error('Lead não encontrado');
    }
    
    console.log('Lead:', lead.nome);
    
    let confianca = lead.score_total || 0;
    const fontes: string[] = [];
    const updateData: any = {};
    
    // Extrair cidade do lead (se disponível nas corretoras visitadas)
    let cidade = '';
    if (lead.corretoras_visitadas && lead.corretoras_visitadas.length > 0) {
      const endereco = lead.corretoras_visitadas[0]?.endereco || '';
      // Extrair cidade do endereço (ex: "Rio de Janeiro - RJ")
      const match = endereco.match(/([A-Za-zÀ-ú\s]+)\s*-\s*[A-Z]{2}/);
      if (match) {
        cidade = match[1].trim();
      }
    }
    console.log('Cidade detectada:', cidade || 'não identificada');
    
    // ═══════════════════════════════════════════
    // 1. BUSCAR LINKEDIN
    // ═══════════════════════════════════════════
    
    if (!lead.linkedin_url) {
      console.log('💼 Buscando LinkedIn...');
      const linkedinUrl = await buscarLinkedIn(lead.nome, cidade, lead.empresa || lead.cargo);
      
      if (linkedinUrl) {
        updateData.linkedin_url = linkedinUrl;
        updateData.linkedin_encontrado = true;
        confianca += 30;
        fontes.push('linkedin');
        console.log('✅ LinkedIn encontrado e salvo!');
      }
    } else {
      console.log('✅ LinkedIn já existe:', lead.linkedin_url);
      fontes.push('linkedin');
      confianca += 30;
    }
    
    // ═══════════════════════════════════════════
    // 2. BUSCAR INSTAGRAM
    // ═══════════════════════════════════════════
    
    if (!lead.instagram_username && !lead.instagram_url) {
      console.log('📸 Buscando Instagram...');
      const instagram = await buscarInstagram(lead.nome, cidade);
      
      if (instagram.url || instagram.username) {
        updateData.instagram_url = instagram.url;
        updateData.instagram_username = instagram.username;
        updateData.instagram_encontrado = true;
        confianca += 20;
        fontes.push('instagram');
        console.log('✅ Instagram encontrado e salvo!');
      }
    } else {
      console.log('✅ Instagram já existe:', lead.instagram_username || lead.instagram_url);
      fontes.push('instagram');
      confianca += 20;
    }
    
    // ═══════════════════════════════════════════
    // 3. BUSCAR FACEBOOK
    // ═══════════════════════════════════════════
    
    if (!lead.facebook_url) {
      console.log('👤 Buscando Facebook...');
      const facebookUrl = await buscarFacebook(lead.nome, cidade);
      
      if (facebookUrl) {
        updateData.facebook_url = facebookUrl;
        updateData.facebook_encontrado = true;
        confianca += 15;
        fontes.push('facebook');
        console.log('✅ Facebook encontrado e salvo!');
      }
    } else {
      console.log('✅ Facebook já existe:', lead.facebook_url);
      fontes.push('facebook');
      confianca += 15;
    }
    
    // ═══════════════════════════════════════════
    // 4. VERIFICAR DADOS DO GOOGLE (já temos)
    // ═══════════════════════════════════════════
    
    if (lead.foto_url || lead.google_profile_url || (lead.corretoras_visitadas && lead.corretoras_visitadas.length > 0)) {
      console.log('🌐 Dados do Google já existem');
      fontes.push('google');
      confianca += 25;
    }
    
    // ═══════════════════════════════════════════
    // ATUALIZAR CONFIANÇA FINAL
    // ═══════════════════════════════════════════
    
    const dadosCompletos = fontes.length >= 2; // Pelo menos 2 fontes
    
    updateData.confianca_dados = Math.min(confianca, 100); // Cap em 100%
    updateData.dados_completos = dadosCompletos;
    updateData.data_enriquecimento = new Date().toISOString();
    updateData.fontes_encontradas = fontes;
    
    await supabase.from('leads_imoveis_enriquecidos')
      .update(updateData)
      .eq('id', leadId);
    
    console.log('═══════════════════════════════════════');
    console.log('✅ Validação concluída!');
    console.log(`Confiança: ${Math.min(confianca, 100)}%`);
    console.log(`Fontes: ${fontes.join(', ')}`);
    console.log('═══════════════════════════════════════');
    
    return new Response(
      JSON.stringify({
        success: true,
        confianca: Math.min(confianca, 100),
        dadosCompletos,
        fontes,
        linkedinUrl: updateData.linkedin_url || lead.linkedin_url,
        instagramUrl: updateData.instagram_url || lead.instagram_url,
        instagramUsername: updateData.instagram_username || lead.instagram_username,
        facebookUrl: updateData.facebook_url || lead.facebook_url
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: any) {
    console.error('❌ Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
