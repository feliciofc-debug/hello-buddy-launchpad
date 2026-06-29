import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle, Users, Send, Smartphone, BookOpen, Megaphone, Loader2, Settings, CheckCircle2, ExternalLink, Shield, Bot, Inbox, PlugZap, Sparkles } from "lucide-react";
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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ enviadas: 0, grupos: 0, campanhasAtivas: 0, conversasAtivas: 0 });
  const [agentActive, setAgentActive] = useState<boolean | null>(null);
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

      const { count: conversasAtivas } = await supabase
        .from("whatsapp_cloud_conversations" as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { data: agentCfg } = await supabase
        .from("whatsapp_cloud_agent_config" as any)
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      setAgentActive(((agentCfg as any)?.is_active ?? null));

      setStats({
        enviadas: enviadas || 0,
        grupos: 0,
        campanhasAtivas: campanhas || 0,
        conversasAtivas: conversasAtivas || 0,
      });

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
      toast.error(t('whatsapp.required_fields'));
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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
      if (!data?.success) throw new Error(data?.error || 'Verification error');

      toast.success(`✅ ${t('whatsapp.connected_success')} ${data.business_name || data.verified_name || ''}`);
      setShowConfig(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error verifying connection');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t('whatsapp.disconnect_confirm'))) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('whatsapp_config' as any)
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .eq('user_id', user.id);

      toast.success(t('whatsapp.disconnected'));
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
          <ArrowLeft className="h-4 w-4 mr-2" /> {t('whatsapp.back')}
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{t('whatsapp.title')}</h1>
        <p className="text-muted-foreground">{t('whatsapp.painel_subtitle')}</p>
      </div>

      {/* WhatsApp Cloud API Config Card */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('whatsapp.config_title')}
          </CardTitle>
          <CardDescription>
            {t('whatsapp.config_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {whatsappConfig?.is_active ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-10 w-10 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{whatsappConfig.business_name || 'WhatsApp Business'}</p>
                  <p className="text-sm text-muted-foreground">{whatsappConfig.display_phone}</p>
                </div>
                <Badge className="bg-green-500 text-white">{t('whatsapp.connected_badge')}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
                  <Settings className="h-4 w-4 mr-1" /> {t('whatsapp.reconfigure')}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                  {t('whatsapp.disconnect')}
                </Button>
              </div>
            </div>
          ) : showConfig ? (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="font-semibold text-sm mb-2">📋 {t('whatsapp.how_to_config')}</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>
                    {t('whatsapp.config_step_1')}{' '}
                    <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                      business.facebook.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>{t('whatsapp.config_step_2')}</li>
                  <li>{t('whatsapp.config_step_3')}</li>
                  <li>{t('whatsapp.config_step_4')}</li>
                  <li>{t('whatsapp.config_step_5')}</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('whatsapp.phone_number_id')} *</Label>
                  <Input
                    placeholder="Ex: 123456789012345"
                    value={configForm.phone_number_id}
                    onChange={(e) => setConfigForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('whatsapp.waba_id')}</Label>
                  <Input
                    placeholder="Ex: 987654321098765"
                    value={configForm.waba_id}
                    onChange={(e) => setConfigForm(f => ({ ...f, waba_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('whatsapp.access_token')} *</Label>
                  <Input
                    type="password"
                    placeholder={t('whatsapp.paste_token')}
                    value={configForm.access_token}
                    onChange={(e) => setConfigForm(f => ({ ...f, access_token: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('whatsapp.whatsapp_number')}</Label>
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
                  {saving ? t('whatsapp.verifying') : t('whatsapp.save_verify')}
                </Button>
                <Button variant="ghost" onClick={() => setShowConfig(false)}>{t('whatsapp.cancel')}</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">{t('whatsapp.not_connected_business')}</p>
                <p className="text-sm text-muted-foreground">{t('whatsapp.config_meta_desc')}</p>
              </div>
              <Button onClick={() => setShowConfig(true)} className="gap-2">
                <Settings className="h-4 w-4" />
                {t('whatsapp.config_business_btn')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Local agent status */}
      <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <Smartphone className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">{t('whatsapp.local_agent_title')}</p>
            <p className="text-sm text-muted-foreground">
              {t('whatsapp.local_agent_desc')}
            </p>
          </div>
          <Badge variant="secondary">{t('whatsapp.optional')}</Badge>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.enviadas}</p>
              <p className="text-sm text-muted-foreground">{t('whatsapp.messages_sent')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.grupos}</p>
              <p className="text-sm text-muted-foreground">{t('whatsapp.groups_configured')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.campanhasAtivas}</p>
              <p className="text-sm text-muted-foreground">{t('whatsapp.active_campaigns')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/pj/listas-contatos")}>
          <CardContent className="p-6 flex items-center gap-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">{t('whatsapp.lists_contacts')}</p>
              <p className="text-sm text-muted-foreground">{t('whatsapp.lists_contacts_desc')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/campanhas")}>
          <CardContent className="p-6 flex items-center gap-4">
            <Megaphone className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">{t('whatsapp.campaigns')}</p>
              <p className="text-sm text-muted-foreground">{t('whatsapp.campaigns_desc')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
