import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Smartphone, QrCode, CheckCircle, XCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ConfiguracoesWhatsApp() {
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [phone, setPhone] = useState<string | null>(null)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  useEffect(() => {
    checkStatus()
    
    // Verificar status a cada 5 segundos quando gerando QR
    const interval = setInterval(() => {
      if (qrCode || status === 'connecting') {
        checkStatus()
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [qrCode, status])

  const checkStatus = async () => {
    try {
      console.log('🔍 Verificando status...')
      const { data, error } = await supabase.functions.invoke('check-whatsapp-status')
      
      if (error) {
        console.error('Erro ao verificar status:', error)
        setCheckingStatus(false)
        return
      }
      
      console.log('📱 Status recebido:', data)
      setDebugInfo(data)
      
      if (data?.status === 'connected') {
        setStatus('connected')
        setPhone(data.phone || null)
        setAccountName(data.name || null)
        setQrCode(null)
        if (status !== 'connected') {
          toast.success('✅ WhatsApp conectado!')
        }
      } else if (data?.status === 'error') {
        setStatus('error')
      } else {
        setStatus('disconnected')
      }
      setCheckingStatus(false)
    } catch (error) {
      console.error('Erro ao verificar status:', error)
      setCheckingStatus(false)
    }
  }

  const handleConectar = async () => {
    setLoading(true)
    setQrCode(null)
    setStatus('connecting')
    
    try {
      toast.loading('Gerando QR Code...', { id: 'qr' })
      
      const { data, error } = await supabase.functions.invoke('generate-qrcode')
      
      console.log('📱 Resposta QR:', data)
      setDebugInfo(data)
      
      if (error) throw error
      
      if (data?.connected) {
        setStatus('connected')
        setPhone(data.phone || null)
        toast.success('✅ WhatsApp já está conectado!', { id: 'qr' })
      } else if (data?.qrcode) {
        // Garantir que é string e verificar formato
        const qrString = String(data.qrcode)
        let qrValue = qrString
        if (!qrString.startsWith('data:')) {
          // Se não começa com data:, pode ser base64 puro
          if (qrString.length > 100) {
            qrValue = `data:image/png;base64,${qrString}`
          }
        }
        setQrCode(qrValue)
        toast.success('📱 Escaneie o QR Code!', { id: 'qr' })
      } else if (data?.error) {
        setStatus('error')
        toast.error(`❌ ${data.error}`, { id: 'qr' })
      } else {
        setStatus('error')
        toast.error('❌ Não foi possível gerar QR Code', { id: 'qr' })
      }
      
    } catch (error: any) {
      console.error('Erro:', error)
      setStatus('error')
      toast.error(`❌ Erro: ${error.message}`, { id: 'qr' })
    } finally {
      setLoading(false)
    }
  }

  const handleDesconectar = async () => {
    if (!confirm('Deseja desconectar o WhatsApp atual para conectar outro número?')) return
    
    setLoading(true)
    try {
      toast.loading('Desconectando sessão atual...', { id: 'disconnect' })
      
      const { data, error } = await supabase.functions.invoke('disconnect-whatsapp')
      
      console.log('📱 Resposta desconexão:', data)
      
      if (error) throw error
      
      setStatus('disconnected')
      setPhone(null)
      setAccountName(null)
      setQrCode(null)
      
      toast.success('✅ Desconectado! Clique em "Conectar WhatsApp" para gerar novo QR Code', { id: 'disconnect' })
    } catch (error: any) {
      console.error('Erro ao desconectar:', error)
      toast.error(`❌ Erro: ${error.message}`, { id: 'disconnect' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-green-500" />
            Configurar WhatsApp
          </CardTitle>
          <CardDescription>
            Conecte seu número do WhatsApp para atender clientes automaticamente
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-semibold">Status da Conexão</p>
              {accountName && (
                <p className="text-sm font-medium text-green-600">{accountName}</p>
              )}
              {phone && (
                <p className="text-sm text-muted-foreground">{phone}</p>
              )}
            </div>
            
            {checkingStatus ? (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Verificando...
              </Badge>
            ) : (
              <Badge variant={
                status === 'connected' ? 'default' :
                status === 'connecting' ? 'secondary' :
                status === 'error' ? 'destructive' :
                'outline'
              } className={status === 'connected' ? 'bg-green-500' : ''}>
                {status === 'connected' ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    🟢 Conectado
                  </>
                ) : status === 'connecting' ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    🟡 Conectando...
                  </>
                ) : status === 'error' ? (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    ⚠️ Erro
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    🔴 Desconectado
                  </>
                )}
              </Badge>
            )}
          </div>

          {/* QR Code */}
          {qrCode && (status === 'connecting' || status === 'disconnected') && (
            <div className="space-y-4">
              <div className="p-6 bg-white rounded-lg border-2 border-dashed flex flex-col items-center">
                <QrCode className="h-8 w-8 mb-4 text-muted-foreground" />
                {qrCode.startsWith('data:') ? (
                  <img 
                    src={qrCode}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                ) : (
                  <div className="p-4 bg-gray-100 rounded text-xs font-mono break-all max-w-xs">
                    {qrCode.substring(0, 100)}...
                  </div>
                )}
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold text-blue-900 mb-2">
                  📱 Como conectar:
                </p>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque em <strong>Menu (⋮)</strong> ou <strong>Configurações</strong></li>
                  <li>Toque em <strong>"Aparelhos conectados"</strong></li>
                  <li>Toque em <strong>"Conectar aparelho"</strong></li>
                  <li>Aponte a câmera para este QR Code</li>
                </ol>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2">
            {(status === 'disconnected' || status === 'error') && (
              <Button 
                onClick={handleConectar}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando QR Code...
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Conectar WhatsApp
                  </>
                )}
              </Button>
            )}
            
            {status === 'connecting' && (
              <>
                <Button 
                  onClick={handleConectar}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Novo QR Code
                </Button>
                <Button 
                  onClick={checkStatus}
                  variant="secondary"
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verificar Conexão
                </Button>
              </>
            )}
            
            {status === 'connected' && (
              <>
                <Button 
                  onClick={checkStatus}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar Status
                </Button>
                
                <Button 
                  onClick={handleDesconectar}
                  variant="destructive"
                  className="flex-1"
                >
                  Desconectar
                </Button>
              </>
            )}
          </div>

          {/* Informações */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-semibold mb-2">ℹ️ Importante:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Use um número dedicado para atendimento</li>
              <li>Mantenha o celular com bateria e internet</li>
              <li>Não desconecte o WhatsApp Web manualmente</li>
              <li>Se desconectar, basta gerar novo QR Code</li>
            </ul>
          </div>

          {/* Debug Info */}
          {debugInfo && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">🔧 Debug Info</summary>
              <pre className="mt-2 p-2 bg-gray-900 text-green-400 rounded overflow-auto max-h-40">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
