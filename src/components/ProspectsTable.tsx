import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MessageSquare, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Prospect {
  id: string;
  score: number;
  recomendacao: string;
  justificativa: string;
  insights: string[];
  socio: {
    nome: string;
    qualificacao: string;
    patrimonio_estimado: number;
    empresa: {
      nome_fantasia: string;
      municipio: string;
      uf: string;
    };
  };
}

interface ProspectsTableProps {
  concessionariaId: string;
}

export default function ProspectsTable({ concessionariaId }: ProspectsTableProps) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    loadProspects();
  }, [concessionariaId]);

  const loadProspects = async () => {
    try {
      const { data, error } = await supabase
        .from('prospects_qualificados')
        .select(`
          *,
          socio:socios(
            nome,
            qualificacao,
            patrimonio_estimado,
            empresa:empresas(nome_fantasia, municipio, uf)
          )
        `)
        .eq('concessionaria_id', concessionariaId)
        .order('score', { ascending: false });

      if (error) throw error;
      setProspects(data || []);
    } catch (error: any) {
      console.error("Error loading prospects:", error);
      toast.error("Erro ao carregar prospects");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMessages = async (prospectId: string) => {
    setGenerating(prospectId);
    console.log("✍️ Generating messages for:", prospectId);

    try {
      const { data, error } = await supabase.functions.invoke('generate-message', {
        body: { prospect_id: prospectId }
      });

      if (error) throw error;

      toast.success("✅ Mensagens geradas com sucesso!");
      console.log("Generated messages:", data);
    } catch (error: any) {
      console.error("Error generating messages:", error);
      toast.error(error.message || "Erro ao gerar mensagens");
    } finally {
      setGenerating(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getRecomendacaoVariant = (rec: string) => {
    if (rec === "contatar_agora") return "default";
    if (rec === "aguardar") return "secondary";
    return "outline";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Prospects Qualificados ({prospects.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Patrimônio</TableHead>
              <TableHead>Recomendação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prospects.map((prospect) => (
              <TableRow key={prospect.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{prospect.socio.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {prospect.socio.qualificacao}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {prospect.socio.empresa.nome_fantasia}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {prospect.socio.empresa.municipio}, {prospect.socio.empresa.uf}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${getScoreColor(prospect.score)}`} />
                    <span className="font-bold">{prospect.score}</span>
                  </div>
                </TableCell>
                <TableCell>
                  R$ {(prospect.socio.patrimonio_estimado || 0).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell>
                  <Badge variant={getRecomendacaoVariant(prospect.recomendacao)}>
                    {prospect.recomendacao.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => handleGenerateMessages(prospect.id)}
                    disabled={generating === prospect.id}
                  >
                    {generating === prospect.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Gerar Mensagens
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}