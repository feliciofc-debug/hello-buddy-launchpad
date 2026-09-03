import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Bug, Award, Mail, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Security() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reporter_name: "",
    reporter_email: "",
    vulnerability_type: "",
    description: "",
    steps_to_reproduce: "",
    severity: "",
    disclosed_publicly: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.reporter_email || !formData.vulnerability_type || !formData.description || !formData.severity) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.disclosed_publicly) {
      toast({
        title: "Confirmação necessária",
        description: "Por favor, confirme que não divulgará publicamente até a correção.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("security_reports")
        .insert([{
          reporter_name: formData.reporter_name || null,
          reporter_email: formData.reporter_email,
          vulnerability_type: formData.vulnerability_type,
          description: formData.description,
          steps_to_reproduce: formData.steps_to_reproduce || null,
          severity: formData.severity,
        }]);

      if (error) throw error;

      toast({
        title: "✅ Relatório enviado com sucesso!",
        description: "Nossa equipe irá analisar e responder em até 48 horas.",
      });

      // Reset form
      setFormData({
        reporter_name: "",
        reporter_email: "",
        vulnerability_type: "",
        description: "",
        steps_to_reproduce: "",
        severity: "",
        disclosed_publicly: false,
      });
    } catch (error) {
      console.error("Erro ao enviar relatório:", error);
      toast({
        title: "Erro ao enviar relatório",
        description: "Tente novamente ou entre em contato: amzofertas@amzofertas.com.br",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">
              Segurança e Divulgação Responsável
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A segurança dos dados de nossos usuários é nossa prioridade. 
            Agradecemos a comunidade de segurança por nos ajudar a manter 
            o AMZ Ofertas seguro.
          </p>
        </div>

        {/* Form Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Reportar uma Vulnerabilidade
            </CardTitle>
            <CardDescription>
              Preencha o formulário abaixo para reportar uma vulnerabilidade de segurança
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Seu nome (opcional)
                </label>
                <Input
                  value={formData.reporter_name}
                  onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                  placeholder="João Silva"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Seu email <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  required
                  value={formData.reporter_email}
                  onChange={(e) => setFormData({ ...formData, reporter_email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Tipo de vulnerabilidade <span className="text-destructive">*</span>
                </label>
                <Select
                  required
                  value={formData.vulnerability_type}
                  onValueChange={(value) => setFormData({ ...formData, vulnerability_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XSS">XSS (Cross-Site Scripting)</SelectItem>
                    <SelectItem value="SQL Injection">SQL Injection</SelectItem>
                    <SelectItem value="Autenticação">Problema de Autenticação</SelectItem>
                    <SelectItem value="CSRF">CSRF (Cross-Site Request Forgery)</SelectItem>
                    <SelectItem value="Exposição de Dados">Exposição de Dados Sensíveis</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Descrição detalhada <span className="text-destructive">*</span>
                </label>
                <Textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva a vulnerabilidade encontrada..."
                  className="min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Steps to reproduce (passo a passo)
                </label>
                <Textarea
                  value={formData.steps_to_reproduce}
                  onChange={(e) => setFormData({ ...formData, steps_to_reproduce: e.target.value })}
                  placeholder="1. Acesse a página...&#10;2. Clique em...&#10;3. Observe que..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Severidade <span className="text-destructive">*</span>
                </label>
                <Select
                  required
                  value={formData.severity}
                  onValueChange={(value) => setFormData({ ...formData, severity: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a severidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Crítica">🔴 Crítica</SelectItem>
                    <SelectItem value="Alta">🟠 Alta</SelectItem>
                    <SelectItem value="Média">🟡 Média</SelectItem>
                    <SelectItem value="Baixa">🟢 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2 p-4 border rounded-lg bg-muted/50">
                <Checkbox
                  id="terms"
                  checked={formData.disclosed_publicly}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, disclosed_publicly: checked as boolean })
                  }
                />
                <label
                  htmlFor="terms"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Concordo em não divulgar publicamente esta vulnerabilidade até que seja corrigida
                </label>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Relatório de Segurança"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Commitment Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Nosso Compromisso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-sm">✓</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Resposta Rápida</h4>
                <p className="text-sm text-muted-foreground">
                  Resposta inicial em até 48 horas
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-sm">✓</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Atualizações Regulares</h4>
                <p className="text-sm text-muted-foreground">
                  Manteremos você informado sobre o progresso da correção
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-sm">✓</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Crédito Público</h4>
                <p className="text-sm text-muted-foreground">
                  Oferecemos reconhecimento público (se desejar) após a correção
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-sm">✓</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Sem Retaliação</h4>
                <p className="text-sm text-muted-foreground">
                  Não tomaremos ações legais contra pesquisadores éticos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What NOT to Report */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>O que NÃO reportar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-destructive mt-0.5">•</span>
              <p className="text-sm">Phishing ou spam sem impacto técnico real</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-destructive mt-0.5">•</span>
              <p className="text-sm">Vulnerabilidades em serviços de terceiros que utilizamos</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-destructive mt-0.5">•</span>
              <p className="text-sm">Issues que já foram reportados ou são públicos</p>
            </div>
          </CardContent>
        </Card>

        {/* Hall of Fame */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Hall da Fama
            </CardTitle>
            <CardDescription>
              Agradecemos aos pesquisadores de segurança que nos ajudaram
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Seja o primeiro a contribuir para a segurança do AMZ Ofertas!
            </p>
          </CardContent>
        </Card>

        {/* Alternative Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contato Alternativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Se preferir, você pode nos contatar diretamente por email:
              </p>
              <a 
                href="mailto:amzofertas@amzofertas.com.br?subject=Relatório de Segurança"
                className="text-primary hover:underline font-semibold"
              >
                amzofertas@amzofertas.com.br
              </a>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                Para maior segurança, considere criptografar sua mensagem usando nossa chave PGP (em breve).
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 AMZ Ofertas. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
