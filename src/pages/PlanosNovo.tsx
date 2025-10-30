import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Users, Building2, Rocket, ChevronDown } from 'lucide-react';

export default function PlanosNovo() {
  const navigate = useNavigate();
  const [targetAudience, setTargetAudience] = useState<'afiliados' | 'empresas'>('afiliados');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const handleSelectPlan = (planType: string) => {
    navigate(`/cadastro?plano=${planType}`);
  };

  const faqItems = [
    {
      question: 'Qual plano escolher?',
      answer: 'Se você é afiliado individual, escolha o Plano Afiliado. Se tem uma empresa, escolha Empresas. Para indústrias e distribuidores, o plano Indústria. Agências que gerenciam múltiplos clientes devem escolher o plano Agências.'
    },
    {
      question: 'Posso trocar de plano?',
      answer: 'Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As alterações entram em vigor no próximo ciclo de cobrança.'
    },
    {
      question: 'Como funciona o pagamento?',
      answer: 'Aceitamos cartão de crédito, PIX e boleto. A cobrança é recorrente mensal e você recebe a fatura por email.'
    },
    {
      question: 'Tem contrato de fidelidade?',
      answer: 'Não! Você pode cancelar seu plano a qualquer momento, sem multas ou taxas de cancelamento.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
            Escolha o Plano Ideal para Você
          </h1>
          <p className="text-xl text-purple-200">
            Ferramentas profissionais de marketing com IA
          </p>
        </div>

        {/* Toggle */}
        <div className="flex justify-center mb-16 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-2 inline-flex gap-2">
            <Button
              onClick={() => setTargetAudience('afiliados')}
              variant={targetAudience === 'afiliados' ? 'default' : 'ghost'}
              size="lg"
              className={`text-lg px-8 py-6 rounded-xl transition-all ${
                targetAudience === 'afiliados'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  : 'hover:bg-slate-700/50'
              }`}
            >
              <Users className="mr-2 h-6 w-6" />
              PARA AFILIADOS
            </Button>
            <Button
              onClick={() => setTargetAudience('empresas')}
              variant={targetAudience === 'empresas' ? 'default' : 'ghost'}
              size="lg"
              className={`text-lg px-8 py-6 rounded-xl transition-all ${
                targetAudience === 'empresas'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  : 'hover:bg-slate-700/50'
              }`}
            >
              <Building2 className="mr-2 h-6 w-6" />
              PARA EMPRESAS
            </Button>
          </div>
        </div>

        {/* Cards - Afiliados */}
        {targetAudience === 'afiliados' && (
          <div className="max-w-2xl mx-auto animate-scale-in">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-500 shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105">
              <CardHeader className="text-center pb-8">
                <div className="text-6xl mb-4">💰</div>
                <CardTitle className="text-4xl mb-2">PLANO AFILIADO</CardTitle>
                <CardDescription className="text-3xl font-bold text-green-400">
                  R$ 147<span className="text-lg text-gray-400">/mês</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  'Análise de produtos',
                  'IA gera posts virais',
                  '3 formatos (Post/Story/Video)',
                  'Agendamento automático',
                  'WhatsApp integrado',
                  'Biblioteca de conteúdo',
                  'Múltiplas redes sociais',
                  'Links Shopee/Amazon/Hotmart',
                  'Análise de comissões',
                  'Marketplace de ofertas'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 text-lg">
                    <Check className="h-6 w-6 text-green-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="pt-8">
                <Button
                  onClick={() => handleSelectPlan('afiliado')}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-xl py-7 rounded-xl font-bold"
                  size="lg"
                >
                  COMEÇAR AGORA
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Cards - Empresas */}
        {targetAudience === 'empresas' && (
          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Plano Empresas */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-500/30 shadow-xl hover:shadow-purple-500/30 transition-all hover:scale-105 animate-fade-in">
              <CardHeader className="text-center">
                <div className="text-5xl mb-3">🏪</div>
                <CardTitle className="text-2xl mb-2">EMPRESAS</CardTitle>
                <CardDescription className="text-2xl font-bold text-green-400">
                  R$ 447<span className="text-sm text-gray-400">/mês</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="font-semibold text-orange-300 mb-2">Ideal para:</p>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Lojas</li>
                    <li>• Restaurantes</li>
                    <li>• Padarias</li>
                    <li>• Serviços</li>
                  </ul>
                </div>
                <div className="space-y-3 text-sm">
                  {[
                    'Upload fotos',
                    'IA gera posts',
                    'Melhora imagens',
                    'Cria vídeos',
                    'Postagens ilimitadas',
                    'Agendamento',
                    'Google Ads',
                    'Analytics',
                    '5 redes sociais',
                    'Biblioteca',
                    'Relatórios'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => handleSelectPlan('empresas')}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                >
                  ASSINAR
                </Button>
              </CardFooter>
            </Card>

            {/* Plano Indústria - POPULAR */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500 shadow-2xl hover:shadow-orange-500/50 transition-all hover:scale-105 relative animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                  MAIS POPULAR
                </span>
              </div>
              <CardHeader className="text-center mt-4">
                <div className="text-5xl mb-3">🏭</div>
                <CardTitle className="text-2xl mb-2">INDÚSTRIA</CardTitle>
                <CardDescription className="text-2xl font-bold text-green-400">
                  R$ 947<span className="text-sm text-gray-400">/mês</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="font-semibold text-orange-300 mb-2">Ideal para:</p>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Fábricas</li>
                    <li>• Concessionários</li>
                    <li>• Distribuidores</li>
                    <li>• Indústrias</li>
                  </ul>
                </div>
                <div className="space-y-3 text-sm">
                  {[
                    'Tudo do Empresas',
                    'Catálogo de produtos',
                    'Rede de vendas',
                    'Marketplace afiliados',
                    'Google Ads integrado',
                    'Analytics avançado',
                    'Suporte prioritário',
                    'Postagens ilimitadas',
                    'Onboarding dedicado'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => handleSelectPlan('industria')}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  ASSINAR
                </Button>
              </CardFooter>
            </Card>

            {/* Plano Agências */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-500/30 shadow-xl hover:shadow-purple-500/30 transition-all hover:scale-105 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="text-center">
                <div className="text-5xl mb-3">🚀</div>
                <CardTitle className="text-2xl mb-2">AGÊNCIAS</CardTitle>
                <CardDescription className="text-2xl font-bold text-purple-400">
                  SOB CONSULTA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="font-semibold text-orange-300 mb-2">Ideal para:</p>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Agências</li>
                    <li>• Freelancers</li>
                    <li>• Consultores</li>
                  </ul>
                </div>
                <div className="space-y-3 text-sm">
                  {[
                    'Multi-contas',
                    'Painel master',
                    'White label',
                    'API acesso',
                    'Relatórios avançados',
                    'Suporte VIP',
                    'Gerenciar N clientes'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => setShowContactModal(true)}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  FALAR COM CONSULTOR
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Rodapé Info */}
        <div className="text-center mt-12 space-y-2 text-purple-200 animate-fade-in">
          <p className="text-lg">✅ Todos os planos incluem 7 dias grátis</p>
          <p className="text-lg">✅ Cancele quando quiser, sem multa</p>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-center mb-8">Perguntas Frequentes</h2>
          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-xl overflow-hidden transition-all hover:border-purple-500/50"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
                >
                  <span className="font-semibold text-lg">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${
                      openFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 border-t border-purple-500/20 text-gray-300">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-20 max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-green-600 to-emerald-600 border-none shadow-2xl">
            <CardContent className="text-center py-12 px-6">
              <div className="text-5xl mb-4">🎯</div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Não sabe qual plano escolher?
              </h2>
              <p className="text-xl mb-8 text-green-100">
                Fale com um especialista e encontre a solução perfeita para seu negócio
              </p>
              <Button
                onClick={() => setShowContactModal(true)}
                size="lg"
                className="bg-white text-green-600 hover:bg-gray-100 text-xl px-12 py-7 rounded-xl font-bold"
              >
                FALAR COM ESPECIALISTA
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Contato */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-800 border-purple-500 max-w-md w-full">
            <CardHeader>
              <CardTitle>Fale com um Consultor</CardTitle>
              <CardDescription>
                Preencha seus dados e entraremos em contato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="text"
                placeholder="Seu nome"
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-purple-500/30 focus:border-purple-500 outline-none"
              />
              <input
                type="email"
                placeholder="Seu email"
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-purple-500/30 focus:border-purple-500 outline-none"
              />
              <input
                type="tel"
                placeholder="Seu WhatsApp"
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-purple-500/30 focus:border-purple-500 outline-none"
              />
              <textarea
                placeholder="Conte-nos sobre seu negócio"
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-purple-500/30 focus:border-purple-500 outline-none resize-none"
              />
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowContactModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  // Aqui você pode adicionar lógica para enviar para WhatsApp ou email
                  alert('Mensagem enviada! Entraremos em contato em breve.');
                  setShowContactModal(false);
                }}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
              >
                Enviar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
