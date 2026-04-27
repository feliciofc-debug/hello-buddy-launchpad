import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIMEOUT_MS = 8000

async function call(url: string, token: string) {
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    const text = await r.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { /* not json */ }
    return { ok: r.ok, status: r.status, elapsed_ms: Date.now() - start, body: json ?? text.substring(0, 500) }
  } catch (e: any) {
    return { ok: false, status: 0, elapsed_ms: Date.now() - start, error: e.message, error_name: e.name }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const TOKEN = Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN') || ''
  const HOST = 'api2.amzofertas.com.br'
  const PORTS = [8082, 8083]

  const portReports: any[] = []

  for (const port of PORTS) {
    const base = `http://${HOST}:${port}`

    // 1) Listar usuários/sessões via admin
    const users = await call(`${base}/admin/users`, TOKEN)

    // 2) Tentar extrair sessões e tokens
    let sessions: any[] = []
    if (Array.isArray(users.body)) sessions = users.body
    else if (users.body?.data && Array.isArray(users.body.data)) sessions = users.body.data
    else if (users.body?.users && Array.isArray(users.body.users)) sessions = users.body.users

    // 3) Para cada sessão, buscar status/conexão (usa token do user, não admin)
    const sessionDetails: any[] = []
    for (const s of sessions.slice(0, 5)) {
      const userToken = s.token || s.Token || s.apiToken || ''
      const sessionInfo: any = {
        id: s.id || s.ID || s.userid,
        name: s.name || s.Name || s.username,
        token_preview: userToken ? `${userToken.substring(0, 12)}...` : 'N/A',
        jid: s.jid || s.JID || null,
        connected: s.connected ?? s.Connected ?? null,
        loggedIn: s.loggedIn ?? s.LoggedIn ?? null,
        webhook: s.webhook || s.Webhook || null,
        events: s.events || s.Events || null,
        proxy_url: s.proxy_url || s.ProxyURL || null,
        created: s.created || s.Created || null,
      }

      if (userToken) {
        const status = await fetch(`${base}/session/status`, {
          method: 'GET',
          headers: { 'token': userToken, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        }).then(async r => ({ status: r.status, body: await r.text().then(t => { try { return JSON.parse(t) } catch { return t.substring(0, 200) } }) }))
          .catch(e => ({ error: e.message }))
        sessionInfo.status_endpoint = status
      }

      sessionDetails.push(sessionInfo)
    }

    portReports.push({
      port,
      base_url: base,
      admin_users_call: { status: users.status, ok: users.ok, elapsed_ms: users.elapsed_ms, error: (users as any).error },
      total_sessions: sessions.length,
      sessions: sessionDetails,
      raw_first_500: typeof users.body === 'string' ? users.body : JSON.stringify(users.body).substring(0, 500),
    })
  }

  // ANÁLISE: 8082 e 8083 são o mesmo backend?
  const p82 = portReports[0]
  const p83 = portReports[1]
  const ids82 = new Set(p82.sessions.map((s: any) => s.id).filter(Boolean))
  const ids83 = new Set(p83.sessions.map((s: any) => s.id).filter(Boolean))
  const tokens82 = new Set(p82.sessions.map((s: any) => s.token_preview).filter((t: string) => t && t !== 'N/A'))
  const tokens83 = new Set(p83.sessions.map((s: any) => s.token_preview).filter((t: string) => t && t !== 'N/A'))

  const sharedIds = [...ids82].filter(x => ids83.has(x))
  const sharedTokens = [...tokens82].filter(x => tokens83.has(x))

  const analise = {
    same_session_count: p82.total_sessions === p83.total_sessions,
    shared_session_ids: sharedIds,
    shared_tokens: sharedTokens,
    veredito: sharedIds.length > 0 || sharedTokens.length > 0
      ? '🟡 MESMO BACKEND — 8082 e 8083 retornam IDs/tokens idênticos. Provavelmente proxy reverso (nginx) ou montagem do mesmo SQLite. NÃO são instâncias independentes.'
      : p82.total_sessions === 0 && p83.total_sessions === 0
      ? '⚪ Inconclusivo — ambas portas vazias.'
      : '🟢 BACKENDS DISTINTOS — sessões diferentes em cada porta.',
  }

  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    host: HOST,
    token_len: TOKEN.length,
    analise,
    portReports,
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})
