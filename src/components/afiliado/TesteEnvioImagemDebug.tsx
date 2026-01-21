import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bug, Send, Loader2, Image } from 'lucide-react';

export function TesteEnvioImagemDebug() {
  const [groupJid, setGroupJid] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('🧪 Teste de envio de imagem com base64');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  const testarEnvio = async () => {
    if (!groupJid || !imageUrl) {
      toast.error('Preencha o JID do grupo e a URL da imagem');
      return;
    }

    setLoading(true);
    setLogs([]);
    addLog('🚀 Iniciando teste de envio...');

    try {
      // Buscar dados do afiliado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addLog('❌ Usuário não autenticado');
        toast.error('Faça login primeiro');
        return;
      }

      addLog(`👤 Usuário: ${user.id}`);

      // Buscar cliente afiliado
      const { data: clienteData } = await supabase
        .from('clientes_afiliados')
        .select('id, wuzapi_instance_id, wuzapi_token')
        .eq('user_id', user.id)
        .single();

      if (!clienteData) {
        addLog('❌ Cliente afiliado não encontrado');
        toast.error('Configure sua conta de afiliado primeiro');
        return;
      }

      addLog(`📱 Instância ID: ${clienteData.wuzapi_instance_id}`);

      // Buscar token do WuzAPI
      const { data: tokenData } = await supabase
        .from('wuzapi_tokens_afiliados')
        .select('token')
        .eq('cliente_afiliado_id', clienteData.id)
        .eq('em_uso', true)
        .single();

      const tokenToUse = tokenData?.token || clienteData.wuzapi_token;
      
      if (!tokenToUse) {
        addLog('❌ Token WuzAPI não encontrado');
        toast.error('Configure sua conexão WhatsApp primeiro');
        return;
      }

      addLog(`🔑 Token encontrado`);

      // Chamar a Edge Function de teste
      addLog('📤 Chamando Edge Function send-wuzapi-group-message...');
      
      const { data, error } = await supabase.functions.invoke('send-wuzapi-group-message', {
        body: {
          groupJid,
          message: caption,
          imageUrl,
          token: tokenToUse,
          instanceName: clienteData.wuzapi_instance_id
        }
      });

      if (error) {
        addLog(`❌ Erro na Edge Function: ${error.message}`);
        toast.error(`Erro: ${error.message}`);
        return;
      }

      addLog(`✅ Resposta: ${JSON.stringify(data, null, 2)}`);
      
      if (data?.success) {
        toast.success('Mensagem enviada! Verifique o grupo.');
        addLog('🎉 SUCESSO! Verifique o grupo do WhatsApp.');
      } else {
        toast.warning(`Resposta: ${data?.message || 'Verifique os logs'}`);
        addLog(`⚠️ Resposta do servidor: ${JSON.stringify(data)}`);
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      addLog(`❌ Exceção: ${errorMessage}`);
      toast.error(`Erro: ${errorMessage}`);
    } finally {
      setLoading(false);
      addLog('🏁 Teste finalizado');
    }
  };

  return (
    <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bug className="w-5 h-5 text-orange-500" />
          🧪 Teste Manual - Envio de Imagem (Debug)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Group JID</label>
            <Input
              placeholder="Ex: 120363XXXXX@g.us"
              value={groupJid}
              onChange={(e) => setGroupJid(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pegue o JID na tabela afiliado_grupos_whatsapp
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">URL da Imagem</label>
            <Input
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cole uma URL de imagem da Shopee ou qualquer CDN
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Legenda</label>
            <Input
              placeholder="Texto da mensagem"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          {imageUrl && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded">
              <Image className="w-4 h-4" />
              <span className="text-xs truncate">{imageUrl.substring(0, 50)}...</span>
            </div>
          )}

          <Button 
            onClick={testarEnvio} 
            disabled={loading || !groupJid || !imageUrl}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Teste
              </>
            )}
          </Button>
        </div>

        {logs.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-1 block">📋 Logs do Teste</label>
            <Textarea
              readOnly
              className="font-mono text-xs h-48 bg-background text-foreground border"
              value={logs.join('\n')}
            />
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded">
          <p><strong>📌 Como usar:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Pegue um JID de grupo real (tabela afiliado_grupos_whatsapp)</li>
            <li>Cole uma URL de imagem (Shopee, Amazon, etc)</li>
            <li>Clique "Enviar Teste"</li>
            <li>Verifique os logs aqui E no Supabase Functions</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
