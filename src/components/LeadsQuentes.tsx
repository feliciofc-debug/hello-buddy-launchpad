import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Lead {
  id: string;
  phone: string;
  produto_nome: string;
  mensagem_cliente: string;
  status: string;
  visualizado: boolean;
  created_at: string;
}

export function LeadsQuentes() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarLeads();
    
    // Recarregar a cada 30 segundos
    const interval = setInterval(carregarLeads, 30000);
    return () => clearInterval(interval);
  }, []);

  const carregarLeads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('lead_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('visualizado', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const marcarVisualizado = async (id: string) => {
    try {
      const { error } = await supabase
        .from('lead_notifications')
        .update({ visualizado: true })
        .eq('id', id);

      if (error) throw error;

      toast.success('Lead marcado como visualizado');
      carregarLeads();
    } catch (error) {
      console.error('Erro ao marcar lead:', error);
      toast.error('Erro ao marcar lead');
    }
  };

  const abrirWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🔥 Leads Quentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando leads...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔥 Leads Quentes
          {leads.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {leads.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">Nenhum lead quente no momento</p>
            <p className="text-sm text-muted-foreground">
              Leads aparecem aqui quando clientes demonstram interesse em comprar
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone size={16} className="text-muted-foreground" />
                      <p className="font-medium">{lead.phone}</p>
                      <Badge className="bg-orange-500 hover:bg-orange-600">
                        🔥 Quente
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Produto: <span className="font-medium text-foreground">{lead.produto_nome}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(lead.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded p-3 mb-3">
                  <p className="text-sm">
                    <span className="font-medium">Cliente disse:</span><br />
                    "{lead.mensagem_cliente}"
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => abrirWhatsApp(lead.phone)}
                    className="flex-1"
                  >
                    <ExternalLink size={16} className="mr-2" />
                    Responder no WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => marcarVisualizado(lead.id)}
                  >
                    <Check size={16} className="mr-2" />
                    Marcar Lido
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}