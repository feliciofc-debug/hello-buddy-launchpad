import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Smartphone, QrCode, ArrowLeft, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ConfiguracoesWhatsApp() {
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)

  const handleGerarQRCode = async () => {
    setLoading(true)
    setQrCode(null)
    
    try {
      toast.loading('Gerando QR Code...', { id: 'qr' })
      
      const { data, error } = await supabase.functions.invoke('generate-qrcode')
      
      console.log('📱 Resposta QR:', data)
      
      if (error) throw error
      
      if (data?.connected) {
        toast.error('⚠️ Já existe uma sessão ativa. Para conectar um novo número, é necessário configurar uma nova instância do Wuzapi no servidor.', { id: 'qr', duration: 8000 })
        return
      }
      
      if (data?.qrcode) {
        const qrString = String(data.qrcode)
        let qrValue = qrString
        if (!qrString.startsWith('data:')) {
          if (qrString.length > 100) {
            qrValue = `data:image/png;base64,${qrString}`
          }
        }
        setQrCode(qrValue)
        toast.success('📱 Escaneie o QR Code!', { id: 'qr' })
      } else if (data?.error) {
        toast.error(`❌ ${data.error}`, { id: 'qr' })
      } else {
        toast.error('❌ Não foi possível gerar QR Code', { id: 'qr' })
      }
      
    } catch (error: any) {
      console.error('Erro:', error)
      toast.error(`❌ Erro: ${error.message}`, { id: 'qr' })
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
            Conectar WhatsApp
          </CardTitle>
          <CardDescription>
            Gere um QR Code para conectar seu número do WhatsApp
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Aviso sobre múltiplas instâncias */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 mb-1">
                  ⚠️ Configuração necessária no servidor
                </p>
                <p className="text-sm text-amber-800">
                  Para cada cliente conectar seu próprio número, é necessário criar uma instância separada do Wuzapi no servidor com seu próprio token.
                </p>
              </div>
            </div>
          </div>

          {/* QR Code */}
          {qrCode && (
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

          {/* Botão */}
          <Button 
            onClick={handleGerarQRCode}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando QR Code...
              </>
            ) : (
              <>
                <QrCode className="mr-2 h-4 w-4" />
                Gerar QR Code
              </>
            )}
          </Button>

          {/* Informações */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-semibold mb-2">ℹ️ Importante:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Use um número dedicado para atendimento</li>
              <li>Mantenha o celular com bateria e internet</li>
              <li>Não desconecte o WhatsApp Web manualmente</li>
              <li>O QR Code expira em alguns minutos</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
