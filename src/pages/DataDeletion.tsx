import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, AlertTriangle, Trash2, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DataDeletion = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("deletion_requests")
        .insert({
          email: email.trim().toLowerCase(),
          reason: reason.trim() || null,
          status: "pending",
        });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Solicitação enviada!",
        description: "Seus dados serão excluídos em até 48 horas. Você receberá um email de confirmação.",
      });

      setEmail("");
      setReason("");
    } catch (error: any) {
      console.error("Erro ao enviar solicitação:", error);
      toast({
        title: "Erro ao processar solicitação",
        description: "Tente novamente ou entre em contato: contato@atombrasildigital.com",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o início
        </Button>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full mb-4">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-4xl font-bold mb-3 text-foreground">
              Exclusão de Dados
            </h1>
            <p className="text-muted-foreground text-lg">
              Conforme LGPD e GDPR, você tem o direito de solicitar a exclusão completa de seus dados
            </p>
          </div>

          <div className="bg-card rounded-lg shadow-lg p-8 space-y-6">
            {/* Aviso de Irreversibilidade */}
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-yellow-800 dark:text-yellow-400 mb-2">
                    ⚠️ Esta ação é irreversível
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                    Ao solicitar a exclusão, você perderá permanentemente:
                  </p>
                  <ul className="list-disc ml-5 text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    <li>Sua conta e dados de perfil</li>
                    <li>Catálogo de produtos e imagens</li>
                    <li>Posts criados e agendados</li>
                    <li>Conexões com Facebook, Instagram, TikTok e outras redes</li>
                    <li>Histórico de uso e configurações</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Formulário */}
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-semibold">
                    Email cadastrado na plataforma *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12"
                  />
                  <p className="text-sm text-muted-foreground">
                    Insira o email que você usa para acessar o AMZ Ofertas
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-base font-semibold">
                    Motivo da exclusão (opcional)
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder="Ex: Não uso mais o serviço, preocupações com privacidade..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                  <p className="text-sm text-muted-foreground">
                    Ajude-nos a melhorar compartilhando o motivo (opcional)
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-12 text-base bg-destructive hover:bg-destructive/90"
                >
                  {loading ? (
                    "Processando..."
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-5 w-5" />
                      Solicitar Exclusão de Dados
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 p-6 rounded">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-green-800 dark:text-green-400 mb-2 text-lg">
                      ✅ Solicitação Enviada com Sucesso!
                    </h3>
                    <p className="text-green-700 dark:text-green-300 mb-3">
                      Seus dados serão permanentemente excluídos em até <strong>48 horas</strong>.
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Você receberá um email de confirmação quando o processo for concluído.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Seção Informativa */}
            <div className="border-t pt-6 space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  O que será excluído:
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                  <li>✓ Informações de perfil (nome, email, telefone)</li>
                  <li>✓ IDs de afiliados (Amazon, Shopee, Lomadee, etc.)</li>
                  <li>✓ Tokens de acesso às redes sociais (Meta, LinkedIn, TikTok)</li>
                  <li>✓ Catálogo completo de produtos e imagens</li>
                  <li>✓ Posts criados, agendados e histórico</li>
                  <li>✓ Campanhas e configurações</li>
                  <li>✓ Dados de clientes cadastrados</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3">⏱️ Prazo de Exclusão:</h3>
                <p className="text-sm text-muted-foreground ml-7">
                  Seus dados serão permanentemente excluídos em até <strong className="text-foreground">48 horas</strong> após esta solicitação. 
                  Você receberá um email quando o processo for concluído.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-3">📞 Precisa de Ajuda?</h3>
                <p className="text-sm text-muted-foreground ml-7">
                  Entre em contato: {" "}
                  <a 
                    href="mailto:contato@atombrasildigital.com?subject=Dúvida sobre Exclusão de Dados"
                    className="text-primary hover:underline font-semibold"
                  >
                    contato@atombrasildigital.com
                  </a>
                </p>
              </div>

              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">
                  Para mais informações, consulte nossa{" "}
                  <a href="/privacy" className="text-primary hover:underline font-semibold">
                    Política de Privacidade
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataDeletion;
