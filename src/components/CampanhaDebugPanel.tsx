import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, PlayCircle, Bug } from 'lucide-react';

export function CampanhaDebugPanel() {
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarCampanhas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campanhas_recorrentes')
        .select(`
          *,
          produtos (nome, preco, imagem_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampanhas(data || []);
      console.log('📋 Campanhas carregadas:', data);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  };

  const carregarLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_execution_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs(data || []);
      console.log('📝 Logs carregados:', data);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  const testarSistema = async () => {
    console.log('ℹ️ Dispatcher interno desativado (modo queue-only).');
    toast.info('Dispatcher interno desativado: o envio é feito somente pelo gateway local.');
  };

  const executarCampanha = async (campaignId: string, nome: string) => {
    console.log(`ℹ️ Execução manual bloqueada para campanha: ${nome}`, campaignId);
    toast.info('Execução manual desativada: a campanha deve apenas entrar na fila.');
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bug className="w-6 h-6" />
          Debug de Campanhas
        </h2>
        <div className="flex gap-2">
          <Button onClick={carregarCampanhas} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={testarSistema} variant="default">
            <PlayCircle className="w-4 h-4 mr-2" />
            Testar Sistema
          </Button>
        </div>
      </div>

      {/* Lista de Campanhas */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">📋 Campanhas Registradas</h3>
        {campanhas.length === 0 ? (
          <p className="text-muted-foreground text-sm">Clique em "Atualizar" para carregar</p>
        ) : (
          campanhas.map(c => {
            const proxima = new Date(c.proxima_execucao);
            const agora = new Date();
            const minutos = Math.round((proxima.getTime() - agora.getTime()) / 60000);
            const passou = minutos < 0;

            return (
              <div key={c.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{c.nome}</span>
                      <Badge variant={c.ativa ? 'default' : 'secondary'}>
                        {c.ativa ? '🟢 Ativa' : '⚪ Pausada'}
                      </Badge>
                      <Badge variant="outline">{c.frequencia}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                      <div className={passou ? 'text-red-500 font-bold' : ''}>
                        ⏰ Próxima: {proxima.toLocaleString('pt-BR')} 
                        {passou ? ` (PASSOU ${Math.abs(minutos)} min atrás!)` : ` (daqui ${minutos} min)`}
                      </div>
                      <div>
                        🕐 Última: {c.ultima_execucao 
                          ? new Date(c.ultima_execucao).toLocaleString('pt-BR')
                          : 'Nunca executada'}
                      </div>
                      <div>📤 Total enviados: {c.total_enviados || 0}</div>
                      <div>📱 Listas: {c.listas_ids?.length || 0}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => executarCampanha(c.id, c.nome)}
                    variant="outline"
                  >
                    ▶️ Executar Agora
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Logs de Execução */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">📝 Logs de Execução</h3>
          <Button onClick={carregarLogs} variant="ghost" size="sm">
            Carregar Logs
          </Button>
        </div>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum log ainda</p>
        ) : (
          <div className="space-y-1">
            {logs.map(log => (
              <div key={log.id} className="text-xs bg-muted p-2 rounded">
                <span className="font-mono">
                  [{new Date(log.created_at).toLocaleString('pt-BR')}]
                </span>
                {' '}
                <Badge variant={log.log_type === 'ERROR' ? 'destructive' : 'default'}>
                  {log.log_type}
                </Badge>
                {' '}
                {log.message}
                {log.error && <span className="text-red-500"> - {log.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm space-y-1">
        <p className="font-semibold">💡 Como usar:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Clique "Atualizar" para ver todas as campanhas</li>
          <li>Campanhas são processadas em modo queue-only (sem dispatcher interno)</li>
          <li>Use "Executar Agora" apenas para validar estado da campanha</li>
          <li>Use "Testar Sistema" para checar status, sem disparo direto</li>
          <li>Verifique os logs no console do navegador (F12)</li>
        </ol>
      </div>
    </Card>
  );
}
