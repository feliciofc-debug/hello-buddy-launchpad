import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DiscoveryCNPJ from "@/components/DiscoveryCNPJ";
import ProspectsTable from "@/components/ProspectsTable";
import MessagesReview from "@/components/MessagesReview";
import { Building2, MessageSquare, TrendingUp } from "lucide-react";

export default function ProspectsDashboard() {
  // Em produção, pegar do contexto/auth
  const concessionariaId = "temp-uuid-here";

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard de Prospects</h1>
        <p className="text-muted-foreground">
          Sistema inteligente de qualificação e abordagem de leads premium
        </p>
      </div>

      <Tabs defaultValue="discover" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="discover" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Descobrir
          </TabsTrigger>
          <TabsTrigger value="prospects" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Prospects
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensagens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover">
          <DiscoveryCNPJ concessionariaId={concessionariaId} />
        </TabsContent>

        <TabsContent value="prospects">
          <ProspectsTable concessionariaId={concessionariaId} />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesReview concessionariaId={concessionariaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}