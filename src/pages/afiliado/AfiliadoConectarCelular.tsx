import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smartphone, CheckCircle, XCircle, RefreshCw, QrCode } from "lucide-react";
import { toast } from "sonner";

export default function AfiliadoConectarCelular() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'desconectado' | 'aguardando' | 'conectado'>('desconectado');
  const [cliente, setCliente] = useState<any>(null);

  useEffect(() => {
    loadCliente();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrCode && status === 'aguardando') {
      interval = setInterval(checkStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [qrCode, status]);

  const loadCliente = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('clientes_afiliados')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setCliente(data);
        if (data.wuzapi_jid) {
          setStatus('conectado');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!cliente?.wuzapi_token) return;

    try {
      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
        body: { action: 'status' }
      });

      if (data?.connected) {
        setStatus('conectado');
        setQrCode(null);
        toast.success('WhatsApp conectado!');
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const handleConectar = async () => {
    setConnecting(true);
    try {
      // Se não tem cliente, criar primeiro
      if (!cliente?.wuzapi_token) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
          body: { 
            action: 'criar-instancia',
            nome: user?.email?.split('@')[0] || 'Afiliado',
            email: user?.email,
            telefone: ''
          }
        });

        if (error) throw error;
        
        // Recarregar cliente
        await loadCliente();
      }

      // Solicitar QR Code
      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
        body: { action: 'conectar' }
      });

      if (error) throw error;

      if (data?.qrcode) {
        setQrCode(data.qrcode);
        setStatus('aguardando');
        toast.success('Escaneie o QR Code com seu WhatsApp');
      }
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast.error(error.message || 'Erro ao iniciar conexão');
    } finally {
      setConnecting(false);
    }
  };

  const handleDesconectar = async () => {
    setConnecting(true);
    try {
      const { error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
        body: { action: 'desconectar' }
      });

      if (error) throw error;

      setStatus('desconectado');
      setQrCode(null);
      toast.success('WhatsApp desconectado');
      await loadCliente();
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error(error.message || 'Erro ao desconectar');
    } finally {
      setConnecting(false);
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
            <h1 className="text-2xl font-bold text-foreground">Conectar Celular</h1>
            <p className="text-muted-foreground">Configure seu WhatsApp</p>
          </div>
        </div>

        {/* Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Status da Conexão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {status === 'conectado' ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium text-green-500">Conectado</p>
                    <p className="text-sm text-muted-foreground">
                      {cliente?.wuzapi_jid}
                    </p>
                  </div>
                </>
              ) : status === 'aguardando' ? (
                <>
                  <RefreshCw className="h-8 w-8 text-yellow-500 animate-spin" />
                  <div>
                    <p className="font-medium text-yellow-500">Aguardando conexão</p>
                    <p className="text-sm text-muted-foreground">
                      Escaneie o QR Code abaixo
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="font-medium text-red-500">Desconectado</p>
                    <p className="text-sm text-muted-foreground">
                      Clique em conectar para iniciar
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        {qrCode && status === 'aguardando' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg">
                <img 
                  src={`data:image/png;base64,${qrCode}`} 
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Abra o WhatsApp no seu celular, vá em Configurações → Aparelhos conectados → Conectar um aparelho
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={handleConectar}
                disabled={connecting}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${connecting ? 'animate-spin' : ''}`} />
                Atualizar QR Code
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {status === 'conectado' ? (
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={handleDesconectar}
              disabled={connecting}
            >
              {connecting ? 'Desconectando...' : 'Desconectar WhatsApp'}
            </Button>
          ) : status !== 'aguardando' && (
            <Button 
              className="flex-1"
              onClick={handleConectar}
              disabled={connecting}
            >
              {connecting ? 'Conectando...' : 'Conectar WhatsApp'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
