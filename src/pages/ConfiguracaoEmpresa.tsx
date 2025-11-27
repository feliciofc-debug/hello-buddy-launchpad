import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SEGMENTOS_EMPRESA } from '@/lib/segments';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Target, Bot, Save } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ConfiguracaoEmpresa() {
  const [segmentoSelecionado, setSegmentoSelecionado] = useState('outros');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    carregarConfig();
  }, []);

  const carregarConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('empresa_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setSegmentoSelecionado(data.segmento || 'outros');
        setNomeEmpresa(data.nome_empresa || '');
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const salvarConfig = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { error } = await supabase
        .from('empresa_config')
        .upsert({
          user_id: user.id,
          segmento: segmentoSelecionado,
          nome_empresa: nomeEmpresa,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Erro ao salvar:', error);
        toast.error('Erro ao salvar configuração');
      } else {
        toast.success('✅ Configuração salva com sucesso!');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const segmento = SEGMENTOS_EMPRESA.find(s => s.id === segmentoSelecionado);

  if (loadingData) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-40 bg-muted rounded"></div>
          <div className="h-60 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">⚙️ Configuração da Empresa</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Dados da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da Empresa</Label>
            <Input
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Ex: Mercado Central, Tech Solutions"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Segmento de Atuação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            A IA vai adaptar automaticamente o tom e vocabulário baseado no seu segmento
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SEGMENTOS_EMPRESA.map(seg => (
              <div
                key={seg.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  segmentoSelecionado === seg.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSegmentoSelecionado(seg.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={segmentoSelecionado === seg.id}
                    onChange={() => setSegmentoSelecionado(seg.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-lg mb-1">{seg.nome}</p>
                    <p className="text-sm text-muted-foreground">{seg.descricao}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {segmento && (
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Como a IA vai atender
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium mb-1">📝 Estilo de Atendimento:</p>
              <p className="text-sm text-muted-foreground">{segmento.estilo_venda}</p>
            </div>
            <div>
              <p className="font-medium mb-1">💬 Tom de Conversa:</p>
              <p className="text-sm capitalize text-muted-foreground">{segmento.tom.replace('-', ' ')}</p>
            </div>
            <div>
              <p className="font-medium mb-1">🔤 Vocabulário Típico:</p>
              <div className="flex flex-wrap gap-2">
                {segmento.vocabulario.map(palavra => (
                  <span key={palavra} className="bg-background px-2 py-1 rounded text-xs border">
                    {palavra}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="font-medium mb-2">💬 Exemplo de Conversa:</p>
              <div className="bg-background p-3 rounded space-y-2 text-sm border">
                <div><strong>Cliente:</strong> Bom dia!</div>
                <div><strong>IA:</strong> {
                  segmento.id === 'alimentos-bebidas' ? 'Oi! Tudo ótimo! 😊 Viu nossa promoção? Tá com preço especial hoje!' :
                  segmento.id === 'eletronicos-informatica' ? 'Bom dia! 💻 Vi que você se interessou pelo produto. Posso te passar as especificações técnicas?' :
                  segmento.id === 'produtos-hospitalares' ? 'Bom dia. Este equipamento possui todas as certificações da Anvisa. Gostaria de mais informações técnicas?' :
                  segmento.id === 'seguranca-automacao' ? 'Olá! 🔒 Posso ajudar com informações sobre instalação e compatibilidade do equipamento?' :
                  segmento.id === 'casa-construcao' ? 'E aí! 👊 Esse material é top, resistente demais. Quer saber mais sobre rendimento?' :
                  segmento.id === 'moda-vestuario' ? 'Oi! 👗 Peça linda né? O caimento é perfeito. Qual seu tamanho?' :
                  segmento.id === 'automotivo' ? 'Fala! 🚗 Esse é original, compatível com vários modelos. Qual seu carro?' :
                  segmento.id === 'pet-shop' ? 'Oii! 🐾 Seu pet vai amar! É ótimo pra saúde dele. Qual bichinho você tem?' :
                  segmento.id === 'beleza-cosmeticos' ? 'Olá! 💄 Produto maravilhoso, os resultados são incríveis. Qual seu tipo de pele?' :
                  segmento.id === 'esportes-fitness' ? 'E aí, campeão! 💪 Produto top pra sua performance. Qual seu treino?' :
                  segmento.id === 'imoveis' ? 'Bom dia! 🏢 Imóvel excelente, localização privilegiada. Posso agendar uma visita?' :
                  segmento.id === 'servicos-profissionais' ? 'Bom dia! 💼 Obrigado pelo interesse. Podemos agendar uma reunião para entender melhor suas necessidades?' :
                  'Olá! Como posso ajudar você hoje? 😊'
                }</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={salvarConfig} disabled={loading} className="w-full" size="lg">
        {loading ? (
          <>⏳ Salvando...</>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configuração
          </>
        )}
      </Button>
    </div>
  );
}
