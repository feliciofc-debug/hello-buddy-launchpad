import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MessageSquare, TrendingUp, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const PIPELINE_STAGES = [
  { id: 'descoberto', label: 'Descoberto', color: 'bg-gray-500' },
  { id: 'enriquecido', label: 'Enriquecido', color: 'bg-blue-500' },
  { id: 'qualificado', label: 'Qualificado', color: 'bg-purple-500' },
  { id: 'mensagem_gerada', label: 'Mensagem Gerada', color: 'bg-yellow-500' },
  { id: 'enviado', label: 'Enviado', color: 'bg-orange-500' },
  { id: 'respondeu', label: 'Respondeu', color: 'bg-green-500' },
  { id: 'convertido', label: 'Convertido', color: 'bg-emerald-600' }
];

interface Lead {
  id: string;
  nome_completo?: string;
  razao_social?: string;
  nome_fantasia?: string;
  profissao?: string;
  setor?: string;
  telefone?: string;
  email?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  score?: number;
  pipeline_status: string;
  tipo?: 'b2c' | 'b2b';
}

export default function LeadsFunil() {
  const [leadsB2C, setLeadsB2C] = useState<Lead[]>([]);
  const [leadsB2B, setLeadsB2B] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    const [b2c, b2b] = await Promise.all([
      supabase.from('leads_b2c').select('*').order('created_at', { ascending: false }),
      supabase.from('leads_b2b').select('*').order('created_at', { ascending: false })
    ]);
    
    setLeadsB2C(b2c.data || []);
    setLeadsB2B(b2b.data || []);
    setLoading(false);
  };

  const handleDragStart = (lead: Lead, tipo: 'b2c' | 'b2b') => {
    setDraggedLead({ ...lead, tipo });
  };

  const handleDrop = async (novoStatus: string) => {
    if (!draggedLead) return;

    const tabela = draggedLead.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
    
    await supabase
      .from(tabela)
      .update({ pipeline_status: novoStatus })
      .eq('id', draggedLead.id);

    toast.success('Lead movido!');
    loadLeads();
    setDraggedLead(null);
  };

  const getLeadsPorStatus = (status: string): Lead[] => {
    const b2c = leadsB2C.filter(l => l.pipeline_status === status);
    const b2b = leadsB2B.filter(l => l.pipeline_status === status);
    return [...b2c.map(l => ({ ...l, tipo: 'b2c' as const })), ...b2b.map(l => ({ ...l, tipo: 'b2b' as const }))];
  };

  const getTemperatura = (score: number) => {
    if (score >= 70) return { emoji: '🔥', label: 'Quente', color: 'text-red-500' };
    if (score >= 40) return { emoji: '🟡', label: 'Morno', color: 'text-yellow-500' };
    return { emoji: '❄️', label: 'Frio', color: 'text-blue-500' };
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 h-screen overflow-hidden bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">🎯 Funil de Leads</h1>
            <p className="text-muted-foreground">Pipeline visual de prospecção</p>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>B2C: {leadsB2C.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>B2B: {leadsB2B.length}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-180px)]">
        {PIPELINE_STAGES.map(stage => {
          const leads = getLeadsPorStatus(stage.id);
          
          return (
            <div 
              key={stage.id}
              className="flex-shrink-0 w-80"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
            >
              <div className={`${stage.color} text-white p-3 rounded-t-lg`}>
                <h3 className="font-semibold">{stage.label}</h3>
                <p className="text-xs opacity-90">{leads.length} leads</p>
              </div>
              
              <div className="bg-muted/30 p-2 space-y-2 rounded-b-lg min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto border border-t-0 border-border">
                {leads.map(lead => {
                  const temp = getTemperatura(lead.score || 0);
                  const nome = lead.nome_completo || lead.razao_social || lead.nome_fantasia;
                  
                  return (
                    <Card
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead, lead.tipo!)}
                      className="p-3 cursor-move hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm truncate">{nome}</p>
                          {lead.profissao && (
                            <p className="text-xs text-muted-foreground">{lead.profissao}</p>
                          )}
                          {lead.setor && (
                            <p className="text-xs text-muted-foreground">{lead.setor}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={temp.color}>
                          {temp.emoji} {lead.score || 0}
                        </Badge>
                      </div>

                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {lead.telefone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.telefone.slice(-4)}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Email
                          </div>
                        )}
                        {lead.whatsapp && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            WhatsApp
                          </div>
                        )}
                      </div>

                      {lead.tipo === 'b2c' && lead.cidade && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📍 {lead.cidade}/{lead.estado}
                        </p>
                      )}

                      <div className="mt-2">
                        <Badge variant={lead.tipo === 'b2c' ? 'default' : 'secondary'} className="text-xs">
                          {lead.tipo?.toUpperCase()}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}

                {leads.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Nenhum lead nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
