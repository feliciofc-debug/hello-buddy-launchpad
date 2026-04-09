import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MessageSquare, Send, User, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AfiliadoLayout } from "@/components/afiliado/AfiliadoLayout";

export default function AfiliadoWhatsApp() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('clientes_afiliados')
        .select('wuzapi_jid')
        .eq('user_id', user.id)
        .single();

      setIsConnected(!!data?.wuzapi_jid);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!telefone || !mensagem) {
      toast.error(t('whatsapp.fill_fields'));
      return;
    }

    setSending(true);
    try {
      const cleanPhone = telefone.replace(/\D/g, '');
      
      const { data, error } = await supabase.functions.invoke('afiliado-enviar-mensagem', {
        body: {
          telefone: cleanPhone,
          mensagem: mensagem
        }
      });

      if (error) throw error;

      toast.success(t('whatsapp.message_sent'));
      setMensagem('');
    } catch (error: any) {
      console.error('Erro ao enviar:', error);
      toast.error(error.message || t('whatsapp.send_error'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <AfiliadoLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AfiliadoLayout>
    );
  }

  return (
    <AfiliadoLayout>
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/afiliado/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('whatsapp.title')}</h1>
            <p className="text-muted-foreground">{t('whatsapp.subtitle')}</p>
          </div>
        </div>

        {!isConnected ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('whatsapp.not_connected_title')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('whatsapp.not_connected_desc')}
              </p>
              <Button onClick={() => navigate('/afiliado/conectar-celular')}>
                {t('whatsapp.connect_btn')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
                {t('whatsapp.send_message')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('whatsapp.phone_label')}</label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-muted rounded-l-md border-r">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input 
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="5511999999999"
                    className="rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('whatsapp.phone_format')}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('whatsapp.message_label')}</label>
                <Textarea 
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder={t('whatsapp.message_placeholder')}
                  rows={5}
                />
              </div>

              <Button 
                onClick={handleSend} 
                disabled={sending}
                className="w-full"
              >
                {sending ? t('whatsapp.sending') : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t('whatsapp.send_message')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </AfiliadoLayout>
  );
}
