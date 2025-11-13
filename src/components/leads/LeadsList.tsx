import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Linkedin, 
  Instagram, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Briefcase,
  Sparkles
} from "lucide-react";
import { EnrichLeadsButton } from "./EnrichLeadsButton";

interface Lead {
  id: string;
  tipo: "b2c" | "b2b";
  // B2C
  nome_completo?: string;
  profissao?: string;
  especialidade?: string;
  // B2B
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  setor?: string;
  porte?: string;
  // Comum
  cidade: string;
  estado: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  linkedin_url?: string;
  instagram_username?: string;
  pipeline_status: string;
  score?: number;
  enriched_at?: string;
  sinais_poder_aquisitivo?: string[];
  created_at: string;
}

interface LeadsListProps {
  campanhaId: string;
}

export function LeadsList({ campanhaId }: LeadsListProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "b2c" | "b2b">("todos");

  const loadLeads = async () => {
    try {
      setLoading(true);

      // Buscar leads B2C
      const { data: b2cData, error: b2cError } = await supabase
        .from("leads_b2c")
        .select("*")
        .eq("campanha_id", campanhaId)
        .order("created_at", { ascending: false });

      // Buscar leads B2B
      const { data: b2bData, error: b2bError } = await supabase
        .from("leads_b2b")
        .select("*")
        .eq("campanha_id", campanhaId)
        .order("created_at", { ascending: false });

      if (b2cError) throw b2cError;
      if (b2bError) throw b2bError;

      const allLeads: Lead[] = [
        ...(b2cData || []).map(l => ({ ...l, tipo: "b2c" as const })),
        ...(b2bData || []).map(l => ({ ...l, tipo: "b2b" as const })),
      ];

      setLeads(allLeads);
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();

    // Subscrever a mudanças em tempo real
    const channelB2C = supabase
      .channel("leads_b2c_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads_b2c",
          filter: `campanha_id=eq.${campanhaId}`,
        },
        () => loadLeads()
      )
      .subscribe();

    const channelB2B = supabase
      .channel("leads_b2b_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads_b2b",
          filter: `campanha_id=eq.${campanhaId}`,
        },
        () => loadLeads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelB2C);
      supabase.removeChannel(channelB2B);
    };
  }, [campanhaId]);

  const filteredLeads = leads.filter(lead => {
    if (filter === "todos") return true;
    return lead.tipo === filter;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      descoberto: "bg-gray-500",
      enriquecido: "bg-blue-500",
      qualificado: "bg-green-500",
      quente: "bg-orange-500",
      enviado: "bg-purple-500",
      respondeu: "bg-pink-500",
      convertido: "bg-emerald-500",
    };
    return colors[status] || "bg-gray-500";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com filtros e ações */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={filter === "todos" ? "default" : "outline"}
            onClick={() => setFilter("todos")}
            size="sm"
          >
            Todos ({leads.length})
          </Button>
          <Button
            variant={filter === "b2c" ? "default" : "outline"}
            onClick={() => setFilter("b2c")}
            size="sm"
          >
            B2C ({leads.filter(l => l.tipo === "b2c").length})
          </Button>
          <Button
            variant={filter === "b2b" ? "default" : "outline"}
            onClick={() => setFilter("b2b")}
            size="sm"
          >
            B2B ({leads.filter(l => l.tipo === "b2b").length})
          </Button>
        </div>

        <EnrichLeadsButton 
          campanhaId={campanhaId}
          onEnrichComplete={loadLeads}
        />
      </div>

      {/* Lista de leads */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeads.map((lead) => (
          <Card key={lead.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {lead.tipo === "b2c" ? lead.nome_completo : lead.razao_social}
                  </CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{lead.tipo.toUpperCase()}</Badge>
                    <Badge className={getStatusColor(lead.pipeline_status)}>
                      {lead.pipeline_status}
                    </Badge>
                    {lead.score && (
                      <Badge variant="secondary">
                        Score: {lead.score}
                      </Badge>
                    )}
                  </div>
                </div>
                {lead.enriched_at && (
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Informações principais */}
              {lead.tipo === "b2c" ? (
                <>
                  {lead.profissao && (
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.profissao}</span>
                    </div>
                  )}
                  {lead.especialidade && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{lead.especialidade}</Badge>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {lead.cnpj && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{lead.cnpj}</span>
                    </div>
                  )}
                  {lead.setor && (
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.setor}</span>
                    </div>
                  )}
                  {lead.porte && (
                    <Badge variant="outline">{lead.porte}</Badge>
                  )}
                </>
              )}

              {/* Localização */}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{lead.cidade}, {lead.estado}</span>
              </div>

              {/* Contatos */}
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`mailto:${lead.email}`}
                    className="text-blue-600 hover:underline truncate"
                  >
                    {lead.email}
                  </a>
                </div>
              )}

              {lead.telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.telefone}</span>
                  {lead.whatsapp && (
                    <Badge variant="secondary" className="ml-auto">WhatsApp</Badge>
                  )}
                </div>
              )}

              {/* Redes sociais */}
              <div className="flex gap-2 pt-2 border-t">
                {lead.linkedin_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 px-2"
                  >
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  </Button>
                )}

                {lead.instagram_username && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 px-2"
                  >
                    <a
                      href={`https://instagram.com/${lead.instagram_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Instagram className="h-4 w-4" />
                    </a>
                  </Button>
                )}

                {!lead.enriched_at && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    Aguardando enriquecimento
                  </Badge>
                )}
              </div>

              {/* Sinais de poder aquisitivo */}
              {lead.sinais_poder_aquisitivo && lead.sinais_poder_aquisitivo.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold mb-1">Sinais detectados:</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.sinais_poder_aquisitivo.map((sinal, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {sinal}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredLeads.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nenhum lead encontrado para esta campanha.
          </p>
        </div>
      )}
    </div>
  );
}
