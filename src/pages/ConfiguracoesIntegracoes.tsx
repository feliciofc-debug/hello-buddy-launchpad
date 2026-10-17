import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MlIntegrationCard } from "@/components/ml/MlIntegrationCard";

const COMING_SOON = [
  { name: "OLX", description: "Publicação de veículos na OLX." },
  { name: "Webmotors", description: "Integração com estoque Webmotors." },
  { name: "iCarros", description: "Integração com portal iCarros." },
] as const;

export default function ConfiguracoesIntegracoes() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() => navigate("/configuracoes")}
          className="mb-2 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Voltar às configurações</span>
        </button>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrações</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Portais de anúncio e marketplaces conectados à sua revenda.
          </p>
        </div>

        <MlIntegrationCard />

        {COMING_SOON.map((portal) => (
          <Card key={portal.name} className="opacity-80">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">{portal.name}</CardTitle>
                <Badge variant="outline">Em liberação</Badge>
              </div>
              <CardDescription>{portal.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled variant="secondary">
                Em breve
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
