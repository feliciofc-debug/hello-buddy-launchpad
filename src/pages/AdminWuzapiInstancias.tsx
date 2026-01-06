import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, Loader2, Wifi, WifiOff, TestTube, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TokenAfiliado {
  id: string;
  token: string;
  em_uso: boolean;
  cliente_afiliado_id: string | null;
  created_at: string;
  status?: 'checking' | 'online' | 'offline' | 'error';
  jid?: string | null;
  testeEnvio?: 'pending' | 'success' | 'error' | null;
}

interface ClienteAfiliado {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  wuzapi_token: string | null;
  wuzapi_jid: string | null;
  status: string;
}

export default function AdminWuzapiInstancias() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<TokenAfiliado[]>([]);
  const [clientes, setClientes] = useState<ClienteAfiliado[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingAll, setTestingAll] = useState(false);
  const [stats, setStats] = useState({ total: 0, disponiveis: 0, emUso: 0, online: 0, offline: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar tokens
      const { data: tokensData, error: tokensError } = await supabase
        .from('wuzapi_tokens_afiliados')
        .select('*')
        .order('created_at', { ascending: true });

      if (tokensError) throw tokensError;

      // Carregar clientes afiliados
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes_afiliados')
        .select('id, nome, email, telefone, wuzapi_token, wuzapi_jid, status');

      if (clientesError) throw clientesError;

      const tokensWithStatus = (tokensData || []).map(t => ({
        ...t,
        status: undefined as 'checking' | 'online' | 'offline' | 'error' | undefined,
        jid: null as string | null,
        testeEnvio: null as 'pending' | 'success' | 'error' | null
      }));

      setTokens(tokensWithStatus);
      setClientes(clientesData || []);
      
      // Calcular stats
      const total = tokensWithStatus.length;
      const emUso = tokensWithStatus.filter(t => t.em_uso).length;
      const disponiveis = total - emUso;
      
      setStats({ total, disponiveis, emUso, online: 0, offline: 0 });
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const checkTokenStatus = async (token: TokenAfiliado) => {
    // Atualizar status para checking
    setTokens(prev => prev.map(t => 
      t.id === token.id ? { ...t, status: 'checking' } : t
    ));

    try {
      // Usar Edge Function como proxy para evitar CORS
      const { data, error } = await supabase.functions.invoke('verificar-status-wuzapi-afiliado', {
        body: { token: token.token }
      });

      if (error) throw error;

      console.log(`Token ${token.token.substring(0,8)}... status:`, data);

      const isConnected = data.connected === true;
      const jid = data.jid || null;

      setTokens(prev => prev.map(t => 
        t.id === token.id ? { ...t, status: isConnected ? 'online' : 'offline', jid } : t
      ));

      return isConnected;
    } catch (error) {
      console.error(`Erro ao verificar token ${token.token.substring(0,8)}:`, error);
      setTokens(prev => prev.map(t => 
        t.id === token.id ? { ...t, status: 'error' } : t
      ));
      return false;
    }
  };

  const testAllTokens = async () => {
    setTestingAll(true);
    let online = 0;
    let offline = 0;

    for (const token of tokens) {
      const isOnline = await checkTokenStatus(token);
      if (isOnline) online++;
      else offline++;
      
      // Pequeno delay entre verificações
      await new Promise(r => setTimeout(r, 500));
    }

    setStats(prev => ({ ...prev, online, offline }));
    setTestingAll(false);
    toast.success(`Teste concluído: ${online} online, ${offline} offline`);
  };

  const sendTestMessage = async (token: TokenAfiliado) => {
    setTokens(prev => prev.map(t => 
      t.id === token.id ? { ...t, testeEnvio: 'pending' } : t
    ));

    try {
      // Usar Edge Function proxy para enviar teste direto
      const { data, error } = await supabase.functions.invoke('verificar-status-wuzapi-afiliado', {
        body: {
          token: token.token,
          action: 'send_test',
          phone: '5521995379550',
          message: `🧪 Teste de instância - Token: ${token.token.substring(0,8)}... - ${new Date().toLocaleString('pt-BR')}`
        }
      });

      if (error) throw error;

      console.log('Resultado envio:', data);

      const success = data.success === true && data.sent === true;
      
      setTokens(prev => prev.map(t => 
        t.id === token.id ? { ...t, testeEnvio: success ? 'success' : 'error' } : t
      ));

      if (success) {
        toast.success(`Mensagem de teste enviada! Token: ${token.token.substring(0,8)}...`);
      } else {
        toast.error(`Falha no envio: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('Erro ao enviar teste:', error);
      setTokens(prev => prev.map(t => 
        t.id === token.id ? { ...t, testeEnvio: 'error' } : t
      ));
      toast.error('Erro ao enviar mensagem de teste');
    }
  };

  const getClienteInfo = (clienteId: string | null) => {
    if (!clienteId) return null;
    return clientes.find(c => c.id === clienteId);
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'checking': return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'online': return <Wifi className="h-4 w-4 text-green-500" />;
      case 'offline': return <WifiOff className="h-4 w-4 text-gray-400" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <span className="h-4 w-4 text-gray-300">-</span>;
    }
  };

  const getEnvioIcon = (status?: string | null) => {
    switch (status) {
      case 'pending': return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Admin - Instâncias Wuzapi</h1>
              <p className="text-muted-foreground">Gerenciamento das 34 instâncias para afiliados</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={testAllTokens} disabled={testingAll || loading}>
              <TestTube className={`h-4 w-4 mr-2 ${testingAll ? 'animate-pulse' : ''}`} />
              {testingAll ? 'Testando...' : 'Testar Todas'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{stats.disponiveis}</p>
                <p className="text-sm text-muted-foreground">Disponíveis</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{stats.emUso}</p>
                <p className="text-sm text-muted-foreground">Em Uso</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{stats.online}</p>
                <p className="text-sm text-muted-foreground">Online</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-500/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500">{stats.offline}</p>
                <p className="text-sm text-muted-foreground">Offline</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Tokens */}
        <Card>
          <CardHeader>
            <CardTitle>Tokens de Afiliados ({tokens.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead className="text-center">Status API</TableHead>
                    <TableHead className="text-center">Em Uso</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>JID</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token, index) => {
                    const cliente = getClienteInfo(token.cliente_afiliado_id);
                    return (
                      <TableRow key={token.id}>
                        <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {token.token.substring(0, 12)}...
                          </code>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusIcon(token.status)}
                        </TableCell>
                        <TableCell className="text-center">
                          {token.em_uso ? (
                            <Badge variant="default" className="bg-blue-500">Sim</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-500 border-green-500">Livre</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {cliente ? (
                            <div className="text-sm">
                              <p className="font-medium">{cliente.nome}</p>
                              <p className="text-muted-foreground text-xs">{cliente.email}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {token.jid || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => checkTokenStatus(token)}
                              disabled={token.status === 'checking'}
                              title="Verificar Status"
                            >
                              <TestTube className="h-4 w-4" />
                            </Button>
                            {token.status === 'online' && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => sendTestMessage(token)}
                                disabled={token.testeEnvio === 'pending'}
                                title="Enviar Mensagem de Teste"
                              >
                                {token.testeEnvio ? getEnvioIcon(token.testeEnvio) : <Send className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
