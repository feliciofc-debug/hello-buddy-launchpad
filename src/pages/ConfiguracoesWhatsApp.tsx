import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import WhatsAppConnection from '@/components/WhatsAppConnection'

export default function ConfiguracoesWhatsApp() {
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      {/* Componente de conexão multi-instância */}
      <WhatsAppConnection />

      {/* Instruções */}
      <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-semibold mb-2">📱 Como conectar:</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>Clique em "Conectar WhatsApp"</li>
          <li>Abra o WhatsApp no seu celular</li>
          <li>Vá em <strong>Configurações → Aparelhos conectados</strong></li>
          <li>Toque em <strong>"Conectar aparelho"</strong></li>
          <li>Escaneie o QR Code exibido</li>
        </ol>
        
        <p className="font-semibold mt-4 mb-2">ℹ️ Importante:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Use um número dedicado para atendimento</li>
          <li>Mantenha o celular com bateria e internet</li>
          <li>Não desconecte o WhatsApp Web manualmente</li>
          <li>O QR Code expira em ~60 segundos</li>
        </ul>
      </div>
    </div>
  )
}
