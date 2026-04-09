import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import WhatsAppConnection from '@/components/WhatsAppConnection'

export default function ConfiguracoesWhatsApp() {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('whatsapp.back_to_dashboard')}
          </Button>
        </Link>
      </div>

      <WhatsAppConnection />

      <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-semibold mb-2">📱 {t('whatsapp.how_to_connect')}</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>{t('whatsapp.step_1')}</li>
          <li>{t('whatsapp.step_2')}</li>
          <li>{t('whatsapp.step_3')}</li>
          <li>{t('whatsapp.step_4')}</li>
          <li>{t('whatsapp.step_5')}</li>
        </ol>
        
        <p className="font-semibold mt-4 mb-2">ℹ️ {t('whatsapp.important')}</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>{t('whatsapp.tip_dedicated_number')}</li>
          <li>{t('whatsapp.tip_battery')}</li>
          <li>{t('whatsapp.tip_no_disconnect')}</li>
          <li>{t('whatsapp.tip_qr_expiry')}</li>
        </ul>
      </div>
    </div>
  )
}
