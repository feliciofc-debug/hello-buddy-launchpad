import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export function WhatsAppDebugPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [conversas, setConversas] = useState<any[]>([]);
  const [wuzapiConfig, setWuzapiConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const verificarSistema = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Verificar conversas salvas
    const { data: convs } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    setConversas(convs || []);

    // Verificar mensagens recentes
    const { data: msgs } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(10);

    setLogs(msgs || []);

    // Verificar config Wuzapi usando secrets
    const wuzapiUrl = import.meta.env.VITE_WUZAPI_URL;
    const wuzapiToken = import.meta.env.VITE_WUZAPI_TOKEN;
    
    if (wuzapiUrl && wuzapiToken) {
      setWuzapiConfig({
        instance_url: wuzapiUrl,
        token: wuzapiToken,
        phone_number: 'Configurado'
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    verificarSistema();
    const interval = setInterval(verificarSistema, 5000);
    return () => clearInterval(interval);
  }, []);

  const testarWebhook = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wuzapi-webhook`,
        { method: 'GET' }
      );
      
      const data = await response.json();
      
      if (data.status === 'online') {
        toast.success('✅ Webhook está ONLINE!');
      } else {
        toast.error('❌ Webhook respondeu mas com status inesperado');
      }
    } catch (error) {
      toast.error('❌ Erro ao conectar no webhook');
      console.error('Erro webhook:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Status do Sistema
            <Button onClick={verificarSistema} size="sm" variant="outline" className="ml-auto">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Botão de Teste */}
          <Button onClick={testarWebhook} className="w-full" variant="outline">
            <Zap className="w-4 h-4 mr-2" />
            🧪 Testar Webhook
          </Button>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Badge variant={conversas.length > 0 ? 'default' : 'destructive'}>
                {conversas.length} conversas
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={logs.length > 0 ? 'default' : 'destructive'}>
                {logs.length} mensagens
              </Badge>
            </div>
          </div>

          {/* Config Wuzapi */}
          <div className="border rounded p-3 bg-muted/50">
            <p className="font-medium mb-2 flex items-center gap-2">
              {wuzapiConfig ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              Configuração Wuzapi
            </p>
            {wuzapiConfig ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><strong>Instance:</strong> {wuzapiConfig.instance_url}</p>
                <p><strong>Token:</strong> {wuzapiConfig.token ? '✓ Configurado' : '✗ Faltando'}</p>
                <p><strong>Phone:</strong> {wuzapiConfig.phone_number}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Configure em WhatsApp → Configurações</p>
            )}
          </div>

          {/* Webhook URL */}
          {wuzapiConfig && (
            <div className="border rounded p-3 bg-blue-50 dark:bg-blue-950">
              <p className="font-medium text-xs mb-2">🔗 Configure no Wuzapi:</p>
              <code className="text-xs bg-white dark:bg-gray-900 p-2 rounded block overflow-x-auto">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/wuzapi-webhook
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimas Conversas */}
      <Card>
        <CardHeader>
          <CardTitle>📱 Últimas Conversas</CardTitle>
        </CardHeader>
        <CardContent>
          {conversas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {conversas.map(conv => (
                <div key={conv.id} className="text-xs bg-muted p-3 rounded">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium">{conv.phone_number}</p>
                    <Badge variant="outline" className="text-xs">
                      {conv.origem}
                    </Badge>
                  </div>
                  {conv.last_message_context?.produto_nome && (
                    <p className="text-muted-foreground">
                      Produto: {conv.last_message_context.produto_nome}
                    </p>
                  )}
                  {conv.last_message_context?.empresa && (
                    <p className="text-muted-foreground">
                      Empresa: {conv.last_message_context.empresa}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimas Mensagens */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>💬 Últimas Mensagens</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map(msg => (
                <div 
                  key={msg.id} 
                  className={`text-xs p-3 rounded ${
                    msg.direction === 'sent' 
                      ? 'bg-blue-50 dark:bg-blue-950' 
                      : 'bg-gray-50 dark:bg-gray-900'
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{msg.phone}</span>
                    <Badge variant="outline" className="text-xs">
                      {msg.direction === 'sent' ? '🤖 Bot' : '👤 Cliente'}
                    </Badge>
                  </div>
                  <p className="mb-1">{msg.message}</p>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>{new Date(msg.timestamp).toLocaleString('pt-BR')}</span>
                    {msg.origem && (
                      <Badge variant="secondary" className="text-xs">
                        {msg.origem}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card className="lg:col-span-2 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
        <CardContent className="pt-6">
          <div className="text-sm space-y-2">
            <p className="font-medium">🔍 Como debugar:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Clique em "Testar Webhook" - deve retornar "online"</li>
              <li>Verifique se Wuzapi está configurado acima</li>
              <li>Configure a URL do webhook no painel do Wuzapi</li>
              <li>Envie uma campanha teste para um número</li>
              <li>Responda no WhatsApp</li>
              <li>Veja se aparece nas "Últimas Mensagens" aqui</li>
              <li>Se não aparecer, veja os logs no Supabase Dashboard</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
