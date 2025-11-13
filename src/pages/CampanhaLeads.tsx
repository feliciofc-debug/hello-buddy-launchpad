import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LeadsList } from '@/components/leads/LeadsList';

export default function CampanhaLeads() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/campanhas-prospeccao')} 
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Campanhas
          </Button>
          <h1 className="text-3xl font-bold mb-2">Leads da Campanha</h1>
          <p className="text-muted-foreground">
            Gerencie e enriqueça seus leads descobertos
          </p>
        </div>

        {/* Lista de Leads com Enriquecimento */}
        {id && <LeadsList campanhaId={id} />}
      </div>
    </div>
  );
}
