import { ArrowLeft, Download, Chrome, Filter, Shield, BarChart3, FileSpreadsheet, MapPin, Ban, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const features = [
  { icon: '🇧🇷', title: 'Filtro Brasil', desc: 'Filtre automaticamente apenas números brasileiros (+55). Ignore contatos internacionais com um clique.', color: 'bg-purple-100' },
  { icon: '🚫', title: 'Remove Duplicados', desc: 'Detecta e remove contatos repetidos automaticamente. Sua lista sempre limpa e organizada.', color: 'bg-green-100' },
  { icon: '🔢', title: 'Filtro por DDD', desc: 'Filtre por região! Extraia apenas contatos de São Paulo (11), Rio (21), BH (31) ou qualquer DDD.', color: 'bg-amber-100' },
  { icon: '📊', title: 'Estatísticas', desc: 'Veja quantos contatos foram extraídos, quantos são BR, e quantos duplicados foram removidos.', color: 'bg-purple-100' },
  { icon: '📋', title: 'CSV Pronto', desc: 'Exporta em CSV (vírgula ou ponto e vírgula) ou TXT. Pronto para importar na plataforma.', color: 'bg-green-100' },
  { icon: '🔒', title: '100% Privado', desc: 'Funciona 100% no seu navegador. Nenhum dado é enviado para servidores externos.', color: 'bg-amber-100' },
];

const steps = [
  { title: 'Baixe e descompacte', desc: 'Clique no botão "Baixar Extensão" acima. Depois, clique com o botão direito no arquivo ZIP e escolha "Extrair tudo".' },
  { title: 'Abra as extensões do Chrome', desc: 'Digite o endereço abaixo na barra do Chrome:', code: 'chrome://extensions' },
  { title: 'Ative o Modo do Desenvolvedor', desc: 'No canto superior direito da página de extensões, ative o botão "Modo do desenvolvedor".' },
  { title: 'Carregue a extensão', desc: 'Clique em "Carregar sem compactação" e selecione a pasta AMZ-Extrator-v2 que você descompactou.', tip: 'Selecione a pasta que contém o arquivo manifest.json diretamente dentro dela, não uma pasta acima.' },
];

const faqs = [
  { q: 'Como extrair os contatos de um grupo?', a: 'Abra o WhatsApp Web, entre no grupo, clique no nome do grupo no topo para abrir os detalhes, role a lista de membros para carregar todos, e clique no ícone da extensão → "Extrair Contatos".' },
  { q: 'Por que alguns contatos aparecem sem número?', a: 'Contatos salvos na sua agenda aparecem com o nome, mas o WhatsApp Web não exibe o número deles no HTML. Contatos não salvos aparecem com o número completo.' },
  { q: 'Meus dados são enviados para algum lugar?', a: 'Não! A extensão funciona 100% localmente no seu navegador. Nenhum dado sai do seu computador.' },
  { q: 'Funciona no celular?', a: 'Não. A extensão funciona apenas no Google Chrome para computador (Windows, Mac ou Linux), acessando o WhatsApp Web.' },
  { q: 'Qual formato usar para importar na plataforma?', a: 'Use o formato CSV (vírgula). O arquivo terá duas colunas: Nome e Telefone. Basta importar na aba "Importar" da Automação WhatsApp.' },
];

export default function ExtensaoDownload() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-purple-700 to-purple-500 text-white">
        <div className="absolute inset-0">
          <div className="absolute w-[500px] h-[500px] -top-36 -right-24 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="absolute w-[300px] h-[300px] -bottom-20 -left-16 rounded-full bg-white/[0.04]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 py-20 md:py-28">
          <Link to="/dashboard" className="inline-block mb-8">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>

          <Badge className="mb-6 bg-white/10 border-white/15 text-white/90 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse mr-2" />
            Gratuito para clientes AMZ Ofertas
          </Badge>

          <div className="w-[72px] h-[72px] bg-white rounded-2xl flex items-center justify-center mx-auto mb-7 shadow-lg">
            <span className="text-2xl font-black text-purple-700 tracking-tighter">AMZ</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-5 leading-[1.1]">
            Extraia contatos do WhatsApp{' '}
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">em segundos</span>
          </h1>

          <p className="text-lg text-white/70 max-w-lg mx-auto mb-10">
            Extensão gratuita para Chrome que extrai, filtra e exporta os contatos dos seus grupos do WhatsApp Web direto em CSV.
          </p>

          <div className="flex flex-col items-center gap-3">
            <a
              href="/AMZ-Extrator-v2.zip"
              download
              className="inline-flex items-center gap-3 bg-white text-purple-700 font-extrabold text-lg px-10 py-4 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <Download className="h-5 w-5" />
              Baixar Extensão
            </a>
            <span className="text-sm text-white/40">v2.0 · Chrome · 32 KB · Sem cadastro</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-[3px] text-purple-500 text-center mb-3">Funcionalidades</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-foreground tracking-tight mb-12">
          Tudo que você precisa para extrair contatos
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Card key={i} className="border-border hover:border-purple-300 hover:-translate-y-1 transition-all duration-300">
              <CardContent className="pt-6">
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center text-xl mb-4`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How to Install */}
      <section className="bg-card border-y border-border py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[3px] text-purple-500 text-center mb-3">Instalação</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-foreground tracking-tight mb-12">
            Como instalar em 4 passos
          </h2>

          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 to-purple-500 text-white font-extrabold flex items-center justify-center shadow-md z-10">
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-border" />}
                </div>
                <div className={i < steps.length - 1 ? 'pb-9' : ''}>
                  <h3 className="font-bold text-foreground mt-2.5 mb-1.5">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                  {step.code && (
                    <code className="inline-block mt-2 bg-muted border border-border px-3 py-1 rounded-lg text-sm font-mono font-semibold text-purple-600">
                      {step.code}
                    </code>
                  )}
                  {step.tip && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      ⚠️ <strong>Importante:</strong> {step.tip}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-[3px] text-purple-500 text-center mb-3">Dúvidas</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-foreground tracking-tight mb-12">
          Perguntas frequentes
        </h2>

        <div className="divide-y divide-border border-y border-border">
          {faqs.map((faq, i) => (
            <div key={i} className="py-5">
              <button
                className="w-full flex items-center justify-between gap-4 text-left"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-bold text-foreground text-[15px]">{faq.q}</span>
                <ChevronDown className={`h-5 w-5 text-purple-500 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-purple-800 to-purple-600 text-white text-center py-16 px-6">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-4">Pronto para extrair seus contatos?</h2>
        <p className="text-white/60 mb-8">Baixe agora, instale em 2 minutos e comece a usar.</p>
        <a
          href="/AMZ-Extrator-v2.zip"
          download
          className="inline-flex items-center gap-3 bg-white text-purple-700 font-extrabold px-9 py-4 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
        >
          <Download className="h-5 w-5" />
          Baixar Extensão
        </a>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-center py-8 px-6">
        <p className="text-sm text-slate-400">
          © 2025 <a href="https://amzofertas.com.br" target="_blank" rel="noopener" className="text-purple-400 font-semibold hover:underline">AMZ Ofertas</a> · Marketing Digital com IA
        </p>
      </footer>
    </div>
  );
}
