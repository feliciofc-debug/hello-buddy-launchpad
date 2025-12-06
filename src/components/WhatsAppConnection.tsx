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

  const [activateCalled, setActivateCalled] = useState(false);

  // Verificar status ao montar
  useEffect(() => {
    checkStatus();
  }, []);

  // Polling enquanto aguarda conexão com QR Code
  useEffect(() => {
    if (!qrCode) return;

    const interval = setInterval(async () => {
      try {
        const response = await supabase.functions.invoke("wuzapi-qrcode", {
          body: { action: "connect" }
        });

        console.log("Polling status:", response.data);

        // Se já conectou
        if (response.data?.already_connected) {
          setStatus({
            connected: true,
            phone_number: response.data.phone_number,
            instance_name: status.instance_name
          });
          setQrCode(null);
          setActivateCalled(false);
          toast.success("WhatsApp conectado com sucesso!");
          return;
        }

        // Se tem QR code, atualizar
        if (response.data?.qr_code) {
          setQrCode(response.data.qr_code);
        }

        // Se está conectado mas não logado - chamar activate!
        if (response.data?.success && !response.data?.already_connected && !response.data?.qr_code && !activateCalled) {
          console.log("🔗 QR escaneado! Ativando sessão...");
          setActivateCalled(true);
          
          await supabase.functions.invoke("wuzapi-qrcode", {
            body: { action: "activate" }
          });
        }

      } catch (error) {
        console.error("Erro no polling:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [qrCode, status.instance_name, activateCalled]);

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "status" }
      });

      if (response.data?.success) {
        setStatus({
          connected: response.data.connected,
          phone_number: response.data.phone_number,
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
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "connect" }
      });

      if (response.data?.already_connected) {
        toast.success("WhatsApp já está conectado!");
        setStatus({
          connected: true,
          phone_number: response.data.phone_number,
          instance_name: status.instance_name
        });
        return;
      }

      if (response.data?.qr_code) {
        setQrCode(response.data.qr_code);
        toast.info("Escaneie o QR Code com seu WhatsApp");
      } else {
        toast.error(response.data?.error || "Erro ao gerar QR Code");
      }
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast.error("Erro ao conectar WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "disconnect" }
      });

      if (response.data?.success) {
        setStatus({
          connected: false,
          phone_number: null,
          instance_name: status.instance_name
        });
        setQrCode(null);
        toast.success("WhatsApp desconectado");
      } else {
        toast.error(response.data?.error || "Erro ao desconectar");
      }
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      toast.error("Erro ao desconectar WhatsApp");
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
