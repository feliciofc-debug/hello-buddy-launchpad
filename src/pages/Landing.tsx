import React from 'react';
import { useNavigate } from 'react-router-dom';

function Landing() {
  const navigate = useNavigate();

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
              <p className="text-xs text-orange-300">Hub Completo para Afiliados</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/planos')} className="text-orange-300 hover:text-white transition">
              Planos
            </button>
            <button onClick={() => navigate('/login')} className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition">
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
              <div className="inline-block bg-orange-500/20 border border-orange-500 rounded-full px-4 py-2 mb-6">
                <span className="text-orange-300 font-semibold">🔥 +1.000 Produtos Disponíveis</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                Encontre os Produtos <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Mais Lucrativos</span>
              </h2>
              <p className="text-xl text-purple-200 mb-8">
                IA + Dados em Tempo Real = Suas Vendas nas Alturas 🚀
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button onClick={() => navigate('/cadastro')} className="bg-gradient-to-r from-green-500 to-emerald-500 px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl transition transform hover:scale-105 text-center">
                  🎁 COMEÇAR GRÁTIS - 7 DIAS
                </button>
                <button onClick={() => scrollToSection('como-funciona')} className="border-2 border-white/30 px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition text-center">
                  Ver Como Funciona
                </button>
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
            <div className="animate-pulse">
              <div className="bg-slate-800/50 backdrop-blur-lg border-2 border-purple-500/30 rounded-2xl p-8 shadow-2xl">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-orange-300 font-semibold">Produto Exemplo:</span>
                    <span className="bg-green-500 text-xs px-3 py-1 rounded-full font-bold">ALTA DEMANDA</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Air Fryer Premium 5L</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-3xl font-bold text-green-400">R$ 349,90</span>
                    <span className="text-lg">⭐ 4.8 (2.341 reviews)</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-purple-500/20 p-3 rounded-lg">
                    <p className="text-xs text-purple-300">Comissão</p>
                    <p className="text-xl font-bold text-green-400">R$ 34,99</p>
                  </div>
                  <div className="bg-orange-500/20 p-3 rounded-lg">
                    <p className="text-xs text-orange-300">Demanda/mês</p>
                    <p className="text-xl font-bold">8.542</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-blue-500 py-3 rounded-lg font-semibold text-sm">🔗 Copiar Link</button>
                  <button className="flex-1 bg-purple-500 py-3 rounded-lg font-semibold text-sm">📱 WhatsApp</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMAS/SOLUÇÕES */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Pare de <span className="text-red-500">Perder Tempo e Dinheiro</span>
            </h2>
            <p className="text-xl text-purple-300">Problemas que todo afiliado enfrenta (e que resolvemos!)</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                problema: "Não sabe quais produtos têm alta demanda e boas comissões?",
                solucao: "1000+ produtos pré-selecionados com dados de demanda e comissão em tempo real!"
              },
              {
                problema: "Perde HORAS criando posts e legendas para redes sociais?",
                solucao: "IA gera 3 posts profissionais em 10 segundos! Instagram, WhatsApp e Stories."
              },
              {
                problema: "Gasta em tráfego pago sem saber se vai ter retorno?",
                solucao: "Calculadora ROI + rastreamento de conversões! Saiba EXATAMENTE o lucro antes de investir."
              }
            ].map((item, index) => (
              <div key={index} className="bg-gradient-to-br from-slate-800 to-slate-900 border border-red-500/30 rounded-2xl p-8">
                <div className="text-5xl mb-4">❌</div>
                <h3 className="text-2xl font-bold mb-4 text-red-400">O Problema</h3>
                <p className="text-slate-300 mb-6">{item.problema}</p>
                <div className="border-t border-green-500/30 pt-6">
                  <div className="text-5xl mb-4">✅</div>
                  <h4 className="text-xl font-bold mb-2 text-green-400">Nossa Solução</h4>
                  <p className="text-slate-300">{item.solucao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="como-funciona" className="py-20 px-6 bg-gradient-to-b from-slate-900 to-purple-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Tudo que Você Precisa em <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Uma Plataforma</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "🔍", title: "1000+ Produtos", desc: "Produtos com alta demanda, boas comissões e frete grátis. Amazon, Shopee, AliExpress, TikTok Shop, Lomadee, Hotmart, Eduzz, Monetizze e Mercado Livre!" },
              { icon: "🤖", title: "Posts com IA", desc: "IA gera posts profissionais em segundos! Copiar e colar nunca foi tão fácil." },
              { icon: "📊", title: "Calculadora ROI", desc: "Calcule lucro, break-even e ROI antes de investir em tráfego pago!" },
              { icon: "📱", title: "WhatsApp em Massa", desc: "Envie ofertas para sua lista de clientes automaticamente!" },
              { icon: "🎯", title: "Gerador de Anúncios", desc: "Crie anúncios para Meta e Google Ads com copy otimizado pela IA!" },
              { icon: "📈", title: "Rastreamento", desc: "Pixel de conversão! Veja quais produtos vendem mais e otimize suas campanhas." }
            ].map((feature, index) => (
              <div key={index} className="bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 hover:border-purple-500 transition">
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              O Que Nossos <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">Afiliados Dizem</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                stars: 5,
                text: "Antes eu passava 3 horas criando posts. Agora a IA faz em 10 segundos! Triplicou minhas vendas!",
                name: "Mariana Silva",
                role: "Afiliada há 2 anos",
                color: "from-purple-500 to-pink-500"
              },
              {
                stars: 5,
                text: "A calculadora de ROI salvou meu negócio! Parei de queimar dinheiro em tráfego que não converte.",
                name: "Carlos Mendes",
                role: "Afiliado iniciante",
                color: "from-blue-500 to-cyan-500"
              },
              {
                stars: 5,
                text: "Sistema completo! Tudo em um lugar só. Economizei R$ 500/mês em outras ferramentas!",
                name: "Ana Paula",
                role: "Afiliada profissional",
                color: "from-orange-500 to-red-500"
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-slate-800 to-slate-900 border border-green-500/30 rounded-2xl p-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⭐⭐⭐⭐⭐</span>
                </div>
                <p className="text-lg mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-r ${testimonial.color} rounded-full`}></div>
                  <div>
                    <p className="font-bold">{testimonial.name}</p>
                    <p className="text-sm text-slate-400">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREÇOS - Preview Planos */}
      <section id="precos" className="py-20 px-6 bg-gradient-to-b from-slate-900 to-purple-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block bg-green-500/20 border border-green-500 rounded-full px-4 py-2 mb-6">
              <span className="text-green-300 font-semibold">💳 PLANOS PARA TODOS OS PERFIS</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Escolha o <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">Plano Ideal</span> para Você
            </h2>
            <p className="text-xl text-purple-300">Afiliados, empresas, indústrias e agências</p>
          </div>

          {/* Preview dos 3 Cards Principais */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Card Afiliados */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-500 rounded-2xl p-8 hover:scale-105 transition-transform">
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">💰</div>
                <h3 className="text-2xl font-bold mb-2">AFILIADO</h3>
                <div className="text-3xl font-bold text-green-400">
                  R$ 147<span className="text-sm text-gray-400">/mês</span>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  "IA gera posts virais",
                  "Análise de produtos",
                  "Agendamento automático",
                  "Múltiplas redes sociais",
                  "WhatsApp integrado"
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✅</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Empresas */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500 rounded-2xl p-8 hover:scale-105 transition-transform relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 px-4 py-1 rounded-full text-xs font-bold">
                MAIS POPULAR
              </div>
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">🏪</div>
                <h3 className="text-2xl font-bold mb-2">EMPRESAS</h3>
                <div className="text-3xl font-bold text-green-400">
                  R$ 447<span className="text-sm text-gray-400">/mês</span>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  "Upload fotos",
                  "IA gera posts",
                  "Cria vídeos",
                  "Google Ads",
                  "Analytics avançado"
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✅</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Indústria */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-blue-500 rounded-2xl p-8 hover:scale-105 transition-transform">
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">🏭</div>
                <h3 className="text-2xl font-bold mb-2">INDÚSTRIA</h3>
                <div className="text-3xl font-bold text-green-400">
                  R$ 947<span className="text-sm text-gray-400">/mês</span>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  "Catálogo produtos",
                  "Rede de vendas",
                  "Marketplace afiliados",
                  "Suporte prioritário",
                  "Onboarding dedicado"
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✅</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Ver Todos os Planos */}
          <div className="text-center">
            <button 
              onClick={() => navigate('/planos')} 
              className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 px-12 py-5 rounded-xl font-bold text-xl hover:shadow-2xl transition transform hover:scale-105"
            >
              Ver Todos os Planos
            </button>
            <p className="mt-4 text-purple-200">
              ✅ 7 dias grátis • ✅ Cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Perguntas <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Frequentes</span>
            </h2>
          </div>

          <div className="space-y-6">
            {[
              { q: "❓ Preciso ter experiência como afiliado?", a: "Não! O sistema é perfeito para iniciantes. Guiamos você passo a passo!" },
              { q: "❓ Funciona com quais plataformas?", a: "Amazon (Muito Alta), Shopee (Alta), Lomadee (Muito Alta - 1M+ produtos), AliExpress (Muito Alta - Dropshipping), TikTok Shop (Alta), Hotmart (Média), Eduzz (Média), Monetizze (Média) e Mercado Livre!" },
              { q: "❓ Posso cancelar quando quiser?", a: "Sim! Sem fidelidade. Cancele com 1 clique no painel." },
              { q: "❓ Como funciona o teste grátis?", a: "7 dias de acesso completo sem pagar nada. Sem cartão de crédito!" },
              { q: "❓ Tem suporte?", a: "Sim! Suporte via WhatsApp de segunda a sexta, 9h às 18h." }
            ].map((faq, index) => (
              <div key={index} className="bg-slate-800/50 border border-purple-500/30 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-3">{faq.q}</h3>
                <p className="text-slate-300">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-6 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Pronto para <span className="text-white">10x Suas Vendas?</span>
          </h2>
          <p className="text-2xl mb-10 text-purple-100">
            Junte-se a centenas de afiliados que já estão lucrando!
          </p>
          <button onClick={() => navigate('/cadastro')} className="inline-block bg-white text-purple-900 px-12 py-6 rounded-2xl font-bold text-2xl hover:shadow-2xl transition transform hover:scale-105 mb-6">
            🎁 COMEÇAR GRÁTIS - 7 DIAS
          </button>
          <p className="text-purple-100">
            ✅ 7 dias grátis • ✅ Sem cartão • ✅ Cancele quando quiser
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 py-12 px-6 border-t border-purple-500/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                  <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
                </svg>
              </div>
              <h4 className="font-bold text-orange-400">AMZ Ofertas</h4>
            </div>
            <p className="text-sm text-slate-400">Plataforma completa para afiliados de sucesso.</p>
          </div>
            <div>
              <h4 className="font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white">Funcionalidades</a></li>
                <li><a href="#" className="hover:text-white">Preços</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white">Sobre</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-white">Privacidade</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
            <p>© 2025 AMZ Ofertas. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;