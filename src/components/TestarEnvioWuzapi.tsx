import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function TestarEnvioWuzapi() {
  const [telefone, setTelefone] = useState('');
  const [testando, setTestando] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    console.log(msg);
  };

  const testarEnvio = async () => {
    if (!telefone) {
      toast.error('Digite um número de telefone');
      return;
    }

    setTestando(true);
    setLogs([]);

    try {
      const WUZAPI_URL = import.meta.env.VITE_WUZAPI_URL;
      const WUZAPI_TOKEN = import.meta.env.VITE_WUZAPI_TOKEN;
      const WUZAPI_INSTANCE_ID = import.meta.env.VITE_WUZAPI_INSTANCE_ID;

      addLog('🧪 Iniciando teste de envio...');
      addLog(`URL: ${WUZAPI_URL || 'NÃO CONFIGURADO'}`);
      addLog(`Token: ${WUZAPI_TOKEN ? 'OK' : 'FALTANDO'}`);
      addLog(`Instance: ${WUZAPI_INSTANCE_ID || 'NÃO CONFIGURADO'}`);
      addLog(`Telefone: ${telefone}`);

      if (!WUZAPI_URL || !WUZAPI_TOKEN) {
        toast.error('Wuzapi não configurado - verifique as variáveis de ambiente');
        addLog('❌ Variáveis de ambiente faltando');
        return;
      }

      const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
      const mensagem = '🧪 Teste AMZ Ofertas - Se você recebeu essa mensagem, o sistema está funcionando! ✅';

      // Tentar formato 1
      addLog('📤 Tentando formato 1: /chat/send/text');
      let res = await fetch(`${baseUrl}/chat/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': WUZAPI_TOKEN
        },
        body: JSON.stringify({
          Phone: telefone,
          Body: mensagem,
          Id: WUZAPI_INSTANCE_ID
        })
      });

      let text = await res.text();
      addLog(`Status: ${res.status}`);
      addLog(`Response: ${text}`);

      if (res.ok) {
        toast.success('✅ Mensagem enviada! Verifique seu WhatsApp');
        addLog('✅ SUCESSO no formato 1!');
        return;
      }

      // Tentar formato 2
      addLog('⚠️ Formato 1 falhou, tentando formato 2: /send/text');
      res = await fetch(`${baseUrl}/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': WUZAPI_TOKEN
        },
        body: JSON.stringify({
          phone: telefone,
          message: mensagem
        })
      });

      text = await res.text();
      addLog(`Status: ${res.status}`);
      addLog(`Response: ${text}`);

      if (res.ok) {
        toast.success('✅ Mensagem enviada! Verifique seu WhatsApp');
        addLog('✅ SUCESSO no formato 2!');
      } else {
        toast.error(`❌ Erro: ${res.status}`);
        addLog('❌ Todos os formatos falharam');
      }

    } catch (error) {
      console.error('Erro:', error);
      addLog(`❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      toast.error('Erro ao enviar: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setTestando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🧪 Testar Envio Wuzapi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Seu número de WhatsApp:
          </label>
          <Input
            placeholder="5521967520706"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Digite apenas números (com DDD e código do país)
          </p>
        </div>

        <Button 
          onClick={testarEnvio} 
          disabled={testando}
          className="w-full"
        >
          {testando ? '⏳ Enviando...' : '📤 Enviar Mensagem Teste'}
        </Button>

        {logs.length > 0 && (
          <div className="bg-muted/50 rounded p-2 text-xs font-mono max-h-40 overflow-auto">
            {logs.map((log, i) => (
              <div key={i} className="whitespace-pre-wrap">{log}</div>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>✓ Se receber a mensagem = Sistema OK</p>
          <p>✗ Se não receber = Problema no Wuzapi</p>
        </div>
      </CardContent>
    </Card>
  );
}
