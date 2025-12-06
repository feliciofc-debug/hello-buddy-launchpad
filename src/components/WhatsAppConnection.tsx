import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, QrCode, Wifi, WifiOff, RefreshCw, LogOut, Loader2 } from "lucide-react";

interface ConnectionStatus {
  connected: boolean;
  phone_number: string | null;
  instance_name: string | null;
}

export default function WhatsAppConnection() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    phone_number: null,
    instance_name: null
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  // Verificar status ao montar
  useEffect(() => {
    checkStatus();
  }, []);

  // Polling SIMPLIFICADO - só verifica status
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      try {
        const response = await supabase.functions.invoke("wuzapi-qrcode", {
          body: { action: "status" }
        });

        console.log("📡 Polling status:", response.data);

        // Se conectou (loggedin = true)
        if (response.data?.loggedin === true) {
          setStatus({
            connected: true,
            phone_number: response.data.jid || response.data.phone_number,
            instance_name: response.data.instance_name || status.instance_name
          });
          setQrCode(null);
          setIsPolling(false);
          toast.success("WhatsApp conectado com sucesso!");
          return;
        }

        // Se tem QR code novo, atualizar
        if (response.data?.qrcode) {
          setQrCode(response.data.qrcode);
        }

      } catch (error) {
        console.error("Erro no polling:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling, status.instance_name]);

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "status" }
      });

      console.log("🔍 Status inicial:", response.data);

      // Verificar se já está conectado (loggedin = true)
      if (response.data?.loggedin === true) {
        setStatus({
          connected: true,
          phone_number: response.data.jid || response.data.phone_number,
          instance_name: response.data.instance_name
        });
        toast.success("WhatsApp já conectado!");
      } else if (response.data?.success) {
        setStatus({
          connected: false,
          phone_number: null,
          instance_name: response.data.instance_name
        });
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnect = async () => {
    console.log("🔵 handleConnect chamado");
    
    // Limpar estado antes de iniciar
    setQrCode(null);
    setStatus(prev => ({ ...prev, connected: false, phone_number: null }));
    setLoading(true);
    
    try {
      // Pegar o status que já contém o QR Code
      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "status" }
      });

      console.log("🔗 Resposta connect:", response.data);

      // Se já está conectado
      if (response.data?.loggedin === true) {
        toast.success("WhatsApp já está conectado!");
        setStatus({
          connected: true,
          phone_number: response.data.jid || response.data.phone_number,
          instance_name: response.data.instance_name || status.instance_name
        });
        return;
      }

      // Se tem QR code, mostrar e iniciar polling
      if (response.data?.qrcode) {
        setQrCode(response.data.qrcode);
        setIsPolling(true);
        toast.info("Escaneie o QR Code com seu WhatsApp");
      } else {
        // Tentar novamente em 2 segundos
        setTimeout(async () => {
          const retry = await supabase.functions.invoke("wuzapi-qrcode", {
            body: { action: "status" }
          });
          if (retry.data?.qrcode) {
            setQrCode(retry.data.qrcode);
            setIsPolling(true);
            toast.info("Escaneie o QR Code com seu WhatsApp");
          } else {
            toast.error("Erro ao gerar QR Code. Tente novamente.");
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast.error("Erro ao conectar WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    console.log("🔴 handleDisconnect chamado");
    setLoading(true);
    
    // PARAR POLLING PRIMEIRO
    setIsPolling(false);
    
    try {
      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "disconnect" }
      });

      console.log("📴 Resultado disconnect:", response.data);

      // RESETAR TODOS OS ESTADOS
      setStatus({
        connected: false,
        phone_number: null,
        instance_name: status.instance_name
      });
      setQrCode(null);
      
      if (response.data?.success) {
        toast.success("WhatsApp desconectado");
      } else {
        // Mesmo com erro, resetar o estado local
        toast.warning("WhatsApp desconectado localmente");
      }
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      // Resetar estado mesmo com erro
      setStatus({
        connected: false,
        phone_number: null,
        instance_name: status.instance_name
      });
      setQrCode(null);
      toast.warning("Desconectado localmente");
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    // Formatar como +55 11 99999-9999
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  if (checkingStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${status.connected ? "bg-green-500/20" : "bg-muted"}`}>
              <Smartphone className={`h-5 w-5 ${status.connected ? "text-green-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Conexão WhatsApp</CardTitle>
              <CardDescription>
                {status.instance_name ? `Instância: ${status.instance_name}` : "Configure sua conexão"}
              </CardDescription>
            </div>
          </div>
          <Badge variant={status.connected ? "default" : "secondary"} className={status.connected ? "bg-green-500" : ""}>
            {status.connected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status conectado */}
        {status.connected && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">WhatsApp Ativo</p>
                <p className="text-sm text-muted-foreground">
                  Número: {formatPhone(status.phone_number)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={loading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 mr-1" />}
                Desconectar
              </Button>
            </div>
          </div>
        )}

        {/* QR Code */}
        {qrCode && !status.connected && (
          <div className="flex flex-col items-center p-6 rounded-lg bg-white border">
            <p className="text-sm text-muted-foreground mb-4">
              Escaneie o QR Code com seu WhatsApp
            </p>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <img 
                src={qrCode} 
                alt="QR Code WhatsApp" 
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              O QR Code expira em ~60 segundos
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConnect}
              disabled={loading}
              className="mt-2"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Gerar novo QR Code
            </Button>
          </div>
        )}

        {/* Botão conectar */}
        {!status.connected && !qrCode && (
          <div className="flex flex-col items-center py-8">
            <div className="p-4 rounded-full bg-muted mb-4">
              <QrCode className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-center text-muted-foreground mb-4">
              Conecte seu WhatsApp para enviar e receber mensagens automaticamente
            </p>
            <Button onClick={handleConnect} disabled={loading} size="lg">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          </div>
        )}

        {/* Refresh manual */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={checkStatus}
            className="text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
