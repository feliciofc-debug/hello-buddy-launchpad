import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Recado {
  id: string;
  content: string;
  wamid: string | null;
  created_at: string;
}

export default function RecadosResponsavel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ownerPhone, setOwnerPhone] = useState<string>("");
  const [ownerName, setOwnerName] = useState<string>("");
  const [recados, setRecados] = useState<Recado[]>([]);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: cfg } = await supabase
        .from("whatsapp_cloud_agent_config")
        .select("owner_phone, owner_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cfg?.owner_phone) {
        setOwnerPhone("");
        setRecados([]);
        return;
      }
      setOwnerPhone(cfg.owner_phone);
      setOwnerName(cfg.owner_name || "Responsável");

      const { data: conv } = await supabase
        .from("whatsapp_cloud_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("contact_number", cfg.owner_phone)
        .maybeSingle();

      if (!conv?.id) {
        setRecados([]);
        return;
      }

      const { data: msgs, error } = await supabase
        .from("whatsapp_cloud_messages")
        .select("id, content, wamid, created_at")
        .eq("conversation_id", conv.id)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRecados((msgs as Recado[]) || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar recados: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 30_000);
    return () => clearInterval(interval);
  }, []);

  const formatarData = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Recados enviados ao {ownerName || "Responsável"}</h1>
              <p className="text-sm text-muted-foreground">
                Todos os recados que o Silvester encaminhou pelo WhatsApp{" "}
                {ownerPhone && <span className="font-mono">({ownerPhone})</span>}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {!ownerPhone && !loading && (
          <Card className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p className="font-medium">Nenhum responsável configurado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Configure o telefone do responsável em Configurações do Agente WhatsApp para que o Silvester encaminhe recados automaticamente.
            </p>
            <Button className="mt-4" onClick={() => navigate("/config-agente-whatsapp")}>
              Configurar agora
            </Button>
          </Card>
        )}

        {ownerPhone && recados.length === 0 && !loading && (
          <Card className="p-6 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum recado encaminhado ainda.
          </Card>
        )}

        <div className="space-y-3">
          {recados.map((r) => {
            const isFoto = /\[foto anexada\]/i.test(r.content);
            const textoLimpo = r.content.replace(/\n\n\[foto anexada\]$/i, "");
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.wamid ? (
                      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Entregue ao WhatsApp
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" /> Falha no envio
                      </Badge>
                    )}
                    {isFoto && <Badge variant="secondary">📎 Com foto</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatarData(r.created_at)}</span>
                </div>
                <pre className="whitespace-pre-wrap text-sm font-sans text-foreground leading-relaxed">
                  {textoLimpo}
                </pre>
                {r.wamid && (
                  <p className="text-[10px] text-muted-foreground mt-2 font-mono opacity-60">
                    ID: {r.wamid}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
