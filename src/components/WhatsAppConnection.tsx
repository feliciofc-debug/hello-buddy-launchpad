import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, QrCode, Wifi, WifiOff, RefreshCw, LogOut, Loader2, CheckCircle } from "lucide-react";

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

  // Carregar instâncias
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
          const phoneNumber = response.data.jid || response.data.phone_number;
          
          console.log("✅ WhatsApp conectado! Atualizando banco...");
          
          // 🔥 ATUALIZAR BANCO - is_connected = true
          const { error: updateError } = await supabase
            .from("wuzapi_instances")
            .update({
              is_connected: true,
              phone_number: phoneNumber,
              connected_at: new Date().toISOString()
            })
            .eq("id", selectedInstanceId);
          
          if (updateError) {
            console.error("❌ Erro ao atualizar banco:", updateError);
          } else {
            console.log("✅ Banco atualizado! is_connected = true");
          }
          
          setStatus({
            connected: true,
            phone_number: phoneNumber,
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
        .gte("port", 8080) // Portas PJ: 8080-8089 (inclui 8080 que é a principal)
        .lte("port", 8089)
        .order("port");

      if (error) throw error;

      setInstances(data || []);
      
      // Selecionar primeira instância conectada ou primeira disponível
      if (data && data.length > 0 && !selectedInstanceId) {
        const connected = data.find(i => i.is_connected);
        setSelectedInstanceId(connected?.id || data[0].id);
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
        const phoneNumber = response.data.jid || response.data.phone_number;
        
        console.log("✅ Já conectado! Sincronizando banco...");
        
        // 🔥 SINCRONIZAR BANCO - garantir is_connected = true
        const { error: updateError } = await supabase
          .from("wuzapi_instances")
          .update({
            is_connected: true,
            phone_number: phoneNumber
          })
          .eq("id", selectedInstanceId);
        
        if (updateError) {
          console.error("❌ Erro ao sincronizar banco:", updateError);
        } else {
          console.log("✅ Banco sincronizado!");
        }
        
        setStatus({
          connected: true,
          phone_number: phoneNumber,
          instance_name: response.data.instance_name
        });
        setQrCode(null);
        toast.success("WhatsApp já conectado!");
      } else if (response.data?.success) {
        // 🔥 SINCRONIZAR BANCO - garantir is_connected = false
        await supabase
          .from("wuzapi_instances")
          .update({
            is_connected: false,
            phone_number: null
          })
          .eq("id", selectedInstanceId);
        
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

      // 🔥 ATUALIZAR BANCO - is_connected = false
      console.log("📴 Atualizando banco: is_connected = false");
      const { error: updateError } = await supabase
        .from("wuzapi_instances")
        .update({
          is_connected: false,
          phone_number: null,
          connected_at: null
        })
        .eq("id", selectedInstanceId);
      
      if (updateError) {
        console.error("❌ Erro ao atualizar banco:", updateError);
      } else {
        console.log("✅ Banco atualizado! is_connected = false");
      }

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
        loadInstances(); // Atualizar lista mesmo assim
      }
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      
      // 🔥 ATUALIZAR BANCO mesmo em caso de erro
      await supabase
        .from("wuzapi_instances")
        .update({
          is_connected: false,
          phone_number: null
        })
        .eq("id", selectedInstanceId);
      
      setStatus({
        connected: false,
        phone_number: null,
        instance_name: status.instance_name
      });
      setQrCode(null);
      toast.warning("Desconectado localmente");
      loadInstances();
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
  // Em alguns cenários (ex: modal / cache), o status local pode demorar a sincronizar.
  // Então consideramos conectado se o banco indica conexão.
  const isConnected = Boolean(status.connected || selectedInstance?.is_connected);
  const connectedPhone = status.phone_number ?? selectedInstance?.phone_number ?? null;

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
    <div className="space-y-4">
      {/* Card principal de conexão */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${status.connected ? "bg-green-500/20" : "bg-muted"}`}>
                <Smartphone className={`h-5 w-5 ${status.connected ? "text-green-500" : "text-muted-foreground"}`} />
              </div>
              <div>
                <CardTitle className="text-lg">📱 Conectar WhatsApp</CardTitle>
                <CardDescription>
                  Conecte seu WhatsApp para enviar mensagens
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-500" : ""}>
              {isConnected ? (
                <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
              ) : (
                <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
              )}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Seletor de instância */}
          {instances.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecionar Instância:</label>
              <Select value={selectedInstanceId || ""} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.instance_name} (porta {inst.port}) {inst.is_connected ? "✅" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Instância selecionada */}
          {selectedInstance && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium">
                Instância: <span className="text-primary">{selectedInstance.instance_name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Porta: {selectedInstance.port}
              </p>
            </div>
          )}

          {/* Status conectado */}
          {isConnected && (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">WhatsApp Conectado</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPhone(connectedPhone)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => checkStatus()}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Atualizar Status
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </div>
            </div>
          )}

          {/* QR Code */}
          {qrCode && !isConnected && (
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
          {!isConnected && !qrCode && selectedInstanceId && (
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
              <RefreshCw className="h-4 w-4 mr-1" />
              Recarregar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
