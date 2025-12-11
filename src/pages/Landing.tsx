import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import FooterOptIn from "@/components/FooterOptIn";

function Landing() {
  const navigate = useNavigate();

  // Remover qualquer resquício do Typebot que possa estar em cache
  useEffect(() => {
    // Remover elementos do Typebot do DOM
    const typebotElements = document.querySelectorAll('[id*="typebot"], [class*="typebot"], typebot-bubble, typebot-standard');
    typebotElements.forEach(el => el.remove());
    
    // Limpar window.Typebot se existir
    if ((window as any).Typebot) {
      delete (window as any).Typebot;
    }
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-slate-900 text-white">
      {/* HEADER */}
      <header className="fixed w-full top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-lg">
              <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
                <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AMZ Ofertas</h1>
              <p className="text-xs text-orange-300">Marketing Digital com IA</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => scrollToSection('planos')} className="bg-gray-700 hover:bg-gray-600 text-white px-3 md:px-4 py-2 rounded-lg font-semibold transition text-sm md:text-base">
              Planos
            </button>
            <button onClick={() => navigate('/marketplace')} className="bg-gray-700 hover:bg-gray-600 text-white px-3 md:px-4 py-2 rounded-lg font-semibold transition text-sm md:text-base">
              Marketplace
            </button>
            <button onClick={() => navigate('/vendedor-login')} className="bg-orange-500 hover:bg-orange-600 text-white px-3 md:px-4 py-2 rounded-lg font-semibold transition text-sm md:text-base">
              Portal Vendedor
            </button>
            <button onClick={() => navigate('/login')} className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 md:px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition text-sm md:text-base">
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                Transforme Suas Redes Sociais com <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Inteligência Artificial</span>
              </h2>
              <p className="text-xl text-purple-200 mb-8">
                Plataforma completa de marketing digital para pequenas e médias empresas. Crie, agende e publique conteúdo profissional em minutos.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/cadastro')} 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-lg px-8 py-6 h-auto"
                >
                  Começar Agora - 7 Dias Grátis
                </Button>
                <Button 
                  size="lg" 
                  onClick={() => scrollToSection('como-funciona')} 
                  className="bg-white/10 border-2 border-white hover:bg-white hover:text-slate-900 text-white text-lg px-8 py-6 h-auto backdrop-blur-sm"
                >
                  Ver Como Funciona
                </Button>
              </div>
              <div className="flex items-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <span>Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <span>Cancele quando quiser</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-slate-800/50 backdrop-blur-lg border-2 border-purple-500/30 rounded-2xl p-8 shadow-2xl">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-orange-300 font-semibold">Dashboard</span>
                    <span className="bg-green-500 text-xs px-3 py-1 rounded-full font-bold">ATIVO</span>
                  </div>
                  <h3 className="text-xl font-bold mb-4">Posts Agendados</h3>
                  <div className="space-y-3">
                    <div className="bg-purple-500/20 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">📱 Instagram Feed</span>
                        <span className="text-xs text-purple-300">Hoje 14h</span>
                      </div>
                      <p className="text-xs text-slate-300">Promoção especial...</p>
                    </div>
                    <div className="bg-blue-500/20 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">📘 Facebook</span>
                        <span className="text-xs text-blue-300">Amanhã 10h</span>
                      </div>
                      <p className="text-xs text-slate-300">Novidades chegando...</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-pink-500/20 p-3 rounded-lg text-center">
                    <p className="text-xs text-pink-300">Posts</p>
                    <p className="text-xl font-bold">42</p>
                  </div>
                  <div className="bg-green-500/20 p-3 rounded-lg text-center">
                    <p className="text-xs text-green-300">Alcance</p>
                    <p className="text-xl font-bold">8.5k</p>
                  </div>
                  <div className="bg-orange-500/20 p-3 rounded-lg text-center">
                    <p className="text-xs text-orange-300">Engage</p>
                    <p className="text-xl font-bold">12%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-20 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Como Funciona</h2>
            <p className="text-xl text-purple-300">3 passos simples para transformar seu marketing</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">1</div>
              <div className="text-5xl mb-4">📸</div>
              <h3 className="text-2xl font-bold mb-4">Adicione Seus Produtos</h3>
              <p className="text-slate-300">Faça upload de fotos ou cole links dos seus produtos. Nossa IA analisa e entende automaticamente.</p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-orange-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">2</div>
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-2xl font-bold mb-4">IA Cria Conteúdo Profissional</h3>
              <p className="text-slate-300">Em segundos, receba posts otimizados para Instagram e Facebook. 3 opções de texto para cada rede social.</p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-green-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">3</div>
              <div className="text-5xl mb-4">📅</div>
              <h3 className="text-2xl font-bold mb-4">Agende e Publique</h3>
              <p className="text-slate-300">Escolha datas, horários e redes. Suas postagens saem automaticamente no melhor momento.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-purple-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Tudo Que Sua Empresa Precisa
            </h2>
            <p className="text-xl text-purple-300">Ferramentas profissionais em uma plataforma simples</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 hover:border-purple-500 transition">
              <div className="text-5xl mb-4">📱</div>
              <h3 className="text-2xl font-bold mb-3">Conteúdo Profissional</h3>
              <p className="text-slate-300">IA cria textos persuasivos e otimizados para cada rede social. Sempre alinhados com sua marca.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-orange-500/30 rounded-2xl p-8 hover:border-orange-500 transition">
              <div className="text-5xl mb-4">📅</div>
              <h3 className="text-2xl font-bold mb-3">Agendamento Inteligente</h3>
              <p className="text-slate-300">Programe posts com antecedência. Diário, semanal ou personalizado. Sua empresa sempre presente nas redes.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-green-500/30 rounded-2xl p-8 hover:border-green-500 transition">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-2xl font-bold mb-3">Organização Total</h3>
              <p className="text-slate-300">Catálogo de produtos, biblioteca de posts e histórico completo. Tudo em um só lugar.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-blue-500/30 rounded-2xl p-8 hover:border-blue-500 transition">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold mb-3">Múltiplas Redes</h3>
              <p className="text-slate-300">Publique simultaneamente no Instagram Feed, Stories e Facebook. Economize tempo e amplie alcance.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-pink-500/30 rounded-2xl p-8 hover:border-pink-500 transition">
              <div className="text-5xl mb-4">📈</div>
              <h3 className="text-2xl font-bold mb-3">Análise de Resultados</h3>
              <p className="text-slate-300">Acompanhe métricas, engajamento e desempenho. Decisões baseadas em dados reais.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-yellow-500/30 rounded-2xl p-8 hover:border-yellow-500 transition">
              <div className="text-5xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold mb-3">Rápido e Simples</h3>
              <p className="text-slate-300">Interface intuitiva. Sem complicação. Do produto ao post em menos de 2 minutos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PLANO */}
      <section id="planos" className="py-20 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Plano Ideal Para Sua Empresa
            </h2>
            <p className="text-xl text-purple-300">Tudo que você precisa para dominar as redes sociais</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500 rounded-3xl p-10 shadow-2xl relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 px-6 py-2 rounded-full text-sm font-bold">
                MAIS POPULAR
              </div>
              
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">🏢</div>
                <h3 className="text-3xl font-bold mb-4">PLANO EMPRESAS</h3>
                <div className="mb-2">
                  <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                    🔥 PRIMEIROS 100 CLIENTES - DESCONTO DE R$ 1.000!
                  </span>
                </div>
                <div className="mb-6">
                  <div className="text-2xl text-gray-500 line-through mb-1">
                    De R$ 1.597,00
                  </div>
                  <div className="text-5xl font-bold text-green-400 mb-2">
                    R$ 597<span className="text-xl text-gray-400">/mês</span>
                  </div>
                <p className="text-purple-300">até 12x de R$ 597,00 ou R$ 6.447,60 no PIX (10% off)</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {[
                  "Postagens Ilimitadas",
                  "IA Avançada (Gemini)",
                  "Instagram + Facebook",
                  "Agendamento Automático",
                  "Biblioteca de Conteúdo",
                  "Catálogo de Produtos",
                  "Análise de Desempenho",
                  "Suporte Prioritário",
                  "Atualizações Gratuitas",
                  "7 Dias Grátis (Sem Cartão)"
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-green-400 text-xl">✅</span>
                    <span className="text-lg">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate('/planos')}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-5 rounded-xl font-bold text-2xl hover:shadow-2xl transition transform hover:scale-105 flex items-center justify-center gap-2 mb-4"
              >
                🚀 CONTRATAR AGORA
              </button>

              <Button 
                size="lg" 
                onClick={() => navigate('/cadastro')}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-xl py-8 h-auto font-bold"
              >
                COMEÇAR TESTE GRÁTIS
              </Button>

              <p className="text-center mt-6 text-sm text-slate-400">
                💳 Sem compromisso. Cancele quando quiser. Sem taxa de setup.
              </p>
            </div>

            <p className="text-center mt-8 text-lg text-purple-300">
              ✨ Mais de 500 empresas já confiam na AMZ Ofertas
            </p>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-purple-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              O Que Nossos Clientes Dizem
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                text: "Economizamos 15 horas por semana em criação de conteúdo. A IA da AMZ é incrível!",
                name: "João Silva",
                empresa: "Padaria do Bairro",
                color: "from-purple-500 to-pink-500"
              },
              {
                text: "Triplicamos nosso engajamento no Instagram em apenas 2 meses. Resultados impressionantes!",
                name: "Maria Santos",
                empresa: "Boutique Fashion",
                color: "from-orange-500 to-red-500"
              },
              {
                text: "Plataforma completa e fácil de usar. Nossa presença digital nunca foi tão forte!",
                name: "Carlos Mendes",
                empresa: "Pet Shop Central",
                color: "from-blue-500 to-cyan-500"
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-slate-800 to-slate-900 border border-green-500/30 rounded-2xl p-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⭐⭐⭐⭐⭐</span>
                </div>
                <p className="text-lg mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-r ${testimonial.color} rounded-full flex items-center justify-center text-xl font-bold`}>
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold">{testimonial.name}</p>
                    <p className="text-sm text-slate-400">{testimonial.empresa}</p>
                    <p className="text-xs text-green-400">Cliente desde 2024</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Perguntas Frequentes
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-slate-800/50 border border-purple-500/30 rounded-xl px-6">
              <AccordionTrigger className="text-lg font-semibold hover:text-purple-300">
                Como funciona o teste grátis?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300">
                Você tem 7 dias completos para testar todas as funcionalidades da plataforma sem precisar cadastrar cartão de crédito. Se gostar, basta escolher um plano para continuar usando.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-slate-800/50 border border-purple-500/30 rounded-xl px-6">
              <AccordionTrigger className="text-lg font-semibold hover:text-purple-300">
                Posso cancelar a qualquer momento?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300">
                Sim! Não há fidelidade ou taxas de cancelamento. Você pode cancelar sua assinatura quando quiser através do painel de configurações.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-slate-800/50 border border-purple-500/30 rounded-xl px-6">
              <AccordionTrigger className="text-lg font-semibold hover:text-purple-300">
                Quais redes sociais são suportadas?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300">
                Atualmente suportamos Instagram (Feed e Stories) e Facebook. Estamos trabalhando para adicionar TikTok e LinkedIn em breve.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-slate-800/50 border border-purple-500/30 rounded-xl px-6">
              <AccordionTrigger className="text-lg font-semibold hover:text-purple-300">
                A IA cria as imagens também?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300">
                A IA cria textos otimizados para suas postagens. Você faz upload das fotos dos seus produtos e nossa IA gera legendas persuasivas e hashtags relevantes automaticamente.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-slate-800/50 border border-purple-500/30 rounded-xl px-6">
              <AccordionTrigger className="text-lg font-semibold hover:text-purple-300">
                Preciso de conhecimento técnico?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300">
                Não! A plataforma foi desenvolvida para ser extremamente intuitiva. Se você sabe usar Instagram e Facebook, já sabe usar a AMZ Ofertas. Tudo é visual e simples.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="bg-slate-800/50 border border-purple-500/30 rounded-xl px-6">
              <AccordionTrigger className="text-lg font-semibold hover:text-purple-300">
                Como funciona o agendamento?
              </AccordionTrigger>
              <AccordionContent className="text-slate-300">
                Você escolhe data, horário e em qual rede quer publicar. Pode agendar posts únicos ou criar um calendário semanal/mensal. A plataforma publica automaticamente no horário programado.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-purple-900 via-slate-900 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Pronto Para Transformar Suas Redes Sociais?
          </h2>
          <p className="text-xl text-purple-300 mb-8">
            Junte-se a centenas de empresas que já estão crescendo com a AMZ Ofertas
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/cadastro')}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-xl px-12 py-8 h-auto font-bold"
          >
            Começar Teste Grátis
          </Button>
          <p className="mt-6 text-slate-400">
            7 dias grátis • Sem cartão de crédito • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* OPT-IN NEWSLETTER WHATSAPP */}
      <FooterOptIn />

      {/* FOOTER */}
      <footer className="py-12 px-6 bg-slate-950 border-t border-purple-500/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-lg">
                  <svg className="w-6 h-6" fill="white" viewBox="0 0 24 24">
                    <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold">AMZ Ofertas</h3>
              </div>
              <p className="text-sm text-slate-400">
                Plataforma SaaS de gestão de marketing digital com inteligência artificial.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><button onClick={() => scrollToSection('como-funciona')} className="hover:text-white transition">Como Funciona</button></li>
                <li><button onClick={() => scrollToSection('planos')} className="hover:text-white transition">Planos</button></li>
                <li><button onClick={() => navigate('/cadastro')} className="hover:text-white transition">Teste Grátis</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><button onClick={() => navigate('/terms')} className="hover:text-white transition">Termos de Uso</button></li>
                <li><button onClick={() => navigate('/privacy')} className="hover:text-white transition">Política de Privacidade</button></li>
                <li><button onClick={() => navigate('/data-deletion')} className="hover:text-white transition">Exclusão de Dados</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Segurança</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button onClick={() => navigate('/security')} className="hover:text-white transition flex items-center gap-2">
                    🔒 Reportar Vulnerabilidade
                  </button>
                </li>
                <li><a href="mailto:contato@atombrasildigital.com" className="hover:text-white transition">contato@atombrasildigital.com</a></li>
              </ul>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="mailto:suporte@amzofertas.com" className="hover:text-white transition">suporte@amzofertas.com</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            <p>&copy; 2024 AMZ Ofertas. Todos os direitos reservados.</p>
            <p className="mt-3">
              Plataforma proprietária e desenvolvida por{' '}
              <a 
                href="https://atombrasildigital.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition font-semibold"
              >
                ATOM BRASIL DIGITAL LTDA
              </a>
            </p>
            <p className="mt-1">CNPJ: 22.003.550/0001-05</p>
          </div>
        </div>
      </footer>

      {/* WhatsApp Support Button */}
      <WhatsAppSupportButton />
    </div>
  );
}

export default Landing;
