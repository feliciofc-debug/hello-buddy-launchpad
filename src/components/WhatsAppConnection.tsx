import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, QrCode, Wifi, WifiOff, RefreshCw, LogOut, Loader2, Server } from "lucide-react";

interface ConnectionStatus {
  connected: boolean;
  phone_number: string | null;
  instance_name: string | null;
}

interface WuzapiInstance {
  id: string;
  instance_name: string;
  wuzapi_url: string;
  port: number;
  is_connected: boolean;
  phone_number: string | null;
}

export default function WhatsAppConnection() {
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState<WuzapiInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    phone_number: null,
    instance_name: null
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  // Carregar todas as instâncias
  useEffect(() => {
    loadInstances();
  }, []);

  // Verificar status quando selecionar instância
  useEffect(() => {
    if (selectedInstanceId) {
      checkStatus();
    }
  }, [selectedInstanceId]);

  // Polling SIMPLIFICADO - só verifica status
  useEffect(() => {
    if (!isPolling || !selectedInstanceId) return;

    const interval = setInterval(async () => {
      try {
        const response = await supabase.functions.invoke("wuzapi-qrcode", {
          body: { action: "status", instanceId: selectedInstanceId }
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
          loadInstances(); // Atualizar lista
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
  }, [isPolling, selectedInstanceId, status.instance_name]);

  const loadInstances = async () => {
    try {
      const { data, error } = await supabase
        .from("wuzapi_instances")
        .select("id, instance_name, wuzapi_url, port, is_connected, phone_number")
        .order("instance_name");

      if (error) throw error;

      setInstances(data || []);
      
      // Selecionar primeira instância por padrão
      if (data && data.length > 0 && !selectedInstanceId) {
        setSelectedInstanceId(data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar instâncias:", error);
      toast.error("Erro ao carregar instâncias");
    } finally {
      setCheckingStatus(false);
    }
  };

  const checkStatus = async () => {
    if (!selectedInstanceId) return;
    
    try {
      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "status", instanceId: selectedInstanceId }
      });

      console.log("🔍 Status inicial:", response.data);

      // Verificar se já está conectado (loggedin = true)
      if (response.data?.loggedin === true) {
        setStatus({
          connected: true,
          phone_number: response.data.jid || response.data.phone_number,
          instance_name: response.data.instance_name
        });
        setQrCode(null);
        toast.success("WhatsApp já conectado!");
      } else if (response.data?.success) {
        setStatus({
          connected: false,
          phone_number: null,
          instance_name: response.data.instance_name
        });
        setQrCode(null);
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    }
  };

  const handleConnect = async () => {
    if (!selectedInstanceId) {
      toast.error("Selecione uma instância primeiro");
      return;
    }
    
    console.log("🔵 handleConnect chamado para instância:", selectedInstanceId);
    
    // Limpar estado antes de iniciar
    setQrCode(null);
    setStatus(prev => ({ ...prev, connected: false, phone_number: null }));
    setLoading(true);
    
    try {
      // Chamar action "connect" que faz POST /session/connect + busca QR
      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "connect", instanceId: selectedInstanceId }
      });

      console.log("🔗 Resposta connect:", response.data);

      // Se já está conectado
      if (response.data?.loggedin === true || response.data?.already_connected) {
        toast.success("WhatsApp já está conectado!");
        setStatus({
          connected: true,
          phone_number: response.data.phone_number,
          instance_name: response.data.instance_name || status.instance_name
        });
        return;
      }

      // Se tem QR code, mostrar e iniciar polling
      if (response.data?.qrcode) {
        setQrCode(response.data.qrcode);
        setIsPolling(true);
        toast.info("Escaneie o QR Code com seu WhatsApp");
      } else if (response.data?.retry) {
        // Retry automático após 2 segundos
        toast.info("Gerando QR Code...");
        setTimeout(() => handleConnect(), 2000);
      } else {
        toast.error("Erro ao gerar QR Code. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast.error("Erro ao conectar WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedInstanceId) return;
    
    console.log("🔴 handleDisconnect chamado");
    setLoading(true);
    
    // PARAR POLLING PRIMEIRO
    setIsPolling(false);
    
    try {
      const response = await supabase.functions.invoke("wuzapi-qrcode", {
        body: { action: "disconnect", instanceId: selectedInstanceId }
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
        loadInstances(); // Atualizar lista
      } else {
        toast.warning("WhatsApp desconectado localmente");
      }
    } catch (error) {
      console.error("Erro ao desconectar:", error);
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
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);

  if (checkingStatus && instances.length === 0) {
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
                Selecione uma instância para testar
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
        {/* Seletor de Instância */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Server className="h-4 w-4" />
            Selecionar Instância
          </label>
          <Select value={selectedInstanceId || ""} onValueChange={setSelectedInstanceId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma instância" />
            </SelectTrigger>
            <SelectContent>
              {instances.map((instance) => (
                <SelectItem key={instance.id} value={instance.id}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${instance.is_connected ? "bg-green-500" : "bg-gray-400"}`} />
                    <span className="font-medium">{instance.instance_name}</span>
                    <span className="text-muted-foreground text-xs">
                      (porta {instance.port})
                    </span>
                    {instance.phone_number && (
                      <span className="text-xs text-green-600">
                        - {formatPhone(instance.phone_number)}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedInstance && (
            <p className="text-xs text-muted-foreground">
              URL: {selectedInstance.wuzapi_url}
            </p>
          )}
        </div>

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
        {!status.connected && !qrCode && selectedInstanceId && (
          <div className="flex flex-col items-center py-8">
            <div className="p-4 rounded-full bg-muted mb-4">
              <QrCode className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-center text-muted-foreground mb-4">
              Conecte o WhatsApp nesta instância
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
        <div className="flex justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={checkStatus}
            className="text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar status
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadInstances}
            className="text-muted-foreground"
          >
            <Server className="h-4 w-4 mr-1" />
            Recarregar instâncias
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
