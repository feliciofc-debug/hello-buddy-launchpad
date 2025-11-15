import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Search, MapPin, Briefcase, User, Phone, Mail, Linkedin, Instagram } from "lucide-react";

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600 bg-green-50 dark:bg-green-950';
  if (score >= 50) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
  return 'text-gray-600 bg-gray-50 dark:bg-gray-950';
};

const getScoreEmoji = (score: number) => {
  if (score >= 80) return '🔥';
  if (score >= 50) return '🟡';
  return '❄️';
};

export default function LeadsDescobertos() {
  const navigate = useNavigate();
  const { campanhaId } = useParams();
  const [leads, setLeads] = useState<any[]>([]);
  const [campanha, setCampanha] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    loadData();
  }, [campanhaId]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Carregar campanha
      const { data: campanhaData, error: campanhaError } = await supabase
        .from('campanhas_prospeccao')
        .select('*, icp_configs(*)')
        .eq('id', campanhaId)
        .single();

      if (campanhaError) throw campanhaError;
      setCampanha(campanhaData);

      // Carregar leads da tabela correta
      const tabela = campanhaData.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
      const { data: leadsData, error: leadsError } = await supabase
        .from(tabela)
        .select('*')
        .eq('campanha_id', campanhaId)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.nome_profissional?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.profissao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.razao_social?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "todos" || lead.pipeline_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      descoberto: { variant: "secondary", label: "Descoberto" },
      enriquecido: { variant: "default", label: "Enriquecido" },
      qualificado: { variant: "default", label: "Qualificado" },
      quente: { variant: "default", label: "Quente" },
      enviado: { variant: "default", label: "Enviado" },
      respondeu: { variant: "default", label: "Respondeu" },
      convertido: { variant: "default", label: "Convertido" },
    };
    const config = variants[status] || variants.descoberto;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(`/campanhas/${campanhaId}`)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Campanha
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Leads Descobertos</h1>
          <p className="text-muted-foreground">
            Campanha: <strong>{campanha?.nome}</strong> • Total: <strong>{leads.length}</strong> leads
          </p>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, profissão, cidade..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="descoberto">Descoberto</SelectItem>
                  <SelectItem value="enriquecido">Enriquecido</SelectItem>
                  <SelectItem value="qualificado">Qualificado</SelectItem>
                  <SelectItem value="quente">Quente</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="respondeu">Respondeu</SelectItem>
                  <SelectItem value="convertido">Convertido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Leads */}
        <div className="grid gap-4">
          {filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Nenhum lead encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredLeads.map((lead) => (
              <Card key={lead.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">
                          {lead.nome_completo || lead.nome_profissional || lead.razao_social || "Nome não informado"}
                        </CardTitle>
                        {getStatusBadge(lead.pipeline_status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        {lead.profissao && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            <span>{lead.profissao}</span>
                            {lead.especialidade && <span className="text-xs">• {lead.especialidade}</span>}
                          </div>
                        )}
                        
                        {(lead.cidade || lead.estado) && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{lead.cidade || ""} {lead.estado || ""}</span>
                          </div>
                        )}

                        {lead.cnpj && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>CNPJ: {lead.cnpj}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {/* Informações de Contato */}
                    {(lead.telefone || lead.email || lead.linkedin_url || lead.instagram_username) && (
                      <div>
                        <p className="text-sm font-medium mb-2">Contato:</p>
                        <div className="flex flex-wrap gap-2">
                          {lead.telefone && (
                            <Badge variant="outline" className="gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </Badge>
                          )}
                          {lead.email && (
                            <Badge variant="outline" className="gap-1">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </Badge>
                          )}
                          {lead.linkedin_url && (
                            <Badge variant="outline" className="gap-1">
                              <Linkedin className="h-3 w-3" />
                              LinkedIn
                            </Badge>
                          )}
                          {lead.instagram_username && (
                            <Badge variant="outline" className="gap-1">
                              <Instagram className="h-3 w-3" />
                              @{lead.instagram_username}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Score */}
                    {lead.score && (
                      <div>
                        <p className="text-sm font-medium mb-2">Score de Qualificação:</p>
                        <div className="flex items-center gap-3">
                          <Badge className={`text-lg font-bold ${getScoreColor(lead.score)}`}>
                            {getScoreEmoji(lead.score)} {lead.score}/100
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {lead.score >= 80 ? 'Lead Quente' : lead.score >= 50 ? 'Lead Morno' : 'Lead Frio'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Justificativa */}
                    {lead.justificativa && (
                      <div>
                        <p className="text-sm font-medium mb-1">Justificativa:</p>
                        <p className="text-sm text-muted-foreground">{lead.justificativa}</p>
                      </div>
                    )}

                    {/* Fonte */}
                    {lead.fonte && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Fonte: <span className="font-medium">{lead.fonte}</span>
                          {lead.query_usada && <span className="ml-2">• Query: "{lead.query_usada}"</span>}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Resumo */}
        {filteredLeads.length > 0 && (
          <Card className="mt-6">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                Mostrando {filteredLeads.length} de {leads.length} leads
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
