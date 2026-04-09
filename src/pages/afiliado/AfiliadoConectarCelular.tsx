import { useTranslation } from 'react-i18next';
import { AfiliadoLayout } from '@/components/afiliado/AfiliadoLayout';
import AfiliadoWhatsAppConnection from '@/components/AfiliadoWhatsAppConnection';

export default function AfiliadoConectarCelular() {
  const { t } = useTranslation();

  return (
    <AfiliadoLayout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('whatsapp.connect_title')}</h1>
          <p className="text-sm text-muted-foreground">{t('whatsapp.connect_subtitle')}</p>
        </div>

        <AfiliadoWhatsAppConnection />

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
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
            <li>{t('whatsapp.tip_keep_connected')}</li>
            <li>{t('whatsapp.tip_same_number')}</li>
          </ul>
        </div>
      </div>
    </AfiliadoLayout>
  );
}
