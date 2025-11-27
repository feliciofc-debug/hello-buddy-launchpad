import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';

interface LogEnvio {
  id: string;
  payload: any;
  extracted_phone: string;
  extracted_message: string;
  processing_result: string;
  timestamp: string;
}

export function LogsEnvioWuzapi() {
  const [logs, setLogs] = useState<LogEnvio[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarLogs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(15);

      setLogs(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLogs();
    const interval = setInterval(carregarLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (result: string) => {
    if (result?.includes('ENVIADO')) {
      return <Badge className="bg-green-500">✅ {result}</Badge>;
    }
    if (result?.includes('ERRO')) {
      return <Badge className="bg-red-500">❌ {result}</Badge>;
    }
    if (result?.includes('IGNORADO')) {
      return <Badge className="bg-yellow-500">⚠️ {result}</Badge>;
    }
    return <Badge className="bg-gray-500">{result}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>📤 Logs de Envio Wuzapi</span>
          <Button size="sm" variant="outline" onClick={carregarLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum log ainda. Envie uma mensagem para ver os logs.
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="p-3 bg-gray-50 rounded border text-sm">
                <div className="flex items-center justify-between mb-2">
                  {getStatusBadge(log.processing_result)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <p><strong>📱 Telefone:</strong> {log.extracted_phone}</p>
                  <p><strong>💬 Mensagem:</strong> {log.extracted_message?.substring(0, 50)}...</p>
                  
                  {log.payload?.tipo === 'ENVIO_WUZAPI' && (
                    <>
                      <p><strong>📡 Formato:</strong> {log.payload.formato}</p>
                      <p><strong>✅ Sucesso:</strong> {log.payload.sucesso ? 'SIM' : 'NÃO'}</p>
                    </>
                  )}

                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600 hover:underline">
                      Ver payload completo
                    </summary>
                    <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto border">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded text-xs">
          <p className="font-bold mb-1">💡 Legenda:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li><span className="text-green-600">ENVIADO_*</span> = Mensagem enviada com sucesso</li>
            <li><span className="text-red-600">ERRO_*</span> = Falha no envio</li>
            <li><span className="text-yellow-600">IGNORADO_*</span> = Mensagem própria ignorada</li>
            <li><span className="text-gray-600">PROCESSANDO</span> = Em processamento</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
