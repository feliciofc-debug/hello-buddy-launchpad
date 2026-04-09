import { AfiliadoLayout } from "@/components/afiliado/AfiliadoLayout";
import GerenciarCampanhasAtivas from "@/components/afiliado/GerenciarCampanhasAtivas";
import ProgramacaoEnvioCard from "@/components/afiliado/ProgramacaoEnvioCard";
import { useTranslation } from 'react-i18next';

export default function AfiliadoCampanhas() {
  const { t } = useTranslation();
  return (
    <AfiliadoLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('affiliate.campaigns_title')}</h1>
          <p className="text-sm text-muted-foreground">{t('affiliate.campaigns_subtitle')}</p>
        </div>

        <GerenciarCampanhasAtivas />
        <ProgramacaoEnvioCard />
      </div>
    </AfiliadoLayout>
  );
}
