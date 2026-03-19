import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Wifi, WifiOff, Send, RefreshCw, Clock, CheckCircle, AlertCircle, Loader2,
  ArrowLeft, Smartphone
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

// ─── Types ──────────────────────────────────────────
interface GatewayStatus {
  status: string;
  last_heartbeat: string;
  phone_number?: string;
  gateway_version?: string;
  ip_type?: string;
}

interface FilaItem {
  id: string;
  lead_name: string | null;
  lead_phone: string;
  mensagem: string | null;
  status: string;
  tentativas: number;
  sent_at: string | null;
  erro: string | null;
  created_at: string;
}

interface Contadores {
  pendentes: number;
  processando: number;
  enviados: number;
  erros: number;
}

// ─── Component ──────────────────────────────────────
export default function GatewayWhatsApp() {
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [contadores, setContadores] = useState<Contadores>({ pendentes: 0, processando: 0, enviados: 0, erros: 0 });
  const [historico, setHistorico] = useState<FilaItem[]>([]);
  const [filtro, setFiltro] = useState<string>('todos');
  const [telefoneTeste, setTelefoneTeste] = useState('');
  const [mensagemTeste, setMensagemTeste] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [testeItemId, setTesteItemId] = useState<string | null>(null);
  const [testeStatus, setTesteStatus] = useState<string | null>(null);

  // ─── Gateway Status ─────────────────────────────
  const carregarGateway = useCallback(async () => {
    const { data } = await supabase
      .from('gateway_status')
      .select('*')
      .order('last_heartbeat', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setGateway(data as GatewayStatus);
  }, []);

  const isOnline = gateway?.status === 'online' &&
    gateway?.last_heartbeat &&
    (Date.now() - new Date(gateway.last_heartbeat).getTime()) < 60000;

  // ─── Contadores ─────────────────────────────────
  const carregarContadores = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const base = supabase.from('fila_atendimento_pj').select('id', { count: 'exact', head: true }).eq('user_id', user.id);

    const [p, pr, e, er] = await Promise.all([
      supabase.from('fila_atendimento_pj').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pendente'),
      supabase.from('fila_atendimento_pj').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'processando'),
      supabase.from('fila_atendimento_pj').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'enviado'),
      supabase.from('fila_atendimento_pj').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'erro'),
    ]);

    setContadores({
      pendentes: p.count ?? 0,
      processando: pr.count ?? 0,
      enviados: e.count ?? 0,
      erros: er.count ?? 0,
    });
  }, []);

  // ─── Histórico ──────────────────────────────────
  const carregarHistorico = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('fila_atendimento_pj')
      .select('id, lead_name, lead_phone, mensagem, status, tentativas, sent_at, erro, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filtro !== 'todos') {
      query = query.eq('status', filtro);
    }

    const { data } = await query;
    setHistorico((data as FilaItem[]) ?? []);
  }, [filtro]);

  // ─── Envio de Teste ─────────────────────────────
  const enviarTeste = async () => {
    if (!telefoneTeste || !mensagemTeste) {
      toast.error('Preencha telefone e mensagem');
      return;
    }

    setEnviandoTeste(true);
    setTesteStatus('pendente');
    setTesteItemId(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Faça login primeiro'); return; }

      const { data, error } = await supabase
        .from('fila_atendimento_pj')
        .insert({
          user_id: user.id,
          lead_phone: telefoneTeste.replace(/\D/g, ''),
          lead_name: 'Teste Manual',
          mensagem: mensagemTeste,
          status: 'pendente',
          tipo_mensagem: 'texto',
          prioridade: 1,
        })
        .select('id')
        .single();

      if (error) throw error;
      
      setTesteItemId(data.id);
      toast.success('Mensagem inserida na fila! O dispatcher irá enviar.');
      carregarContadores();
      carregarHistorico();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
      setTesteStatus(null);
    } finally {
      setEnviandoTeste(false);
    }
  };

  // Track test item status in real-time
  useEffect(() => {
    if (!testeItemId) return;
    const channel = supabase
      .channel(`teste-${testeItemId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'fila_atendimento_pj',
        filter: `id=eq.${testeItemId}`,
      }, (payload: any) => {
        const newStatus = payload.new?.status;
        setTesteStatus(newStatus);
        if (newStatus === 'enviado') toast.success('✅ Mensagem enviada com sucesso!');
        if (newStatus === 'erro') toast.error('❌ Erro no envio: ' + (payload.new?.erro || ''));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [testeItemId]);

  // ─── Realtime & Polling ─────────────────────────
  useEffect(() => {
    carregarGateway();
    carregarContadores();
    carregarHistorico();

    const interval = setInterval(() => {
      carregarGateway();
      carregarContadores();
    }, 10000);

    // Realtime for fila updates
    const channel = supabase
      .channel('fila-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_atendimento_pj' }, () => {
        carregarContadores();
        carregarHistorico();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gateway_status' }, () => {
        carregarGateway();
      })
      .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [carregarGateway, carregarContadores, carregarHistorico]);

  // Reload historico when filter changes
  useEffect(() => { carregarHistorico(); }, [filtro, carregarHistorico]);

  const heartbeatAgo = gateway?.last_heartbeat
    ? Math.round((Date.now() - new Date(gateway.last_heartbeat).getTime()) / 1000)
    : null;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">🟡 Pendente</Badge>;
      case 'processando': return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">🔵 Processando</Badge>;
      case 'enviado': return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">🟢 Enviado</Badge>;
      case 'erro': return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">🔴 Erro</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-6 h-6" /> Gateway WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">Monitoramento do Gateway Baileys local</p>
        </div>
      </div>

      {/* SEÇÃO A — Status do Gateway */}
      <Card className={`border-2 ${isOnline ? 'border-green-500/50' : 'border-red-500/50'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${isOnline ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                {isOnline
                  ? <Wifi className="w-8 h-8 text-green-500" />
                  : <WifiOff className="w-8 h-8 text-red-500" />}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {isOnline ? '✅ Gateway Online' : '❌ Gateway Offline'}
                </h2>
                {isOnline && heartbeatAgo !== null && (
                  <p className="text-sm text-muted-foreground">
                    Último heartbeat: há {heartbeatAgo}s
                    {gateway?.phone_number && ` • Número: ${gateway.phone_number}`}
                    {gateway?.ip_type && ` • IP: ${gateway.ip_type}`}
                  </p>
                )}
                {!isOnline && (
                  <p className="text-sm text-red-600">
                    Inicie o <strong>amz-gateway.exe</strong> no computador
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={carregarGateway}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEÇÃO B — Envio de Teste */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" /> Envio de Teste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Telefone</label>
              <Input
                placeholder="5521999999999"
                value={telefoneTeste}
                onChange={e => setTelefoneTeste(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea
                placeholder="Teste de envio..."
                value={mensagemTeste}
                onChange={e => setMensagemTeste(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={enviarTeste}
              disabled={enviandoTeste}
              className="w-full"
            >
              {enviandoTeste ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Teste
            </Button>

            {testeStatus && (
              <div className={`p-3 rounded-lg text-sm ${
                testeStatus === 'enviado' ? 'bg-green-500/10 text-green-700' :
                testeStatus === 'erro' ? 'bg-red-500/10 text-red-700' :
                'bg-yellow-500/10 text-yellow-700'
              }`}>
                {testeStatus === 'pendente' && '⏳ Aguardando dispatcher pegar da fila...'}
                {testeStatus === 'processando' && '🔄 Dispatcher enviando...'}
                {testeStatus === 'enviado' && '✅ Mensagem enviada com sucesso!'}
                {testeStatus === 'erro' && '❌ Erro no envio'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SEÇÃO C — Contadores da Fila */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Clock className="w-5 h-5" /> Fila de Envio</span>
              <Button variant="outline" size="sm" onClick={carregarContadores}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-yellow-500/10 text-center">
                <p className="text-3xl font-bold text-yellow-600">{contadores.pendentes}</p>
                <p className="text-sm text-muted-foreground">🟡 Pendentes</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 text-center">
                <p className="text-3xl font-bold text-blue-600">{contadores.processando}</p>
                <p className="text-sm text-muted-foreground">🔵 Processando</p>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 text-center">
                <p className="text-3xl font-bold text-green-600">{contadores.enviados}</p>
                <p className="text-sm text-muted-foreground">🟢 Enviados</p>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 text-center">
                <p className="text-3xl font-bold text-red-600">{contadores.erros}</p>
                <p className="text-sm text-muted-foreground">🔴 Erros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO D — Histórico de Envios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>📜 Histórico de Envios</span>
            <div className="flex gap-2">
              {['todos', 'pendente', 'enviado', 'erro'].map(f => (
                <Button
                  key={f}
                  variant={filtro === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFiltro(f)}
                >
                  {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum envio encontrado</p>
          ) : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.lead_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{item.lead_phone}</TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className="text-center">{item.tentativas}</TableCell>
                      <TableCell className="text-xs">
                        {item.sent_at ? new Date(item.sent_at).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                        {item.erro || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
