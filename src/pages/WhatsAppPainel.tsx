import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle, Users, Send, Smartphone, BookOpen, Megaphone, Loader2 } from "lucide-react";

export default function WhatsAppPainel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ enviadas: 0, grupos: 0, campanhasAtivas: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count: enviadas } = await supabase
        .from("fila_atendimento_pj" as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "enviado");

      const { count: campanhas } = await supabase
        .from("campanhas_recorrentes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("ativa", true);

      setStats({
        enviadas: enviadas || 0,
        grupos: 0,
        campanhasAtivas: campanhas || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Button onClick={() => navigate("/dashboard")} variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
        <p className="text-muted-foreground">Gerencie campanhas e envios via WhatsApp</p>
      </div>

      {/* Status do agente */}
      <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <Smartphone className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Agente WhatsApp</p>
            <p className="text-sm text-muted-foreground">
              O agente local (.exe) deve estar rodando no seu computador para enviar mensagens
            </p>
          </div>
          <Badge variant="secondary">Verificar no desktop</Badge>
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.enviadas}</p>
              <p className="text-sm text-muted-foreground">Mensagens enviadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.grupos}</p>
              <p className="text-sm text-muted-foreground">Grupos configurados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.campanhasAtivas}</p>
              <p className="text-sm text-muted-foreground">Campanhas ativas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/pj/listas-contatos")}>
          <CardContent className="p-6 flex items-center gap-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">Listas e Contatos</p>
              <p className="text-sm text-muted-foreground">Gerencie seus contatos e listas de envio</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/campanhas")}>
          <CardContent className="p-6 flex items-center gap-4">
            <Megaphone className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">Campanhas</p>
              <p className="text-sm text-muted-foreground">Crie e gerencie campanhas de envio</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
