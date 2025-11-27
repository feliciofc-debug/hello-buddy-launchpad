import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DebugLog {
  id: string;
  payload: any;
  extracted_phone: string;
  extracted_message: string;
  processing_result: string;
  timestamp: string;
}

export function DebugPayloads() {
  const [payloads, setPayloads] = useState<DebugLog[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarPayloads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('webhook_debug_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erro ao carregar logs:', error);
    }
    setPayloads((data as DebugLog[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    carregarPayloads();
    const interval = setInterval(carregarPayloads, 5000);
    return () => clearInterval(interval);
  }, []);

  const limparLogs = async () => {
    await supabase.from('webhook_debug_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    carregarPayloads();
  };

  const getStatusBadge = (result: string) => {
    if (!result) return <Badge variant="outline">Pendente</Badge>;
    if (result.startsWith('SUCESSO')) return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Sucesso</Badge>;
    if (result.startsWith('ERRO')) return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
    if (result.includes('IGNORADO')) return <Badge variant="secondary">Ignorado</Badge>;
    if (result.includes('SEM CONTEXTO')) return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Sem Contexto</Badge>;
    return <Badge variant="outline">{result.substring(0, 20)}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            🔍 Payloads Recebidos do Wuzapi
            <Badge variant="outline">{payloads.length}</Badge>
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={carregarPayloads} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" variant="destructive" onClick={limparLogs}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payloads.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-lg mb-2">⚠️ Nenhum payload recebido ainda</p>
            <p className="text-sm">Envie uma mensagem no WhatsApp para ver os logs aqui!</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {payloads.map(log => (
              <div key={log.id} className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {getStatusBadge(log.processing_result)}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-2 bg-background rounded border">
                    <p className="text-xs font-medium text-muted-foreground mb-1">📱 Telefone Extraído</p>
                    <p className="text-sm font-mono">{log.extracted_phone || 'N/A'}</p>
                  </div>
                  <div className="p-2 bg-background rounded border">
                    <p className="text-xs font-medium text-muted-foreground mb-1">💬 Mensagem Extraída</p>
                    <p className="text-sm">{log.extracted_message || 'N/A'}</p>
                  </div>
                </div>

                <div className="p-2 bg-background rounded border mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">📋 Resultado</p>
                  <p className="text-sm">{log.processing_result || 'Processando...'}</p>
                </div>
                
                <details className="cursor-pointer">
                  <summary className="text-xs text-muted-foreground hover:text-foreground">
                    Ver payload completo
                  </summary>
                  <pre className="text-xs overflow-x-auto bg-background p-3 rounded border mt-2 max-h-60">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded text-sm">
          <p className="font-medium mb-2">📌 Configure no Wuzapi:</p>
          <code className="text-xs bg-background p-2 rounded block overflow-x-auto border">
            https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/wuzapi-webhook
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
