import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Settings, Trash2 } from "lucide-react";

const DataDeletion = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o início
        </Button>

        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8 text-foreground">
            Exclusão de Dados do Usuário
          </h1>

          <div className="bg-card rounded-lg shadow-lg p-8 space-y-6">
            <p className="text-muted-foreground text-lg text-center">
              Para solicitar a exclusão dos seus dados da plataforma AMZ Ofertas, siga os passos abaixo:
            </p>

            <div className="space-y-4 mt-8">
              <div className="border-l-4 border-primary pl-4 py-2">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Opção 1: Pela Plataforma
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-7">
                  <li>Acesse sua conta em amzofertas.com.br</li>
                  <li>Vá em Configurações → Minha Conta</li>
                  <li>Clique em "Excluir Conta e Dados"</li>
                  <li>Confirme a exclusão</li>
                </ol>
              </div>

              <div className="border-l-4 border-secondary pl-4 py-2">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-secondary" />
                  Opção 2: Por Email
                </h3>
                <p className="text-muted-foreground ml-7">
                  Ou envie um email para:{" "}
                  <a 
                    href="mailto:suporte@amzofertas.com.br?subject=Solicitação de Exclusão de Dados"
                    className="text-primary hover:underline font-semibold"
                  >
                    suporte@amzofertas.com.br
                  </a>
                </p>
                <p className="text-muted-foreground ml-7 mt-2">
                  Com o assunto: <span className="font-semibold">"Solicitação de Exclusão de Dados"</span>
                </p>
                <p className="text-muted-foreground ml-7 mt-2">Incluindo:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-11">
                  <li>Seu email cadastrado</li>
                  <li>Nome completo</li>
                  <li>Motivo da solicitação (opcional)</li>
                </ul>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 mt-8 flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
              <p className="text-foreground">
                Processaremos sua solicitação em até <span className="font-bold">30 dias</span>.
              </p>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-muted-foreground">
                Para mais informações, consulte nossa{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Política de Privacidade
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataDeletion;
