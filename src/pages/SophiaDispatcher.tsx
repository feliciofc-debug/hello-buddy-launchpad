import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GatewayStatusCard } from "@/components/sophia/GatewayStatusCard";
import { FilaContadores } from "@/components/sophia/FilaContadores";
import { HistoricoEnvios } from "@/components/sophia/HistoricoEnvios";
import { CampanhasList } from "@/components/sophia/CampanhasList";
import { Button } from "@/components/ui/button";
import { Send, BarChart3, Megaphone, Package } from "lucide-react";

export default function SophiaDispatcher() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate("/login");
      else setUser(user);
    });
  }, [navigate]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Send className="h-6 w-6 text-primary" />
              Sophia Dispatcher
            </h1>
            <p className="text-sm text-muted-foreground">
              Controle de envios via Gateway local (IP residencial)
            </p>
          </div>
          <Button onClick={() => navigate("/meus-produtos")} className="gap-2">
            <Package className="h-4 w-4" />
            Ir para Produtos
          </Button>
        </div>

        {/* Gateway Status + Contadores */}
        <div className="grid md:grid-cols-2 gap-6">
          <GatewayStatusCard userId={user.id} />
          <FilaContadores userId={user.id} />
        </div>

        {/* Tabs: Campanhas e Histórico */}
        <Tabs defaultValue="campanhas" className="w-full">
          <TabsList>
            <TabsTrigger value="campanhas" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Histórico de Envios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas">
            <CampanhasList userId={user.id} />
          </TabsContent>

          <TabsContent value="historico">
            <HistoricoEnvios userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
