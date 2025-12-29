import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, WifiOff, QrCode, RefreshCw, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ClienteAfiliado {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  status: string;
  wuzapi_token: string | null;
  wuzapi_jid: string | null;
  data_conexao_whatsapp: string | null;
}

export default function PainelAfiliado() {
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClienteAfiliado | null>(null);
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [pollingQr, setPollingQr] = useState(false);
  
  // Dados para cadastro inicial
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    loadCliente();
  }, []);

  // Polling para verificar conexão quando QR está ativo
  useEffect(() => {
    if (!pollingQr || !qrCode) return;

    const interval = setInterval(async () => {
      const status = await checkStatus();
      if (status) {
        setPollingQr(false);
        setQrCode(null);
        toast.success("✅ WhatsApp conectado com sucesso!");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingQr, qrCode]);

  const loadCliente = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('clientes_afiliados')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (data) {
        setCliente(data);
        setNome(data.nome);
        setTelefone(data.telefone);
        
        // Verificar status se tem token
        if (data.wuzapi_token) {
          await checkStatus();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
        body: { action: 'status' }
      });

      if (data?.connected) {
        setConnected(true);
        return true;
      } else {
        setConnected(false);
        return false;
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return false;
    }
  };

  const handleCriarInstancia = async () => {
    if (!nome.trim()) {
      toast.error("Digite seu nome");
      return;
    }

    setLoadingAction(true);
    try {
      // Verificar código de afiliado na URL
      const urlParams = new URLSearchParams(window.location.search);
      const afiliadoCodigo = urlParams.get('ref') || urlParams.get('afiliado');

      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
        body: { 
          action: 'criar-instancia',
          nome,
          telefone,
          afiliado_codigo: afiliadoCodigo
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("🎉 Instância criada com sucesso!");
        setCliente(data.cliente);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar instância");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConectar = async () => {
    setLoadingAction(true);
    try {
      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
        body: { action: 'conectar' }
      });

      if (error) throw error;

      if (data.qrCode) {
        setQrCode(data.qrCode);
        setPollingQr(true);
        toast.info("📱 Escaneie o QR Code com seu WhatsApp");
      } else {
        toast.error("Não foi possível obter o QR Code");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDesconectar = async () => {
    setLoadingAction(true);
    try {
      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-afiliado', {
        body: { action: 'desconectar' }
      });

      if (error) throw error;

      setConnected(false);
      setQrCode(null);
      toast.success("Desconectado com sucesso");
      await loadCliente();
    } catch (error: any) {
      toast.error(error.message || "Erro ao desconectar");
    } finally {
      setLoadingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">🚀 Painel do Afiliado</h1>
        <p className="text-muted-foreground">Gerencie sua conexão WhatsApp e acompanhe suas vendas</p>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {connected ? (
              <>
                <Wifi className="h-5 w-5 text-green-500" />
                WhatsApp Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-red-500" />
                WhatsApp Desconectado
              </>
            )}
          </CardTitle>
          <CardDescription>
            {connected 
              ? "Sua instância está ativa e pronta para uso"
              : "Conecte seu WhatsApp para começar a usar"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={connected ? "default" : "destructive"} className="text-sm px-3 py-1">
              {connected ? "🟢 Online" : "🔴 Offline"}
            </Badge>
            {cliente?.wuzapi_jid && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {cliente.wuzapi_jid.split('@')[0]}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cadastro inicial */}
      {!cliente?.wuzapi_token && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Configure sua Instância
            </CardTitle>
            <CardDescription>
              Preencha seus dados para ativar sua instância WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nome">Seu Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="João Silva"
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone (opcional)</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="11999999999"
              />
            </div>
            <Button 
              onClick={handleCriarInstancia} 
              disabled={loadingAction}
              className="w-full"
            >
              {loadingAction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Ativar Minha Instância
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* QR Code / Conexão */}
      {cliente?.wuzapi_token && !connected && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Conectar WhatsApp
            </CardTitle>
            <CardDescription>
              Escaneie o QR Code com seu celular para conectar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrCode ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  <img 
                    src={`data:image/png;base64,${qrCode}`} 
                    alt="QR Code" 
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  📱 Abra o WhatsApp no seu celular → Configurações → Aparelhos conectados → Conectar um aparelho
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleConectar}
                  className="mt-4"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Gerar Novo QR Code
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleConectar} 
                disabled={loadingAction}
                className="w-full"
              >
                {loadingAction ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Gerar QR Code
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ações quando conectado */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Tudo Pronto!
            </CardTitle>
            <CardDescription>
              Sua instância está configurada e funcionando
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                ✅ Seu WhatsApp está conectado e pronto para enviar mensagens!
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => checkStatus()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Verificar Status
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDesconectar}
                disabled={loadingAction}
              >
                {loadingAction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <WifiOff className="mr-2 h-4 w-4" />
                )}
                Desconectar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info do cliente */}
      {cliente && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>📋 Seus Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nome:</span>
                <p className="font-medium">{cliente.nome}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{cliente.email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={cliente.status === 'ativo' ? 'default' : 'secondary'}>
                  {cliente.status}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Conectado desde:</span>
                <p className="font-medium">
                  {cliente.data_conexao_whatsapp 
                    ? new Date(cliente.data_conexao_whatsapp).toLocaleDateString('pt-BR')
                    : 'Não conectado'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
