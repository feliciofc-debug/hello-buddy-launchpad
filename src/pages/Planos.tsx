import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Zap, Rocket } from 'lucide-react';
import { toast } from 'sonner';

const Planos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const planos = [
    {
      id: 'basico',
      nome: 'Básico',
      preco: 47,
      icon: Zap,
      cor: 'from-blue-500 to-cyan-500',
      features: [
        'Até 100 produtos listados',
        'Busca automática de oportunidades',
        'Calculadora de ROI',
        'Suporte por email',
        'Dashboard básico'
      ]
    },
    {
      id: 'pro',
      nome: 'Pro',
      preco: 97,
      icon: Crown,
      cor: 'from-purple-500 to-pink-500',
      destaque: true,
      features: [
        'Produtos ilimitados',
        'IA para geração de posts',
        'Envio direto WhatsApp',
        'Análise de tendências',
        'Suporte prioritário',
        'Relatórios avançados'
      ]
    },
    {
      id: 'premium',
      nome: 'Premium',
      preco: 197,
      icon: Rocket,
      cor: 'from-orange-500 to-red-500',
      features: [
        'Tudo do plano Pro',
        'API de integração',
        'Automação completa',
        'Multi-usuário',
        'Gerente de conta dedicado',
        'Treinamento personalizado'
      ]
    }
  ];

  const handleEscolherPlano = async (plano: typeof planos[0]) => {
    setLoading(plano.id);
    
    try {
      const response = await fetch('https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plano: plano.id,
          valor: plano.preco,
          nome: plano.nome
        })
      });

      const data = await response.json();

      if (data.init_point) {
        // Redireciona para o checkout do Mercado Pago
        window.location.href = data.init_point;
      } else {
        toast.error('Erro ao processar pagamento');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao processar pagamento');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Escolha Seu Plano
          </h1>
          <p className="text-orange-300 text-lg">
            Comece a lucrar com afiliados Amazon hoje mesmo
          </p>
        </div>

        {/* Planos */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {planos.map((plano) => {
            const Icon = plano.icon;
            return (
              <div
                key={plano.id}
                className={`relative bg-slate-800/50 backdrop-blur-sm border rounded-2xl p-8 hover:scale-105 transition-transform ${
                  plano.destaque ? 'border-purple-500/50 shadow-lg shadow-purple-500/20' : 'border-orange-500/30'
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                      MAIS POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`inline-flex p-3 bg-gradient-to-r ${plano.cor} rounded-full mb-4`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{plano.nome}</h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-4xl font-bold text-white">R$ {plano.preco}</span>
                    <span className="text-orange-300">/mês</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plano.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleEscolherPlano(plano)}
                  disabled={loading === plano.id}
                  className={`w-full bg-gradient-to-r ${plano.cor} text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50`}
                >
                  {loading === plano.id ? 'Processando...' : 'Escolher Plano'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Garantia */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-2xl p-6 text-center">
          <h3 className="text-xl font-bold text-white mb-2">
            ✅ Garantia de 7 Dias
          </h3>
          <p className="text-gray-300">
            Se não gostar, devolvemos 100% do seu dinheiro. Sem perguntas.
          </p>
        </div>

        {/* Botão Voltar */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/')}
            className="text-orange-300 hover:text-white transition"
          >
            ← Voltar para a página inicial
          </button>
        </div>
      </div>
    </div>
  );
};

export default Planos;
