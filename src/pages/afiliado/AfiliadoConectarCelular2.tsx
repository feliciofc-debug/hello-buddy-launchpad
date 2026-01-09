import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, Smartphone, QrCode, CheckCircle, XCircle, RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

// Token fixo para a instância Afiliado-01 (21 99537-9550)
const FIXED_TOKEN = 'WjRi4tis2XrGUmLImu3wjwHLN3dn4uE'
const INSTANCE_NAME = 'Afiliado-01'
const PHONE_NUMBER = '21 99537-9550'

export default function AfiliadoConectarCelular2() {
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [phone, setPhone] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [debugStatus, setDebugStatus] = useState<{
    loggedIn?: boolean
    connected?: boolean
    events?: string
    jid?: string | null
  } | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  // Polling quando QR visível
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (qrCode) {
      interval = setInterval(checkStatus, 3000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [qrCode])

  const checkStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verificar-status-wuzapi-afiliado', {
        body: { token: FIXED_TOKEN }
      })

      if (error) throw error

      const rawData = data?.raw?.data ?? null
      const loggedIn = rawData?.loggedIn === true || rawData?.LoggedIn === true
      const isConnected = data?.connected === true || loggedIn === true

      setConnected(isConnected)
      setDebugStatus({
        loggedIn: loggedIn || false,
        connected: rawData?.connected ?? data?.connected ?? false,
        events: typeof rawData?.events === 'string' ? rawData.events : undefined,
        jid: (rawData?.jid ?? data?.jid ?? null) as string | null,
      })

      if (isConnected) {
        const jid = (rawData?.jid ?? data?.jid ?? null) as string | null
        if (jid) {
          const phoneNum = jid.split(':')[0].replace('55', '')
          setPhone(phoneNum)
        }
        setQrCode(null)
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('verificar-status-wuzapi-afiliado', {
        body: { token: FIXED_TOKEN, action: 'generate_qr' }
      })

      if (error) throw error

      // A função pode retornar o QR em formatos diferentes:
      // - data.qrcode (base64 puro)
      // - data.raw.qr.data.QRCode (data URL: "data:image/png;base64,...")
      let qr: string | null = data?.qrcode ?? null

      const maybeDataUrl = data?.raw?.qr?.data?.QRCode
      if (!qr && typeof maybeDataUrl === 'string') {
        qr = maybeDataUrl.startsWith('data:image')
          ? maybeDataUrl.split('base64,')[1] ?? null
          : maybeDataUrl
      }

      if (qr) {
        setQrCode(qr)
        toast.info('Escaneie o QR Code com seu WhatsApp')
      } else {
        toast.error('QR Code não disponível. Tente novamente.')
      }
    } catch (error: any) {
      console.error('Erro:', error)
      toast.error(error.message || 'Erro ao conectar')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setConnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('verificar-status-wuzapi-afiliado', {
        body: { token: FIXED_TOKEN, action: 'disconnect' }
      })

      if (error) throw error

      setConnected(false)
      setPhone(null)
      setQrCode(null)
      toast.success('WhatsApp desconectado')
    } catch (error: any) {
      console.error('Erro:', error)
      toast.error(error.message || 'Erro ao desconectar')
    } finally {
      setConnecting(false)
    }
  }

  const formatPhone = (num: string) => {
    if (!num) return PHONE_NUMBER
    const clean = num.replace(/\D/g, '')
    if (clean.length >= 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
    }
    return num
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <Link to="/afiliado/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                {INSTANCE_NAME} - {PHONE_NUMBER}
              </CardTitle>
              <CardDescription>
                Instância dedicada para o número {PHONE_NUMBER}
              </CardDescription>
            </div>
            <Badge variant={connected ? 'default' : 'secondary'}>
              {connected ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Conectado</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Desconectado</>
              )}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {debugStatus ? (
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span><strong>Status real:</strong> loggedIn={String(debugStatus.loggedIn)} • connected={String(debugStatus.connected)}</span>
                {debugStatus.events ? <span><strong>events:</strong> {debugStatus.events}</span> : <span><strong>events:</strong> (vazio)</span>}
                {debugStatus.jid ? <span><strong>jid:</strong> {debugStatus.jid}</span> : null}
              </div>
            </div>
          ) : null}

          {connected ? (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      WhatsApp Conectado
                    </p>
                    <p className="text-sm text-muted-foreground">
                      +55 {formatPhone(phone || '')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={checkStatus}
                  disabled={connecting}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Status
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnect}
                  disabled={connecting}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            </div>
          ) : qrCode ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  Escaneie o QR Code abaixo com seu WhatsApp
                </p>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <img 
                    src={`data:image/png;base64,${qrCode}`} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  O QR Code expira em ~60 segundos
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Novo QR Code
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setQrCode(null)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Clique abaixo para conectar o WhatsApp do número {PHONE_NUMBER}.
              </p>
              <Button 
                onClick={handleConnect}
                disabled={connecting}
                className="w-full"
              >
                {connecting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
                ) : (
                  <><QrCode className="h-4 w-4 mr-2" /> Conectar WhatsApp</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-semibold mb-2">📱 Como conectar:</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>Clique em "Conectar WhatsApp"</li>
          <li>Abra o WhatsApp no celular {PHONE_NUMBER}</li>
          <li>Vá em <strong>Configurações → Aparelhos conectados</strong></li>
          <li>Toque em <strong>"Conectar aparelho"</strong></li>
          <li>Escaneie o QR Code exibido</li>
        </ol>
      </div>
    </div>
  )
}
