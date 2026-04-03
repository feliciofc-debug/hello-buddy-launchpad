import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle, Users, Send, Smartphone, BookOpen, Megaphone, Loader2, Settings, CheckCircle2, ExternalLink, Shield } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppConfig {
  id: string;
  phone_number_id: string | null;
  waba_id: string | null;
  access_token: string | null;
  display_phone: string | null;
  business_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  last_verified_at: string | null;
}

export default function WhatsAppPainel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ enviadas: 0, grupos: 0, campanhasAtivas: 0 });
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configForm, setConfigForm] = useState({
    phone_number_id: '',
    waba_id: '',
    access_token: '',
    display_phone: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load stats
      const { count: enviadas } = await supabase
        .from("fila_atendimento_pj" as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "enviado");

      const { count: campanhas } = await supabase
        .from("campanhas_recorrentes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("ativa", true);

      setStats({
        enviadas: enviadas || 0,
        grupos: 0,
        campanhasAtivas: campanhas || 0,
      });

      // Load WhatsApp config
      const { data: config } = await supabase
        .from('whatsapp_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (config) {
        setWhatsappConfig(config as any);
        setConfigForm({
          phone_number_id: (config as any).phone_number_id || '',
          waba_id: (config as any).waba_id || '',
          access_token: (config as any).access_token || '',
          display_phone: (config as any).display_phone || '',
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!configForm.phone_number_id || !configForm.access_token) {
      toast.error('Phone Number ID e Access Token são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('whatsapp-verify-connection', {
        body: {
          user_id: user.id,
          phone_number_id: configForm.phone_number_id.trim(),
          waba_id: configForm.waba_id.trim(),
          access_token: configForm.access_token.trim(),
          display_phone: configForm.display_phone.trim(),
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro na verificação');

      toast.success(`✅ WhatsApp conectado! ${data.business_name || data.verified_name || ''}`);
      setShowConfig(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao verificar conexão');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp Business?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('whatsapp_config' as any)
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .eq('user_id', user.id);

      toast.success('WhatsApp desconectado');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Button onClick={() => navigate("/dashboard")} variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
        <p className="text-muted-foreground">Gerencie campanhas e envios via WhatsApp</p>
      </div>

      {/* Card de Configuração WhatsApp Cloud API */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração do WhatsApp Business (API Oficial)
          </CardTitle>
          <CardDescription>
            Conecte seu WhatsApp Business oficial da Meta. O custo das mensagens é pago diretamente por você no Meta Business Manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {whatsappConfig?.is_active ? (
            // Conectado
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-10 w-10 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{whatsappConfig.business_name || 'WhatsApp Business'}</p>
                  <p className="text-sm text-muted-foreground">{whatsappConfig.display_phone}</p>
                </div>
                <Badge className="bg-green-500 text-white">Conectado</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
                  <Settings className="h-4 w-4 mr-1" /> Reconfigurar
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </div>
            </div>
          ) : showConfig ? (
            // Formulário de configuração
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="font-semibold text-sm mb-2">📋 Como configurar:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>
                    Acesse{' '}
                    <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                      business.facebook.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Vá em Configurações → WhatsApp → Configuração da API</li>
                  <li>Copie o <strong>Phone Number ID</strong> e o <strong>WhatsApp Business Account ID</strong></li>
                  <li>Gere um <strong>token de acesso permanente</strong></li>
                  <li>Cole os dados abaixo</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number ID *</Label>
                  <Input
                    placeholder="Ex: 123456789012345"
                    value={configForm.phone_number_id}
                    onChange={(e) => setConfigForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp Business Account ID</Label>
                  <Input
                    placeholder="Ex: 987654321098765"
                    value={configForm.waba_id}
                    onChange={(e) => setConfigForm(f => ({ ...f, waba_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Access Token (permanente) *</Label>
                  <Input
                    type="password"
                    placeholder="Cole o token de acesso aqui"
                    value={configForm.access_token}
                    onChange={(e) => setConfigForm(f => ({ ...f, access_token: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número do WhatsApp</Label>
                  <Input
                    placeholder="Ex: +55 21 99999-9999"
                    value={configForm.display_phone}
                    onChange={(e) => setConfigForm(f => ({ ...f, display_phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  {saving ? 'Verificando...' : 'Salvar e Verificar Conexão'}
                </Button>
                <Button variant="ghost" onClick={() => setShowConfig(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            // Não conectado
            <div className="text-center py-6 space-y-4">
              <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">WhatsApp Business não conectado</p>
                <p className="text-sm text-muted-foreground">Configure sua API oficial da Meta para enviar mensagens</p>
              </div>
              <Button onClick={() => setShowConfig(true)} className="gap-2">
                <Settings className="h-4 w-4" />
                Configurar WhatsApp Business
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status do agente local */}
      <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <Smartphone className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Agente WhatsApp Local</p>
            <p className="text-sm text-muted-foreground">
              O agente local (.exe) continua disponível como alternativa para envio via IP residencial
            </p>
          </div>
          <Badge variant="secondary">Opcional</Badge>
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.enviadas}</p>
              <p className="text-sm text-muted-foreground">Mensagens enviadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.grupos}</p>
              <p className="text-sm text-muted-foreground">Grupos configurados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.campanhasAtivas}</p>
              <p className="text-sm text-muted-foreground">Campanhas ativas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/pj/listas-contatos")}>
          <CardContent className="p-6 flex items-center gap-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">Listas e Contatos</p>
              <p className="text-sm text-muted-foreground">Gerencie seus contatos e listas de envio</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/campanhas")}>
          <CardContent className="p-6 flex items-center gap-4">
            <Megaphone className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">Campanhas</p>
              <p className="text-sm text-muted-foreground">Crie e gerencie campanhas de envio</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
