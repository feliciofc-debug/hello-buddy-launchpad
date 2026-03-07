import { AfiliadoLayout } from '@/components/afiliado/AfiliadoLayout';
import AfiliadoWhatsAppConnection from '@/components/AfiliadoWhatsAppConnection';

export default function AfiliadoConectarCelular() {
  return (
    <AfiliadoLayout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conectar WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Conecte seu celular para enviar mensagens</p>
        </div>

        <AfiliadoWhatsAppConnection />

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
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
            <li>Mantenha o celular conectado à internet</li>
            <li>Use o mesmo número do WhatsApp cadastrado</li>
          </ul>
        </div>
      </div>
    </AfiliadoLayout>
  );
}
