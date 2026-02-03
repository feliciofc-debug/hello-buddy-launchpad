"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Smartphone, RefreshCw, LogOut, QrCode, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ConnectionStatus {
  connected: boolean;
  jid?: string;
  phone?: string;
  lastChecked?: string;
}

export default function WhatsAppConnectionPJ() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [hasConfig, setHasConfig] = useState(false);
  const [lastQrError, setLastQrError] = useState<null | {
    message: string;
    details?: any;
    raw?: string;
  }>(null);

  const canShowDisconnect = useMemo(() => {
    // Mesmo se o status estiver “desconectado”, pode existir sessão presa no servidor.
    // Mostrar a ação evita o botão “fantasma” (sumindo quando o usuário mais precisa).
    return hasConfig;
  }, [hasConfig]);

  const normalizeQrString = (raw: unknown) => {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;
    // Algumas APIs já retornam data URL completa.
    if (str.startsWith('data:image')) return str;
    // Caso contrário, assumimos base64 do PNG.
    return `data:image/png;base64,${str}`;
  };

  const requireSession = async () => {
    // getUser() pode retornar null em algumas condições de cache/latência.
    // Para ações críticas, preferimos a sessão (token) e extraímos o userId dela.
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Erro ao obter sessão:', error);
    }

    const userId = data.session?.user?.id;
    if (!userId) {
      toast.error('Sessão expirada. Faça login novamente.');
      navigate('/login');
      return null;
    }

    return { userId };
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: config } = await supabase
      .from('pj_clientes_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (config) {
      setHasConfig(true);
      setInstanceName(config.wuzapi_instance_name || '');
      
      // SEMPRE verificar o status real via API, não confiar apenas no banco
      // O banco pode estar desatualizado se a sessão WuzAPI desconectou
      try {
        const { data: statusData, error } = await supabase.functions.invoke('criar-instancia-wuzapi-pj', {
          body: { userId: user.id, action: 'status' }
        });
        
        if (!error && statusData) {
          // Usa o status REAL retornado pela API
          const isReallyConnected = statusData.connected === true;
          
          if (isReallyConnected && statusData.jid) {
            const cleanPhone = statusData.jid
              ?.replace('@s.whatsapp.net', '')
              ?.replace(/:\d+$/, '');
            setStatus({
              connected: true,
              jid: statusData.jid,
              phone: cleanPhone,
            });
          } else {
            // NÃO está conectado de verdade
            setStatus({ connected: false });
          }
        } else {
          // Fallback para o valor do banco se API falhar
          if (config.whatsapp_conectado && config.wuzapi_jid) {
            const cleanPhone = config.wuzapi_jid
              ?.replace('@s.whatsapp.net', '')
              ?.replace(/:\d+$/, '');
            setStatus({
              connected: true,
              jid: config.wuzapi_jid,
              phone: cleanPhone,
            });
          }
        }
      } catch (err) {
        console.error('Erro ao verificar status real:', err);
        // Fallback seguro: assume desconectado se não conseguir verificar
        setStatus({ connected: false });
      }
    }
  };

  const checkStatus = async () => {
    setCheckingStatus(true);
    try {
      const sessionInfo = await requireSession();
      if (!sessionInfo) return;

      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-pj', {
        body: { userId: sessionInfo.userId, action: 'status' }
      });

      if (error) throw error;

      setStatus({
        connected: data.connected,
        jid: data.jid,
        phone: data.phone,
        lastChecked: new Date().toISOString()
      });

      if (data.connected) {
        toast.success('✅ WhatsApp conectado!');
      } else {
        toast.info('📱 WhatsApp não conectado');
      }
    } catch (err: any) {
      console.error('Erro ao verificar status:', err);
      toast.error('Erro ao verificar status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const generateQRCode = async () => {
    setLoading(true);
    setQrCode(null);
    setLastQrError(null);

    try {
      const sessionInfo = await requireSession();
      if (!sessionInfo) return;

      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-pj', {
        body: { userId: sessionInfo.userId, action: 'qrcode', instance_name: instanceName || undefined }
      });

      if (error) throw error;

      const possibleQr =
        data?.qrCode ??
        data?.qrcode ??
        data?.qr ??
        data?.code ??
        data?.data?.qrcode ??
        data?.data?.qr ??
        data?.data?.code ??
        null;

      const normalized = normalizeQrString(possibleQr);

      if (normalized) {
        setQrCode(normalized);
        toast.success('📲 QR Code gerado! Escaneie com seu WhatsApp');
        
        // Poll for connection
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          if (attempts > 30) {
            clearInterval(pollInterval);
            setQrCode(null);
            toast.error('⏰ QR Code expirou. Tente novamente.');
            return;
          }

          const { data: statusData } = await supabase.functions.invoke('criar-instancia-wuzapi-pj', {
            body: { userId: sessionInfo.userId, action: 'status' }
          });

          if (statusData?.connected) {
            clearInterval(pollInterval);
            setQrCode(null);
            setStatus({
              connected: true,
              jid: statusData.jid,
              phone: statusData.phone,
            });
            toast.success('🎉 WhatsApp conectado com sucesso!');
          }
        }, 3000);
      } else if (data?.connected) {
        setStatus({
          connected: true,
          jid: data.jid,
          phone: data.phone,
        });
        toast.success('✅ Já estava conectado!');
      } else if (data?.retry) {
        toast.info('⏳ Gerando QR Code... tente novamente em alguns segundos.');
      } else if (data?.success === false) {
        // Quando o backend retorna diagnóstico (ex: QR não gerado), não pode ficar “silencioso”.
        const msg = data?.error || 'Não foi possível gerar o QR Code agora.';
        setLastQrError({ message: msg, details: data?.details, raw: data?.raw });
        toast.error(msg);
      } else {
        const msg = 'Não foi possível gerar o QR Code agora.';
        setLastQrError({ message: msg, details: data });
        toast.error(msg);
      }
    } catch (err: any) {
      console.error('Erro ao gerar QR:', err);
      toast.error(err.message || 'Erro ao gerar QR Code');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar o WhatsApp?')) return;

    setLoading(true);
    try {
      const sessionInfo = await requireSession();
      if (!sessionInfo) return;

      const { data, error } = await supabase.functions.invoke('criar-instancia-wuzapi-pj', {
        body: { userId: sessionInfo.userId, action: 'disconnect' }
      });

      if (error) throw error;

      setStatus({ connected: false });
      setQrCode(null);
      toast.success('📴 WhatsApp desconectado');
    } catch (err: any) {
      console.error('Erro ao desconectar:', err);
      toast.error('Erro ao desconectar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>WhatsApp Business (PJ)</CardTitle>
              <CardDescription>Gerencie sua conexão empresarial</CardDescription>
            </div>
          </div>
          <Badge variant={status.connected ? "default" : "secondary"}>
            {status.connected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status conectado */}
        {status.connected && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">WhatsApp Conectado</span>
            </div>
            {status.phone && (
              <p className="text-sm text-muted-foreground mt-1">
                Número: {status.phone}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={checkStatus}
                disabled={checkingStatus}
              >
                {checkingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Atualizar Status
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={disconnect}
                disabled={loading}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Desconectar
              </Button>
            </div>
          </div>
        )}

        {/* Desconectar (sempre visível quando há config) */}
        {!status.connected && canShowDisconnect && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Se você trocou de chip/número ou a sessão ficou presa, use “Limpar sessão”.
              </p>
            </div>
            <div className="mt-3">
              <Button
                variant="destructive"
                onClick={disconnect}
                disabled={loading}
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Desconectar / Limpar sessão
              </Button>
            </div>
          </div>
        )}

        {/* QR Code */}
        {qrCode && !status.connected && (
          <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
            <p className="text-sm font-medium">Escaneie o QR Code com seu WhatsApp</p>
            <div className="bg-background p-4 rounded-lg border">
              <img 
                src={qrCode}
                alt="QR Code WhatsApp"
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Abra WhatsApp → Configurações → Aparelhos conectados → Conectar
            </p>
          </div>
        )}

        {/* Diagnóstico quando o QR não vem */}
        {lastQrError && !status.connected && !qrCode && (
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Não consegui mostrar o QR Code</p>
                <p className="text-sm text-muted-foreground">{lastQrError.message}</p>
              </div>
            </div>

            {lastQrError.details && (
              <pre className="text-xs overflow-auto rounded-md bg-muted p-3 max-h-48">
{JSON.stringify(lastQrError.details, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Botões de ação */}
        {!status.connected && !qrCode && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instance">Nome da Instância (opcional)</Label>
              <Input
                id="instance"
                placeholder="Ex: minha-empresa"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para gerar automaticamente
              </p>
            </div>

            <Button 
              onClick={generateQRCode} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>

            <Button 
              variant="outline"
              onClick={checkStatus} 
              disabled={checkingStatus}
              className="w-full"
            >
              {checkingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verificar Conexão Existente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
