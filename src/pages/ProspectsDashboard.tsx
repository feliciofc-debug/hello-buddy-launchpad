import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, MessageSquare, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function ProspectsDashboard() {
  const concessionariaId = "temp-uuid-here";

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard de Prospects</h1>
        <p className="text-muted-foreground">
          Sistema inteligente de qualificação e abordagem de leads premium
        </p>
      </div>

      <Card className="p-6">
        <p className="text-muted-foreground">
          As tabelas do banco de dados precisam ser criadas primeiro. 
          Entre em contato com o suporte para configurar o sistema.
        </p>
      </Card>
    </div>
  );
}