import { AfiliadoLayout } from "@/components/afiliado/AfiliadoLayout";
import GerenciarCampanhasAtivas from "@/components/afiliado/GerenciarCampanhasAtivas";
import ProgramacaoEnvioCard from "@/components/afiliado/ProgramacaoEnvioCard";

export default function AfiliadoCampanhas() {
  return (
    <AfiliadoLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas campanhas ativas e programações de envio</p>
        </div>

        <GerenciarCampanhasAtivas />
        <ProgramacaoEnvioCard />
      </div>
    </AfiliadoLayout>
  );
}
