import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const diagnostico: any = {
    timestamp: new Date().toISOString(),
    etapas: [],
    status: 'iniciando'
  }

  try {
    // ===== CONFIGURAÇÕES =====
    const CONTABO_URL = Deno.env.get('CONTABO_WUZAPI_URL') || ''
    const CONTABO_TOKEN = Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN') || ''
    const WUZAPI_URL = Deno.env.get('WUZAPI_URL') || ''
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN') || ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    
    diagnostico.etapas.push({
      etapa: '1. Verificar variáveis de ambiente',
      CONTABO_URL: CONTABO_URL ? '✅ Configurado' : '❌ Faltando',
      CONTABO_TOKEN: CONTABO_TOKEN ? '✅ Configurado' : '❌ Faltando',
      WUZAPI_URL: WUZAPI_URL ? '✅ Configurado' : '❌ Faltando',
      WUZAPI_TOKEN: WUZAPI_TOKEN ? '✅ Configurado' : '❌ Faltando',
      SUPABASE_URL: SUPABASE_URL ? '✅ Configurado' : '❌ Faltando',
    })
    
    // ===== TESTAR CONEXÃO CONTABO =====
    let contaboStatus: any = { disponivel: false }
    if (CONTABO_URL && CONTABO_TOKEN) {
      try {
        const response = await fetch(`${CONTABO_URL}/api/sessions`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CONTABO_TOKEN}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const sessions = await response.json()
          contaboStatus = {
            disponivel: true,
            totalSessoes: Array.isArray(sessions) ? sessions.length : (sessions.sessions?.length || 0),
            sessoes: Array.isArray(sessions) ? sessions.map((s: any) => ({
              id: s.id || s.user_id,
              name: s.name || s.user_id,
              connected: s.connected,
              phone: s.phone || s.jid,
              webhook: s.webhook || 'não informado'
            })) : sessions.sessions?.map((s: any) => ({
              id: s.id || s.user_id,
              name: s.name || s.user_id,
              connected: s.connected,
              phone: s.phone || s.jid,
              webhook: s.webhook || 'não informado'
            })) || []
          }
        } else {
          const errorText = await response.text()
          contaboStatus = { 
            disponivel: false, 
            erro: `Status ${response.status}: ${errorText}` 
          }
        }
      } catch (e: any) {
        contaboStatus = { disponivel: false, erro: e.message }
      }
    }
    
    diagnostico.etapas.push({
      etapa: '2. Conexão com Wuzapi Contabo',
      ...contaboStatus
    })
    
    // ===== VERIFICAR INSTÂNCIA AMZ-Ofertas =====
    let amzOfertasStatus: any = { encontrada: false }
    if (CONTABO_URL && CONTABO_TOKEN) {
      try {
        // Listar usuários/instâncias
        const usersResponse = await fetch(`${CONTABO_URL}/api/users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CONTABO_TOKEN}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (usersResponse.ok) {
          const users = await usersResponse.json()
          const amzUser = users.find?.((u: any) => 
            u.name?.toLowerCase().includes('amz') || 
            u.id?.toLowerCase().includes('amz') ||
            u.user_id?.toLowerCase().includes('amz')
          )
          
          if (amzUser) {
            amzOfertasStatus = {
              encontrada: true,
              usuario: amzUser,
              token: amzUser.token ? '✅ Tem token' : '❌ Sem token'
            }
            
            // Verificar status da sessão
            const statusResponse = await fetch(`${CONTABO_URL}/api/${amzUser.id || amzUser.user_id || 'AMZ-Ofertas'}/session/status`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${amzUser.token || CONTABO_TOKEN}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (statusResponse.ok) {
              const sessionStatus = await statusResponse.json()
              amzOfertasStatus.sessao = sessionStatus
            }
          } else {
            amzOfertasStatus.usuarios_encontrados = users.map?.((u: any) => u.name || u.id || u.user_id) || users
          }
        }
      } catch (e: any) {
        amzOfertasStatus.erro = e.message
      }
    }
    
    diagnostico.etapas.push({
      etapa: '3. Instância AMZ-Ofertas',
      ...amzOfertasStatus
    })
    
    // ===== VERIFICAR WEBHOOK CONFIGURADO =====
    const webhookEsperado = `${SUPABASE_URL}/functions/v1/wuzapi-webhook`
    diagnostico.etapas.push({
      etapa: '4. Webhook esperado',
      url: webhookEsperado,
      instrucao: 'Configure este webhook no painel Wuzapi para a instância AMZ-Ofertas'
    })
    
    // ===== WUZAPI LEGACY (se configurado) =====
    let wuzapiLegacyStatus: any = { disponivel: false }
    if (WUZAPI_URL && WUZAPI_TOKEN) {
      try {
        const response = await fetch(`${WUZAPI_URL}/session/status`, {
          method: 'GET',
          headers: {
            'Token': WUZAPI_TOKEN,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const status = await response.json()
          wuzapiLegacyStatus = {
            disponivel: true,
            ...status
          }
        } else {
          const errorText = await response.text()
          wuzapiLegacyStatus = { 
            disponivel: false, 
            erro: `Status ${response.status}: ${errorText}` 
          }
        }
      } catch (e: any) {
        wuzapiLegacyStatus = { disponivel: false, erro: e.message }
      }
    }
    
    diagnostico.etapas.push({
      etapa: '5. Wuzapi Legacy (opcional)',
      ...wuzapiLegacyStatus
    })
    
    diagnostico.status = 'completo'
    diagnostico.resumo = {
      contaboOk: contaboStatus.disponivel,
      amzOfertasEncontrada: amzOfertasStatus.encontrada,
      webhookUrl: webhookEsperado
    }
    
    return new Response(
      JSON.stringify(diagnostico, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
    
  } catch (error: any) {
    diagnostico.status = 'erro'
    diagnostico.erro = error.message
    
    return new Response(
      JSON.stringify(diagnostico, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
