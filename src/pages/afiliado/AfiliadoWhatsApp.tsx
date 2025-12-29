import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MessageSquare, Send, User, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AfiliadoWhatsApp() {
  const navigate = useNavigate();
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
      toast.error('Preencha telefone e mensagem');
      return;
    }

    setSending(true);
    try {
      // Limpar telefone
      const cleanPhone = telefone.replace(/\D/g, '');
      
      const { data, error } = await supabase.functions.invoke('afiliado-enviar-mensagem', {
        body: {
          telefone: cleanPhone,
          mensagem: mensagem
        }
      });

      if (error) throw error;

      toast.success('Mensagem enviada!');
      setMensagem('');
    } catch (error: any) {
      console.error('Erro ao enviar:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/afiliado/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
            <p className="text-muted-foreground">Envie mensagens pelo WhatsApp</p>
          </div>
        </div>

        {!isConnected ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">WhatsApp não conectado</h3>
              <p className="text-muted-foreground mb-4">
                Conecte seu WhatsApp para enviar mensagens
              </p>
              <Button onClick={() => navigate('/afiliado/conectar-celular')}>
                Conectar WhatsApp
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
                Enviar Mensagem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Telefone</label>
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
                  Formato: código do país + DDD + número (ex: 5511999999999)
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Mensagem</label>
                <Textarea 
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={5}
                />
              </div>

              <Button 
                onClick={handleSend} 
                disabled={sending}
                className="w-full"
              >
                {sending ? 'Enviando...' : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Mensagem
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
