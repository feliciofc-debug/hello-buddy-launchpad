import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    
    console.log('🔍 Iniciando validação multi-fonte:', leadId);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Buscar lead
    const { data: lead, error: leadError } = await supabase
      .from('leads_imoveis_enriquecidos')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();
    
    if (leadError || !lead) {
      console.error('❌ Lead não encontrado:', leadError);
      throw new Error('Lead não encontrado');
    }
    
    console.log('📋 Lead:', lead.nome, lead.telefone);
    
    // Atualizar status para "validando"
    await supabase.from('leads_imoveis_enriquecidos').update({
      status_validacao: 'validando'
    }).eq('id', leadId);
    
    const fontes: string[] = [];
    const logs: any[] = [];
    let confiancaTotal = 0;
    
    const APIFY_API_KEY = Deno.env.get('APIFY_API_KEY');
    
    // ═══════════════════════════════════════════
    // CAMADA 1: VALIDAÇÃO BÁSICA
    // ═══════════════════════════════════════════
    
    console.log('📋 Camada 1: Validação básica...');
    
    let scoreNome = 0;
    let scoreTelefone = 0;
    let scoreLocalizacao = 0;
    
    // Nome (mínimo 2 palavras)
    if (lead.nome && lead.nome.split(' ').length >= 2) {
      scoreNome = 100;
    } else if (lead.nome) {
      scoreNome = 30;
    }
    
    // Telefone (11 dígitos)
    if (lead.telefone) {
      const telefoneLimpo = lead.telefone.replace(/\D/g, '');
      if (telefoneLimpo.length >= 10 && telefoneLimpo.length <= 13) {
        scoreTelefone = 100;
      } else {
        scoreTelefone = 30;
      }
    }
    
    // Localização
    if (lead.localizacao_desejada || lead.google_profile_url) {
      scoreLocalizacao = 80;
    }
    
    const scoreBasico = (scoreNome + scoreTelefone + scoreLocalizacao) / 3;
    confiancaTotal += scoreBasico * 0.15; // 15% do score total
    
    logs.push({
      etapa: 'validacao_basica',
      timestamp: new Date().toISOString(),
      resultado: 'concluido',
      scores: { scoreNome, scoreTelefone, scoreLocalizacao },
      contribuicao: scoreBasico * 0.15
    });
    
    console.log(`✅ Score básico: ${scoreBasico.toFixed(1)} (contribui ${(scoreBasico * 0.15).toFixed(1)}%)`);
    
    // Verificar score inicial para decidir nível de validação
    const scoreInicial = lead.score_total || scoreBasico;
    
    // OTIMIZAÇÃO: Pular APIs se score muito baixo
    if (scoreInicial < 40) {
      console.log('⚠️ Score muito baixo, validação básica apenas');
      
      await supabase.from('leads_imoveis_enriquecidos').update({
        fontes_encontradas: fontes,
        confianca_dados: Math.round(confiancaTotal),
        status_validacao: 'validado_basico',
        score_nome: scoreNome,
        score_telefone: scoreTelefone,
        score_localizacao: scoreLocalizacao,
        log_validacao: logs,
        data_validacao: new Date().toISOString(),
        validado_por: 'sistema'
      }).eq('id', leadId);
      
      return new Response(
        JSON.stringify({
          success: true,
          confianca: Math.round(confiancaTotal),
          status: 'validado_basico',
          fontes,
          logs,
          mensagem: 'Score inicial baixo - validação básica apenas'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ═══════════════════════════════════════════
    // CAMADA 2: MARKETPLACES (OLX)
    // ═══════════════════════════════════════════
    
    if (scoreInicial >= 50 && APIFY_API_KEY) {
      console.log('🏪 Camada 2: Buscando em marketplaces...');
      
      // --- OLX ---
      console.log('  📦 Buscando no OLX...');
      
      try {
        const searchQuery = lead.telefone 
          ? lead.telefone.replace(/\D/g, '').slice(-9) // Últimos 9 dígitos
          : lead.nome;
        
        const olxUrl = `https://api.apify.com/v2/acts/dtrungtin~olx-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
        
        const olxResponse = await fetch(olxUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchQuery: searchQuery,
            category: 'imoveis',
            maxItems: 5,
            proxyConfiguration: { useApifyProxy: true }
          })
        });
        
        if (olxResponse.ok) {
          const olxData = await olxResponse.json();
          
          if (olxData && olxData.length > 0) {
            console.log(`  ✅ OLX: ${olxData.length} anúncios encontrados`);
            
            fontes.push('olx');
            
            // Verificar se telefone bate
            const telefoneConfirmado = olxData.some((a: any) => 
              a.phone && lead.telefone && 
              a.phone.replace(/\D/g, '').includes(lead.telefone.replace(/\D/g, '').slice(-8))
            );
            
            await supabase.from('leads_imoveis_enriquecidos').update({
              olx_anuncios_ativos: olxData.filter((a: any) => a.active !== false).length,
              olx_anuncios_historico: olxData.slice(0, 10), // Máximo 10
              olx_telefone_confirmado: telefoneConfirmado,
              olx_ultima_atividade: new Date().toISOString()
            }).eq('id', leadId);
            
            confiancaTotal += 15; // OLX adiciona 15%
            
            logs.push({
              etapa: 'olx',
              timestamp: new Date().toISOString(),
              resultado: 'encontrado',
              total: olxData.length,
              telefone_confirmado: telefoneConfirmado,
              contribuicao: 15
            });
          } else {
            logs.push({
              etapa: 'olx',
              timestamp: new Date().toISOString(),
              resultado: 'nao_encontrado'
            });
          }
        }
      } catch (olxError: any) {
        console.error('  ⚠️ Erro OLX:', olxError.message);
        logs.push({
          etapa: 'olx',
          timestamp: new Date().toISOString(),
          resultado: 'erro',
          erro: olxError.message
        });
      }
    }
    
    // ═══════════════════════════════════════════
    // CAMADA 3: REDES SOCIAIS (LinkedIn + Instagram)
    // ═══════════════════════════════════════════
    
    let scoreRedesSociais = 0;
    
    if (scoreInicial >= 60 && APIFY_API_KEY) {
      console.log('📱 Camada 3: Buscando redes sociais...');
      
      // --- LINKEDIN ---
      console.log('  💼 Buscando no LinkedIn...');
      
      try {
        const linkedinUrl = `https://api.apify.com/v2/acts/apify~linkedin-profile-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
        
        const linkedinResponse = await fetch(linkedinUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchUrls: [`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.nome)}`],
            maxResults: 3,
            proxyConfiguration: { useApifyProxy: true }
          })
        });
        
        if (linkedinResponse.ok) {
          const linkedinData = await linkedinResponse.json();
          
          if (linkedinData && linkedinData.length > 0) {
            // MATCHING INTELIGENTE
            for (const profile of linkedinData) {
              let matchScore = 0;
              
              // Nome similar?
              const profileName = (profile.fullName || profile.name || '').toLowerCase();
              const leadName = lead.nome.toLowerCase();
              
              if (profileName === leadName) {
                matchScore += 40;
              } else if (profileName.includes(leadName.split(' ')[0])) {
                matchScore += 20;
              }
              
              // Localização bate?
              const profileLocation = (profile.location || '').toLowerCase();
              const leadLocation = (lead.localizacao_desejada || '').toLowerCase();
              
              if (leadLocation && profileLocation.includes(leadLocation)) {
                matchScore += 30;
              }
              
              // Foto disponível?
              if (profile.photoUrl || profile.profilePicture) {
                matchScore += 10;
              }
              
              // Se match > 60%, usar
              if (matchScore >= 60) {
                console.log(`  ✅ LinkedIn: Match ${matchScore}% - ${profile.fullName || profile.name}`);
                
                fontes.push('linkedin');
                
                await supabase.from('leads_imoveis_enriquecidos').update({
                  linkedin_url: profile.profileUrl || profile.url,
                  linkedin_foto: profile.photoUrl || profile.profilePicture,
                  cargo: profile.headline || profile.title,
                  empresa: profile.companyName || profile.company,
                  linkedin_encontrado: true
                }).eq('id', leadId);
                
                scoreRedesSociais += 30;
                confiancaTotal += 20;
                
                logs.push({
                  etapa: 'linkedin',
                  timestamp: new Date().toISOString(),
                  resultado: 'encontrado',
                  matchScore,
                  perfil: profile.profileUrl || profile.url,
                  contribuicao: 20
                });
                
                break;
              }
            }
            
            if (!fontes.includes('linkedin')) {
              logs.push({
                etapa: 'linkedin',
                timestamp: new Date().toISOString(),
                resultado: 'sem_match',
                total_encontrados: linkedinData.length
              });
            }
          } else {
            logs.push({
              etapa: 'linkedin',
              timestamp: new Date().toISOString(),
              resultado: 'nao_encontrado'
            });
          }
        }
      } catch (linkedinError: any) {
        console.error('  ⚠️ Erro LinkedIn:', linkedinError.message);
        logs.push({
          etapa: 'linkedin',
          timestamp: new Date().toISOString(),
          resultado: 'erro',
          erro: linkedinError.message
        });
      }
      
      // --- INSTAGRAM (só se LinkedIn encontrou) ---
      if (fontes.includes('linkedin')) {
        console.log('  📸 Buscando no Instagram...');
        
        try {
          // Gerar possíveis usernames
          const possibleUsernames = [
            lead.nome.toLowerCase().replace(/\s+/g, '_'),
            lead.nome.toLowerCase().replace(/\s+/g, ''),
            lead.nome.split(' ')[0].toLowerCase()
          ].filter(Boolean).slice(0, 2);
          
          const instagramUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
          
          const instagramResponse = await fetch(instagramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usernames: possibleUsernames,
              resultsLimit: 1,
              proxyConfiguration: { useApifyProxy: true }
            })
          });
          
          if (instagramResponse.ok) {
            const instagramData = await instagramResponse.json();
            
            if (instagramData && instagramData.length > 0) {
              const profile = instagramData[0];
              
              console.log(`  ✅ Instagram: @${profile.username}`);
              
              fontes.push('instagram');
              
              await supabase.from('leads_imoveis_enriquecidos').update({
                instagram_username: profile.username,
                instagram_url: `https://instagram.com/${profile.username}`,
                instagram_foto: profile.profilePicUrl || profile.profilePicture,
                instagram_followers: profile.followersCount || profile.followers,
                instagram_bio: profile.biography || profile.bio,
                instagram_encontrado: true
              }).eq('id', leadId);
              
              scoreRedesSociais += 20;
              confiancaTotal += 15;
              
              logs.push({
                etapa: 'instagram',
                timestamp: new Date().toISOString(),
                resultado: 'encontrado',
                username: profile.username,
                followers: profile.followersCount || profile.followers,
                contribuicao: 15
              });
            } else {
              logs.push({
                etapa: 'instagram',
                timestamp: new Date().toISOString(),
                resultado: 'nao_encontrado'
              });
            }
          }
        } catch (instagramError: any) {
          console.error('  ⚠️ Erro Instagram:', instagramError.message);
          logs.push({
            etapa: 'instagram',
            timestamp: new Date().toISOString(),
            resultado: 'erro',
            erro: instagramError.message
          });
        }
      }
    }
    
    // ═══════════════════════════════════════════
    // CAMADA 4: VALIDAÇÃO DE FOTO (FUTURO - Face++)
    // ═══════════════════════════════════════════
    
    // Placeholder para implementar depois com Face++ API
    logs.push({
      etapa: 'face_recognition',
      timestamp: new Date().toISOString(),
      resultado: 'pendente',
      mensagem: 'Aguardando configuração Face++ API'
    });
    
    // ═══════════════════════════════════════════
    // CAMADA 5: SCORE FINAL
    // ═══════════════════════════════════════════
    
    console.log('🎯 Camada 5: Calculando score final...');
    
    // Confiança máxima: 100%
    confiancaTotal = Math.min(Math.round(confiancaTotal), 100);
    
    // Status baseado em confiança
    let statusValidacao = 'rejeitado';
    if (confiancaTotal >= 90) statusValidacao = 'validado';
    else if (confiancaTotal >= 60) statusValidacao = 'provavel';
    else if (confiancaTotal >= 40) statusValidacao = 'baixa_confianca';
    
    // Calcular score de atividade baseado nas fontes
    const scoreAtividade = fontes.length * 20; // 20 pontos por fonte encontrada
    
    // Atualizar lead com todos os dados
    await supabase.from('leads_imoveis_enriquecidos').update({
      fontes_encontradas: fontes,
      confianca_dados: confiancaTotal,
      status_validacao: statusValidacao,
      
      score_nome: scoreNome,
      score_telefone: scoreTelefone,
      score_localizacao: scoreLocalizacao,
      score_atividade: scoreAtividade,
      score_redes_sociais: scoreRedesSociais,
      
      log_validacao: logs,
      data_validacao: new Date().toISOString(),
      validado_por: 'sistema'
    }).eq('id', leadId);
    
    console.log('═══════════════════════════════════════════');
    console.log('✅ Validação concluída!');
    console.log(`📊 Confiança: ${confiancaTotal}%`);
    console.log(`📌 Status: ${statusValidacao}`);
    console.log(`🔗 Fontes: ${fontes.length > 0 ? fontes.join(', ') : 'nenhuma'}`);
    console.log('═══════════════════════════════════════════');
    
    return new Response(
      JSON.stringify({
        success: true,
        confianca: confiancaTotal,
        status: statusValidacao,
        fontes,
        logs,
        scores: {
          nome: scoreNome,
          telefone: scoreTelefone,
          localizacao: scoreLocalizacao,
          atividade: scoreAtividade,
          redes_sociais: scoreRedesSociais
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: any) {
    console.error('❌ Erro na validação:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 200, // Sempre 200 para evitar retry
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
