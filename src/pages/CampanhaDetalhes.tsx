import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Linkedin, Instagram, Facebook, Mail, Phone, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Lead {
  id: string;
  nome_profissional?: string;
  razao_social?: string;
  profissao?: string;
  cidade?: string;
  estado?: string;
  linkedin_url?: string;
  instagram_username?: string;
  facebook_url?: string;
  telefone?: string;
  email?: string;
  status: string;
  created_at: string;
  enriched_at?: string;
}

interface Campanha {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  status: string;
  stats: any;
}

export default function CampanhaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar campanha
      const { data: campanhaData, error: campanhaError } = await supabase
        .from('campanhas_prospeccao')
        .select('*')
        .eq('id', id)
        .single();

      if (campanhaError) throw campanhaError;
      setCampanha(campanhaData);

      // Buscar leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads_descobertos')
        .select('*')
        .eq('campanha_id', id)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      toast.error(error.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline", label: string }> = {
      descoberto: { variant: "secondary", label: "Descoberto" },
      enriquecendo: { variant: "outline", label: "Enriquecendo..." },
      enriquecido: { variant: "default", label: "Enriquecido" },
      qualificado: { variant: "default", label: "Qualificado" }
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!campanha) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Campanha não encontrada</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/campanhas-prospeccao')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{campanha.nome}</CardTitle>
              {campanha.descricao && (
                <CardDescription className="mt-2">{campanha.descricao}</CardDescription>
              )}
            </div>
            <Badge variant={campanha.status === 'ativa' ? 'default' : 'secondary'}>
              {campanha.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Descobertos</p>
              <p className="text-2xl font-bold">{campanha.stats?.descobertos || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Enriquecidos</p>
              <p className="text-2xl font-bold">{campanha.stats?.enriquecidos || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Qualificados</p>
              <p className="text-2xl font-bold">{campanha.stats?.qualificados || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <p className="text-2xl font-bold uppercase">{campanha.tipo}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads Descobertos ({leads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum lead descoberto ainda
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Profissão</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Redes Sociais</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.nome_profissional || lead.razao_social || 'N/A'}
                      </TableCell>
                      <TableCell>{lead.profissao || 'N/A'}</TableCell>
                      <TableCell>
                        {lead.cidade && lead.estado ? `${lead.cidade}, ${lead.estado}` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {lead.linkedin_url && (
                            <a 
                              href={lead.linkedin_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <Linkedin className="h-5 w-5" />
                            </a>
                          )}
                          {lead.instagram_username && (
                            <a 
                              href={`https://instagram.com/${lead.instagram_username}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <Instagram className="h-5 w-5" />
                            </a>
                          )}
                          {lead.facebook_url && (
                            <a 
                              href={lead.facebook_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <Facebook className="h-5 w-5" />
                            </a>
                          )}
                          {!lead.linkedin_url && !lead.instagram_username && !lead.facebook_url && (
                            <span className="text-muted-foreground text-sm">Nenhuma</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
