import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
      addLog('🧪 Iniciando teste de envio via backend PJ...');
      
      // Obter usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        addLog('❌ Usuário não autenticado');
        return;
      }
      
      addLog(`👤 Usuário: ${user.email}`);
      addLog(`📱 Telefone destino: ${telefone}`);

      const mensagem = '🧪 Teste AMZ Ofertas - Se você recebeu essa mensagem, o sistema está funcionando! ✅';

      // Usar Edge Function PJ com userId para resolver instância correta
      addLog('📤 Enviando via send-wuzapi-message-pj...');
      
      const { data: sendData, error: sendError } = await supabase.functions.invoke('send-wuzapi-message-pj', {
        body: {
          phoneNumbers: [telefone],
          message: mensagem,
          userId: user.id,
          debugStatus: true // Incluir diagnóstico da instância
        }
      });

      addLog(`📊 Resposta: ${JSON.stringify(sendData, null, 2)}`);

      // Validar resposta completa (não só HTTP status)
      const firstResult = Array.isArray(sendData?.results) ? sendData.results[0] : null;
      const envioOk = !sendError && (firstResult ? firstResult.success === true : sendData?.success !== false);
      
      if (sendError) {
        addLog(`❌ Erro HTTP: ${sendError.message}`);
        toast.error(`Erro: ${sendError.message}`);
        return;
      }

      // Mostrar status da instância se disponível
      if (sendData?.instanceStatus) {
        const st = sendData.instanceStatus;
        addLog(`📡 Instância: ${st.baseUrl}`);
        addLog(`🔌 Conectado: ${st.connected ? 'SIM' : 'NÃO'}`);
        addLog(`📲 Logado: ${st.loggedIn ? 'SIM' : 'NÃO'}`);
        addLog(`📞 JID: ${st.jid || 'N/A'}`);
      }

      if (envioOk) {
        toast.success('✅ Mensagem enviada! Verifique seu WhatsApp');
        addLog('✅ SUCESSO! Mensagem enviada.');
      } else {
        const erro = firstResult?.error || firstResult?.response?.error || 'Falha no envio';
        addLog(`❌ Falha: ${erro}`);
        toast.error(`Falha: ${erro}`);
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
            Número de WhatsApp destino:
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
          <div className="bg-muted/50 rounded p-2 text-xs font-mono max-h-60 overflow-auto">
            {logs.map((log, i) => (
              <div key={i} className="whitespace-pre-wrap">{log}</div>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>✓ Se receber a mensagem = Sistema OK</p>
          <p>✗ Se não receber = Verifique conexão WhatsApp</p>
        </div>
      </CardContent>
    </Card>
  );
}
