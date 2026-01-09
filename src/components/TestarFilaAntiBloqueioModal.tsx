import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertTriangle,
  Trash2,
  Eye
} from 'lucide-react';

interface TestarFilaAntiBloqueioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FilaItem {
  id: string;
  lead_phone: string;
  lead_name: string | null;
  mensagem_recebida: string;
  resposta_ia: string | null;
  status: string;
  prioridade: number;
  tentativas: number;
  tipo_mensagem: string;
  created_at: string;
  scheduled_at: string;
  sent_at: string | null;
  erro: string | null;
}

export function TestarFilaAntiBloqueioModal({ open, onOpenChange }: TestarFilaAntiBloqueioModalProps) {
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [resposta, setResposta] = useState('Olá! Esta é uma mensagem de TESTE do sistema anti-bloqueio. 🛡️');
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({
    pendentes: 0,
    processando: 0,
    digitando: 0,
    enviados: 0,
    erros: 0
  });

  // Carregar fila
  const carregarFila = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('fila_atendimento_afiliado')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Typecast para evitar problemas de tipagem
      const filaData = (data || []) as unknown as FilaItem[];
      setFila(filaData);

      // Calcular stats
      const newStats = {
        pendentes: filaData.filter((i) => i.status === 'pendente').length,
        processando: filaData.filter((i) => i.status === 'processando').length,
        digitando: filaData.filter((i) => i.status === 'digitando').length,
        enviados: filaData.filter((i) => i.status === 'enviado').length,
        erros: filaData.filter((i) => i.status === 'erro').length
      };
      setStats(newStats);

    } catch (error: any) {
      console.error('Erro ao carregar fila:', error);
    }
  };

  useEffect(() => {
    if (open) {
      carregarFila();
      const interval = setInterval(carregarFila, 3000);
      return () => clearInterval(interval);
    }
  }, [open]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Adicionar item na fila (TESTE)
  const adicionarNaFila = async () => {
    if (!telefone || !resposta) {
      toast.error('Preencha telefone e resposta');
      return;
    }

    setLoading(true);
    addLog(`📥 Adicionando ${telefone} na fila...`);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      // Buscar token do afiliado
      const { data: cliente } = await supabase
        .from('clientes_afiliados')
        .select('wuzapi_token, wuzapi_instance_id')
        .eq('user_id', user.user.id)
        .single();

      const cleanPhone = telefone.replace(/\D/g, '');

      const { data, error } = await supabase
        .from('fila_atendimento_afiliado')
        .insert({
          user_id: user.user.id,
          lead_phone: cleanPhone,
          lead_name: nome || null,
          mensagem_recebida: mensagem || 'TESTE MANUAL',
          resposta_ia: resposta,
          wuzapi_token: cliente?.wuzapi_token || null,
          instance_name: cliente?.wuzapi_instance_id || null,
          tipo_mensagem: 'teste',
          origem: 'modal_teste',
          prioridade: 3,
          status: 'pendente'
        })
        .select()
        .single();

      if (error) throw error;

      addLog(`✅ Adicionado na fila: ${data.id.slice(0, 8)}`);
      toast.success('Adicionado na fila com sucesso!');
      
      // Limpar campos
      setTelefone('');
      setNome('');
      setMensagem('');
      
      carregarFila();

    } catch (error: any) {
      addLog(`❌ Erro: ${error.message}`);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Processar fila (chamar Edge Function)
  const processarFila = async () => {
    setProcessando(true);
    addLog('🔄 Iniciando processamento da fila...');

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('processar-fila-afiliado', {
        body: {
          userId: user.user.id,
          batchSize: 3,
          testMode: true
        }
      });

      if (error) throw error;

      addLog(`✅ Processamento concluído!`);
      addLog(`   📤 Enviados: ${data.processed}`);
      addLog(`   ❌ Erros: ${data.errors}`);
      addLog(`   ⏱️ Duração: ${data.duration_ms}ms`);

      if (data.resultados) {
        data.resultados.forEach((r: any) => {
          if (r.success) {
            addLog(`   ✅ ${r.phone} - ${r.tempoTotal}ms`);
          } else {
            addLog(`   ❌ ${r.phone} - ${r.error}`);
          }
        });
      }

      toast.success(`${data.processed} mensagens processadas`);
      carregarFila();

    } catch (error: any) {
      addLog(`❌ Erro: ${error.message}`);
      toast.error(error.message);
    } finally {
      setProcessando(false);
    }
  };

  // Limpar fila
  const limparFila = async () => {
    if (!confirm('Limpar TODOS os itens da fila?')) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('fila_atendimento_afiliado')
        .delete()
        .eq('user_id', user.user.id);

      if (error) throw error;

      addLog('🗑️ Fila limpa!');
      toast.success('Fila limpa');
      carregarFila();

    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case 'processando':
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processando</Badge>;
      case 'digitando':
        return <Badge variant="default" className="bg-yellow-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Digitando...</Badge>;
      case 'enviado':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Enviado</Badge>;
      case 'erro':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🛡️ Sistema Anti-Bloqueio - TESTE
          </DialogTitle>
          <DialogDescription>
            Sistema separado para testar a fila de mensagens com delays e simulação de digitação
          </DialogDescription>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2">
          <Card className="p-2 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </Card>
          <Card className="p-2 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.processando}</div>
            <div className="text-xs text-muted-foreground">Processando</div>
          </Card>
          <Card className="p-2 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.digitando}</div>
            <div className="text-xs text-muted-foreground">Digitando</div>
          </Card>
          <Card className="p-2 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.enviados}</div>
            <div className="text-xs text-muted-foreground">Enviados</div>
          </Card>
          <Card className="p-2 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.erros}</div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </Card>
        </div>

        <Tabs defaultValue="adicionar" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="adicionar">➕ Adicionar</TabsTrigger>
            <TabsTrigger value="fila">📋 Fila ({fila.length})</TabsTrigger>
            <TabsTrigger value="logs">📜 Logs</TabsTrigger>
          </TabsList>

          {/* Tab Adicionar */}
          <TabsContent value="adicionar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Adicionar Mensagem na Fila</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Telefone *</label>
                    <Input
                      placeholder="11999999999"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Nome (opcional)</label>
                    <Input
                      placeholder="Maria"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Mensagem recebida (simulada)</label>
                  <Input
                    placeholder="Oi, quero saber sobre ofertas"
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Resposta que será enviada *</label>
                  <Textarea
                    placeholder="Digite a resposta que será enviada..."
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={adicionarNaFila} disabled={loading} className="flex-1">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Adicionar na Fila
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex gap-2">
              <Button 
                onClick={processarFila} 
                disabled={processando || stats.pendentes === 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {processando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Processar Fila ({stats.pendentes} pendentes)
              </Button>

              <Button onClick={carregarFila} variant="outline">
                <RefreshCw className="w-4 h-4" />
              </Button>

              <Button onClick={limparFila} variant="destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Info box */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <CardContent className="p-3 text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">⚙️ Configurações Anti-Bloqueio:</p>
                <ul className="text-xs space-y-1 text-blue-600 dark:text-blue-400">
                  <li>• Delay entre mensagens: 3-8 segundos (aleatório)</li>
                  <li>• Tempo "digitando": 1.5-4 segundos (proporcional ao texto)</li>
                  <li>• Rate limit: 20 msgs/min, 150/hora</li>
                  <li>• Tentativas: 3 máximo por mensagem</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Fila */}
          <TabsContent value="fila">
            <ScrollArea className="h-[400px]">
              {fila.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Fila vazia
                </div>
              ) : (
                <div className="space-y-2">
                  {fila.map((item) => (
                    <Card key={item.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(item.status)}
                            <span className="text-sm font-mono">{item.lead_phone}</span>
                            {item.lead_name && (
                              <span className="text-xs text-muted-foreground">({item.lead_name})</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.resposta_ia?.slice(0, 80)}...
                          </p>
                          {item.erro && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {item.erro}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>#{item.prioridade}</div>
                          <div>x{item.tentativas}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Tab Logs */}
          <TabsContent value="logs">
            <ScrollArea className="h-[400px] bg-black rounded-lg p-3">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum log ainda
                </div>
              ) : (
                <div className="font-mono text-xs space-y-1">
                  {logs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`${
                        log.includes('✅') ? 'text-green-400' :
                        log.includes('❌') ? 'text-red-400' :
                        log.includes('⏳') ? 'text-yellow-400' :
                        'text-gray-300'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
