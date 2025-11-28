import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function OnboardingWhatsApp() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verificar conexão periodicamente no step 2
  useEffect(() => {
    if (step === 2 && !connected) {
      const interval = setInterval(checkConnection, 3000);
      return () => clearInterval(interval);
    }
  }, [step, connected]);

  const checkConnection = async () => {
    try {
      const { data } = await supabase.functions.invoke("check-connection");
      
      if (data?.connected && data?.loggedIn) {
        setConnected(true);
        toast.success("✅ WhatsApp conectado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
    }
  };

  const generateQR = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase.functions.invoke("get-qr-code", {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (data.success && data.qrCode) {
        setQrCode(data.qrCode);
      } else {
        throw new Error("Falha ao gerar QR Code");
      }
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao gerar QR Code: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    try {
      setSending(true);
      
      const { data, error } = await supabase.functions.invoke("send-wuzapi-message", {
        body: {
          phoneNumber: testPhone,
          message: "🎉 Teste de conexão do AMZ Ofertas!\n\nSeu WhatsApp Business está conectado e funcionando perfeitamente!"
        }
      });

      if (error) throw error;

      setTestSent(true);
      toast.success("✅ Mensagem de teste enviada!");
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao enviar teste: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      await supabase
        .from("user_onboarding")
        .upsert({
          user_id: user.id,
          whatsapp_connected: true,
          onboarding_completed: true,
          completed_at: new Date().toISOString()
        });

      toast.success("🎉 Onboarding concluído!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Erro ao concluir onboarding:", error);
      toast.error("Erro ao concluir onboarding");
    }
  };

  const nextStep = () => {
    if (step === 2 && !connected) {
      toast.error("Aguarde a conexão do WhatsApp");
      return;
    }
    setStep(step + 1);
  };

  useEffect(() => {
    if (step === 2) {
      generateQR();
    }
  }, [step]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="mb-4 text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>
        
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-6">
            <h1 className="text-2xl font-bold mb-2">🚀 Bem-vindo ao AMZ Ofertas!</h1>
          <p className="text-primary-foreground/80">Configure seu WhatsApp Business em 3 minutos</p>
          
          {/* Progress */}
          <div className="flex gap-2 mt-6">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-all ${
                  s <= step ? "bg-primary-foreground" : "bg-primary-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">📱</div>
              <h2 className="text-2xl font-bold">Conecte seu WhatsApp Business</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                O AMZ Ofertas funciona conectado ao WhatsApp Business da sua empresa.
                Vamos configurar isso agora!
              </p>
              
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm font-medium">⚠️ Importante:</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Use um número de WhatsApp Business EXCLUSIVO para o AMZ Ofertas.
                  Não use o mesmo número que você usa pessoalmente.
                </p>
              </div>

              <div className="space-y-2 text-left max-w-md mx-auto bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                <p className="font-medium">✅ O que você precisa:</p>
                <ul className="text-sm space-y-1 ml-4 text-muted-foreground">
                  <li>• Celular com WhatsApp Business instalado</li>
                  <li>• Número de telefone comercial ativo</li>
                  <li>• 2 minutos do seu tempo</li>
                </ul>
              </div>

              <Button onClick={nextStep} size="lg" className="mt-6">
                Continuar →
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center">Escaneie o QR Code</h2>
              
              <div className="grid md:grid-cols-2 gap-8">
                {/* QR Code */}
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border-2 border-primary">
                    {loading || !qrCode ? (
                      <div className="w-64 h-64 flex items-center justify-center mx-auto">
                        <Loader2 className="animate-spin h-12 w-12 text-primary" />
                      </div>
                    ) : (
                      <img src={qrCode} alt="QR Code" className="w-full max-w-xs mx-auto" />
                    )}
                  </div>
                  
                  {connected ? (
                    <div className="text-center text-green-600 dark:text-green-400 font-medium flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      WhatsApp conectado!
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm">
                      ⏳ Aguardando conexão...
                    </div>
                  )}

                  <Button onClick={generateQR} variant="outline" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      "🔄 Gerar novo QR Code"
                    )}
                  </Button>
                </div>

                {/* Instruções */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">📱 Como escanear:</h3>
                  
                  <div className="space-y-3">
                    {[
                      {
                        num: 1,
                        title: "Abra o WhatsApp Business",
                        desc: "No seu celular comercial"
                      },
                      {
                        num: 2,
                        title: "Vá em Configurações",
                        desc: "Toque nos 3 pontinhos (⋮) → Aparelhos conectados"
                      },
                      {
                        num: 3,
                        title: "Conectar um aparelho",
                        desc: 'Toque em "Conectar um aparelho"'
                      },
                      {
                        num: 4,
                        title: "Escaneie o QR Code",
                        desc: "Aponte a câmera para o QR Code ao lado"
                      }
                    ].map((item) => (
                      <div key={item.num} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                          {item.num}
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {connected && (
                <div className="text-center pt-4">
                  <Button onClick={nextStep} size="lg">
                    Continuar →
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold">WhatsApp Conectado!</h2>
                <p className="text-muted-foreground mt-2">
                  Agora vamos fazer um teste de envio
                </p>
              </div>

              <div className="bg-card border rounded-lg p-6 space-y-4">
                <Label>Enviar mensagem de teste para:</Label>
                <Input
                  type="tel"
                  placeholder="Ex: 5521999998888"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                
                <Button 
                  onClick={sendTestMessage}
                  disabled={!testPhone || sending}
                  className="w-full"
                >
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "📤 Enviar Mensagem de Teste"
                  )}
                </Button>
              </div>

              {testSent && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4">
                  <p className="font-medium text-green-800 dark:text-green-400">✅ Mensagem enviada!</p>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                    Verifique seu celular para confirmar o recebimento
                  </p>
                </div>
              )}

              <Button onClick={nextStep} className="w-full" size="lg">
                Continuar →
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold">Tudo pronto!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Seu WhatsApp Business está conectado e funcionando.
                Agora você pode começar a usar o AMZ Ofertas!
              </p>

              <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto mt-8">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                  <div className="text-3xl mb-2">🤖</div>
                  <h3 className="font-semibold">IA Marketing</h3>
                  <p className="text-sm text-muted-foreground">
                    Crie posts e imagens com IA
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
                  <div className="text-3xl mb-2">📱</div>
                  <h3 className="font-semibold">Campanhas</h3>
                  <p className="text-sm text-muted-foreground">
                    Envie para seus contatos
                  </p>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg">
                  <div className="text-3xl mb-2">📊</div>
                  <h3 className="font-semibold">Relatórios</h3>
                  <p className="text-sm text-muted-foreground">
                    Acompanhe resultados
                  </p>
                </div>
              </div>

              <Button onClick={completeOnboarding} size="lg" className="mt-6">
                Ir para o Dashboard 🚀
              </Button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
