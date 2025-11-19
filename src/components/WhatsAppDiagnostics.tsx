import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, RefreshCw, Send, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";

export const WhatsAppDiagnostics = () => {
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      // 1. Verificar configuração Wuzapi
      const wuzapiUrl = import.meta.env.VITE_WUZAPI_URL;
      const wuzapiToken = import.meta.env.VITE_WUZAPI_TOKEN;
      const wuzapiInstanceId = import.meta.env.VITE_WUZAPI_INSTANCE_ID;

      // 2. Verificar mensagens recebidas
      const { data: receivedMessages, error: recError } = await supabase
        .from('whatsapp_messages_received')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // 3. Verificar mensagens enviadas
      const { data: sentMessages, error: sentError } = await supabase
        .from('whatsapp_messages_sent')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // 4. Testar conexão com Wuzapi
      let wuzapiStatus = 'unknown';
      try {
        const baseUrl = wuzapiUrl?.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl;
        const response = await fetch(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: {
            'Token': wuzapiToken || '',
          },
        });
        wuzapiStatus = response.ok ? 'connected' : 'error';
      } catch (e) {
        wuzapiStatus = 'error';
      }

      setDiagnostics({
        config: {
          wuzapiUrl: !!wuzapiUrl,
          wuzapiToken: !!wuzapiToken,
          wuzapiInstanceId: !!wuzapiInstanceId,
        },
        wuzapiStatus,
        receivedMessages: receivedMessages?.length || 0,
        sentMessages: sentMessages?.length || 0,
        lastReceived: receivedMessages?.[0]?.created_at,
        lastSent: sentMessages?.[0]?.created_at,
        errors: {
          receivedError: recError?.message,
          sentError: sentError?.message,
        }
      });

      toast.success("Diagnóstico completo!");
    } catch (error: any) {
      toast.error("Erro ao executar diagnóstico: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone) {
      toast.error("Digite um número de telefone");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-wuzapi-message', {
        body: {
          phoneNumber: testPhone,
          message: "🤖 Mensagem de teste do sistema. Se você recebeu isso, a integração está funcionando!"
        }
      });

      if (error) throw error;
      toast.success("Mensagem de teste enviada!");
    } catch (error: any) {
      toast.error("Erro ao enviar teste: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Diagnóstico WhatsApp
        </CardTitle>
        <CardDescription>
          Verifique a saúde da integração WhatsApp/Wuzapi
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runDiagnostics} disabled={loading} className="w-full">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? "Executando..." : "Executar Diagnóstico"}
        </Button>

        {diagnostics && (
          <div className="space-y-4 pt-4 border-t">
            {/* Configuração */}
            <div>
              <h4 className="font-semibold mb-2">📋 Configuração</h4>
              <div className="space-y-1">
                <StatusItem 
                  label="WUZAPI_URL" 
                  status={diagnostics.config.wuzapiUrl} 
                />
                <StatusItem 
                  label="WUZAPI_TOKEN" 
                  status={diagnostics.config.wuzapiToken} 
                />
                <StatusItem 
                  label="WUZAPI_INSTANCE_ID" 
                  status={diagnostics.config.wuzapiInstanceId} 
                />
              </div>
            </div>

            {/* Status da Conexão */}
            <div>
              <h4 className="font-semibold mb-2">🔌 Status da Conexão</h4>
              <StatusItem 
                label="Wuzapi" 
                status={diagnostics.wuzapiStatus === 'connected'} 
                detail={diagnostics.wuzapiStatus}
              />
            </div>

            {/* Mensagens */}
            <div>
              <h4 className="font-semibold mb-2">💬 Histórico de Mensagens</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="text-sm">Mensagens Recebidas</span>
                  <Badge variant={diagnostics.receivedMessages > 0 ? "default" : "secondary"}>
                    {diagnostics.receivedMessages}
                  </Badge>
                </div>
                {diagnostics.lastReceived && (
                  <p className="text-xs text-muted-foreground ml-2">
                    Última: {new Date(diagnostics.lastReceived).toLocaleString('pt-BR')}
                  </p>
                )}
                
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="text-sm">Mensagens Enviadas</span>
                  <Badge variant={diagnostics.sentMessages > 0 ? "default" : "secondary"}>
                    {diagnostics.sentMessages}
                  </Badge>
                </div>
                {diagnostics.lastSent && (
                  <p className="text-xs text-muted-foreground ml-2">
                    Última: {new Date(diagnostics.lastSent).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            {/* Teste de Envio */}
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-2">🧪 Teste de Envio</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="5521999999999"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  disabled={loading}
                />
                <Button onClick={sendTestMessage} disabled={loading || !testPhone}>
                  <Send className="h-4 w-4 mr-2" />
                  Testar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Digite um número com DDD (ex: 5521999999999)
              </p>
            </div>

            {/* Recomendações */}
            {diagnostics.receivedMessages === 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-500 mb-1">
                  ⚠️ Nenhuma mensagem recebida
                </p>
                <p className="text-xs text-muted-foreground">
                  Verifique se o webhook está configurado no Wuzapi para enviar eventos de mensagens.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Guia de Configuração */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2">📚 Guia de Configuração Wuzapi</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>No painel Wuzapi, vá em <strong>Configuration → Webhook Events</strong></li>
            <li>Configure o <strong>Webhook URL</strong>: 
              <code className="block bg-muted p-1 rounded text-xs mt-1 overflow-x-auto">
                https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/wuzapi-webhook
              </code>
            </li>
            <li>Em <strong>Webhook Events</strong>, selecione apenas: <strong>Message</strong></li>
            <li>Clique em <strong>Set</strong> para salvar</li>
            <li>Teste enviando uma mensagem para o número conectado</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

const StatusItem = ({ label, status, detail }: { label: string; status: boolean; detail?: string }) => (
  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
    <span className="text-sm">{label}</span>
    <div className="flex items-center gap-2">
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      {status ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-500" />
      )}
    </div>
  </div>
);
