import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CampanhaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/campanhas-prospeccao')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <h1 className="text-3xl font-bold mb-4">
        Detalhes da Campanha
      </h1>

      <p className="text-muted-foreground">
        Campanha ID: {id}
      </p>

      <div className="mt-8 p-8 border rounded-lg">
        <p className="text-center text-muted-foreground">
          Página em construção
        </p>
      </div>
    </div>
  );
}
