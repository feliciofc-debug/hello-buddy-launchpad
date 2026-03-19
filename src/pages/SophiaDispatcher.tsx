import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GatewayStatusCard } from "@/components/sophia/GatewayStatusCard";
import { FilaContadores } from "@/components/sophia/FilaContadores";
import { IniciarCampanhaModal } from "@/components/sophia/IniciarCampanhaModal";
import { HistoricoEnvios } from "@/components/sophia/HistoricoEnvios";
import { CampanhasList } from "@/components/sophia/CampanhasList";
import { Wifi, Send, BarChart3, Megaphone } from "lucide-react";

export default function SophiaDispatcher() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showCampanhaModal, setShowCampanhaModal] = useState(false);

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
          <Button onClick={() => setShowCampanhaModal(true)} className="gap-2">
            <Megaphone className="h-4 w-4" />
            Nova Campanha
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

        {/* Modal Nova Campanha */}
        <IniciarCampanhaModal
          open={showCampanhaModal}
          onClose={() => setShowCampanhaModal(false)}
          userId={user.id}
        />
      </div>
    </div>
  );
}
