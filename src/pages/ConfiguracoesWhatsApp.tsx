import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import ConectarWhatsAppCloud from '@/components/ConectarWhatsAppCloud'

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

      <div className="space-y-6">
        <ConectarWhatsAppCloud />
      </div>
      <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-semibold mb-2">✓ {t('whatsapp.official_checklist_title')}</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>{t('whatsapp.official_checklist_number')}</li>
          <li>{t('whatsapp.official_checklist_phone')}</li>
          <li>{t('whatsapp.official_checklist_facebook')}</li>
          <li>{t('whatsapp.official_checklist_business')}</li>
          <li>{t('whatsapp.official_checklist_finish')}</li>
          <li>{t('whatsapp.official_checklist_computer')}</li>
        </ul>
      </div>
    </div>
  )
}
