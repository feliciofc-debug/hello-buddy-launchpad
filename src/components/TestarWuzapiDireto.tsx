import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function TestarWuzapiDireto() {
  const [telefone, setTelefone] = useState('5521967520706');
  const [mensagem, setMensagem] = useState('🧪 Teste direto AMZ Ofertas - Se receber, Wuzapi está funcionando!');
  const [testando, setTestando] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [resultado, setResultado] = useState<any>(null);

  const testar = async () => {
    setTestando(true);
    setLogs([]);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-wuzapi-direct', {
        body: { telefone, mensagem }
      });

      if (error) {
        setLogs([`❌ Erro: ${error.message}`]);
        toast.error('Erro ao testar');
        return;
      }

      setLogs(data.logs || []);
      setResultado(data);

      if (data.success) {
        toast.success(`✅ Enviado pelo formato ${data.formato}! Verifique seu WhatsApp!`);
      } else {
        toast.error(data.error || 'Falha no envio');
      }

    } catch (error: any) {
      setLogs([`❌ Erro: ${error.message}`]);
      toast.error('Erro: ' + error.message);
    } finally {
      setTestando(false);
    }
  };

  return (
    <Card className="border-2 border-orange-200">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
        <CardTitle className="flex items-center gap-2">
          🧪 Teste DIRETO do Wuzapi
          <Badge variant="outline" className="ml-2">Debug</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm">
          <p className="font-bold text-yellow-800">⚠️ Este teste envia direto pelo Wuzapi</p>
          <p className="text-yellow-700">Se a mensagem chegar = Wuzapi OK</p>
          <p className="text-yellow-700">Se não chegar = Problema na config</p>
        </div>

        <div>
          <label className="text-sm font-medium">Seu Número (com 55):</label>
          <Input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
            placeholder="5521967520706"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Mensagem de Teste:</label>
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={2}
          />
        </div>

        <Button 
          onClick={testar} 
          disabled={testando} 
          className="w-full bg-orange-500 hover:bg-orange-600"
          size="lg"
        >
          {testando ? '⏳ Testando todos os formatos...' : '📤 ENVIAR TESTE AGORA'}
        </Button>

        {resultado && (
          <div className={`p-4 rounded-lg ${resultado.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {resultado.success ? (
                <Badge className="bg-green-500">✅ SUCESSO</Badge>
              ) : (
                <Badge className="bg-red-500">❌ FALHOU</Badge>
              )}
              {resultado.formato && (
                <Badge variant="outline">Formato: {resultado.formato}</Badge>
              )}
            </div>
            {resultado.status && (
              <p className="text-sm"><strong>Status HTTP:</strong> {resultado.status}</p>
            )}
            {resultado.error && (
              <p className="text-sm text-red-600"><strong>Erro:</strong> {resultado.error}</p>
            )}
          </div>
        )}

        {logs.length > 0 && (
          <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs max-h-60 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className={log.includes('✅') ? 'text-green-400' : log.includes('❌') ? 'text-red-400' : 'text-gray-300'}>
                {log}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
