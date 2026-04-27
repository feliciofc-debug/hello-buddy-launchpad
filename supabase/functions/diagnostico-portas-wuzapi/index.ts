import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const TOKEN = Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN') || ''
  const HOST = 'api2.amzofertas.com.br'
  const PORTS = [8082, 8083, 8084, 8085, 8086]
  const TIMEOUT_MS = 8000

  const results: any[] = []

  for (const port of PORTS) {
    const url = `http://${HOST}:${port}/admin/users`
    const start = Date.now()
    const result: any = { port, url }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': TOKEN,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const elapsed = Date.now() - start
      const text = await response.text()

      result.status = response.status
      result.ok = response.ok
      result.elapsed_ms = elapsed
      result.response_preview = text.substring(0, 300)
      result.diagnostic = response.ok
        ? '✅ WuzAPI rodando e autenticado'
        : response.status === 401 || response.status === 403
        ? '⚠️ WuzAPI rodando mas token inválido/sem permissão'
        : response.status === 404
        ? '⚠️ Servidor responde mas endpoint /admin/users não existe (pode não ser WuzAPI ou versão diferente)'
        : `⚠️ Servidor responde com HTTP ${response.status}`
    } catch (e: any) {
      const elapsed = Date.now() - start
      result.elapsed_ms = elapsed
      result.error = e.message
      result.error_name = e.name

      if (e.name === 'AbortError') {
        result.diagnostic = '❌ TIMEOUT (>8s) — porta provavelmente filtrada por firewall'
      } else if (e.message.includes('refused') || e.message.includes('ECONNREFUSED')) {
        result.diagnostic = '❌ CONNECTION REFUSED — porta livre, nenhum processo escutando'
      } else if (e.message.includes('reset') || e.message.includes('ECONNRESET')) {
        result.diagnostic = '❌ CONNECTION RESET — processo derrubou conexão'
      } else if (e.message.includes('dns') || e.message.includes('ENOTFOUND')) {
        result.diagnostic = '❌ DNS não resolveu host'
      } else {
        result.diagnostic = `❌ Erro de rede: ${e.message}`
      }
    }

    results.push(result)
  }

  const summary = {
    timestamp: new Date().toISOString(),
    host: HOST,
    token_configurado: TOKEN ? `✅ Sim (${TOKEN.length} chars)` : '❌ Não',
    portas_testadas: PORTS,
    resumo: results.map(r => ({
      porta: r.port,
      status: r.status || 'N/A',
      diagnostico: r.diagnostic,
      tempo_ms: r.elapsed_ms,
    })),
    detalhes: results,
  }

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})
