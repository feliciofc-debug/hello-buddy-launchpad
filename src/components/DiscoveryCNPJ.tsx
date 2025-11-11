import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

interface DiscoveryCNPJProps {
  concessionariaId: string;
}

export default function DiscoveryCNPJ({ concessionariaId }: DiscoveryCNPJProps) {
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDiscover = async () => {
    if (!cnpj) {
      toast.error("Digite um CNPJ válido");
      return;
    }

    setLoading(true);
    console.log("🔍 Discovering CNPJ:", cnpj);

    try {
      const { data, error } = await supabase.functions.invoke('discovery-cnpj', {
        body: { 
          cnpj: cnpj.replace(/\D/g, ''),
          concessionaria_id: concessionariaId 
        }
      });

      if (error) throw error;

      toast.success(`✅ Empresa descoberta! ${data.socios.length} sócios encontrados`);
      console.log("Discovery result:", data);
      
      setCnpj("");
    } catch (error: any) {
      console.error("Discovery error:", error);
      toast.error(error.message || "Erro ao buscar empresa");
    } finally {
      setLoading(false);
    }
  };

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/);
    if (match) {
      return `${match[1]}.${match[2]}.${match[3]}/${match[4]}-${match[5]}`;
    }
    return value;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Descobrir Empresa
        </CardTitle>
        <CardDescription>
          Digite um CNPJ para buscar empresa e sócios automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
            maxLength={18}
            disabled={loading}
          />
          <Button 
            onClick={handleDiscover}
            disabled={loading || !cnpj}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              "Buscar"
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          A busca pode levar alguns segundos. Os sócios serão enriquecidos automaticamente.
        </p>
      </CardContent>
    </Card>
  );
}