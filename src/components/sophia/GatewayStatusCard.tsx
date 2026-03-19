import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Clock } from "lucide-react";

interface Props {
  userId: string;
}

export function GatewayStatusCard({ userId }: Props) {
  const [status, setStatus] = useState<string>("offline");
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const fetchStatus = async () => {
    const { data } = await supabase
      .from("gateway_status")
      .select("*")
      .eq("user_id", userId)
      .order("last_heartbeat", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      // Se o heartbeat tem mais de 2 minutos, considerar offline
      const lastBeat = new Date(data.last_heartbeat).getTime();
      const now = Date.now();
      const isStale = now - lastBeat > 2 * 60 * 1000;

      setStatus(isStale ? "offline" : (data as any).status || "offline");
      setLastHeartbeat(data.last_heartbeat);
      setPhoneNumber((data as any).phone_number);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Realtime subscription
    const channel = supabase
      .channel("gateway-status-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gateway_status", filter: `user_id=eq.${userId}` },
        () => fetchStatus()
      )
      .subscribe();

    // Poll every 30s as fallback
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId]);

  const isOnline = status === "online" || status === "connected";
  const isQrPending = status === "qr_pending";

  const formatTime = (iso: string | null) => {
    if (!iso) return "Nunca";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-destructive" />
          )}
          Status do Gateway
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge
            variant={isOnline ? "default" : isQrPending ? "secondary" : "destructive"}
            className={isOnline ? "bg-green-500 hover:bg-green-600" : ""}
          >
            {isOnline ? "🟢 Online" : isQrPending ? "📱 Aguardando QR" : "🔴 Offline"}
          </Badge>
        </div>

        {phoneNumber && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Número</span>
            <span className="text-sm font-mono">{phoneNumber}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Último heartbeat
          </span>
          <span className="text-sm">{formatTime(lastHeartbeat)}</span>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          O .exe no PC do operador reporta o status automaticamente.
          Se estiver offline, verifique se o amz-dispatcher está rodando.
        </div>
      </CardContent>
    </Card>
  );
}
