import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CircleCheck,
  FileAudio,
  Globe2,
  MessageCircle,
  Network,
  PackageOpen,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Video,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";
import FooterOptIn from "@/components/FooterOptIn";
import SiteLayout from "@/components/site/SiteLayout";

const contatoUrl =
  "https://wa.me/5521980804901?text=Ol%C3%A1!%20Quero%20conhecer%20a%20solu%C3%A7%C3%A3o%20corporativa%20da%20AMZ%20Ofertas.";

const redes = [
  { nome: "Instagram", sigla: "IG", status: "Programado", tom: "bg-pink-500/15 text-pink-300" },
  { nome: "Facebook", sigla: "FB", status: "Programado", tom: "bg-blue-500/15 text-blue-300" },
  { nome: "TikTok", sigla: "TK", status: "Em revisão", tom: "bg-cyan-500/15 text-cyan-300" },
  { nome: "LinkedIn", sigla: "IN", status: "Programado", tom: "bg-sky-500/15 text-sky-300" },
  { nome: "WhatsApp", sigla: "WA", status: "Ativo", tom: "bg-emerald-500/15 text-emerald-300" },
];

const recursos = [
  {
    icon: MessageCircle,
    titulo: "Agente de IA no WhatsApp",
    texto: "O Jarvis cria conteúdo e atende solicitações por áudio, texto e imagem, com o contexto da sua empresa.",
  },
  {
    icon: Video,
    titulo: "Vídeo animado vertical",
    texto: "Reels, Stories e TikTok em quatro formatos, com cores, tipografia, logo e trilha da marca.",
  },
  {
    icon: PackageOpen,
    titulo: "Vídeo de produto",
    texto: "A foto do catálogo vira anúncio com fundo removido, sombra, preço animado e chamada comercial.",
  },
  {
    icon: Globe2,
    titulo: "Identidade importada do site",
    texto: "A plataforma lê cores, logo, tipografia e tom de voz diretamente do endereço da empresa.",
  },
  {
    icon: FileAudio,
    titulo: "Atendimento e qualificação",
    texto: "Leads são atendidos e qualificados no WhatsApp oficial, com transferência para a equipe quando necessário.",
  },
  {
    icon: Store,
    titulo: "Conteúdo por unidade",
    texto: "Redes e franquias operam campanhas locais por unidade, mantendo aprovação e direção centralizadas.",
  },
];

const integracoes = [
  "WhatsApp Cloud API",
  "Instagram Graph API",
  "Facebook Graph API",
  "TikTok Content API",
  "LinkedIn Marketing API",
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const typebotElements = document.querySelectorAll(
      '[id*="typebot"], [class*="typebot"], typebot-bubble, typebot-standard',
    );
    typebotElements.forEach((element) => element.remove());

    if ((window as Window & { Typebot?: unknown }).Typebot) {
      delete (window as Window & { Typebot?: unknown }).Typebot;
    }
  }, []);

  return (
    <SiteLayout>
      <main className="bg-slate-950 text-slate-50">
        <section className="relative overflow-hidden border-b border-slate-800 px-6 pb-20 pt-28 md:pb-24 md:pt-36">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-300">
                <Network className="h-4 w-4" aria-hidden="true" />
                Marketing e atendimento em uma operação integrada
              </div>

              <h1 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
                Todo o marketing da sua empresa, pedido por áudio no WhatsApp.
              </h1>

              <p className="mt-7 max-w-3xl text-lg leading-relaxed text-slate-300 md:text-xl">
                Conteúdo criado por IA, publicado automaticamente em cinco redes por API oficial. Um agente que conhece o seu negócio atende cliente e equipe no mesmo canal.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 bg-orange-500 px-7 text-base font-semibold text-slate-950 hover:bg-orange-400">
                  <a href={contatoUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    Falar com um especialista
                  </a>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/cadastro")}
                  className="h-12 border-slate-600 bg-transparent px-7 text-base text-slate-100 hover:bg-slate-800 hover:text-slate-50"
                >
                  Conhecer a plataforma
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>

              <div className="mt-10 grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
                {["APIs oficiais", "Aprovação antes de publicar", "Operação em cinco canais"].map((item) => (
                  <div key={item} className="flex items-center gap-2 border-l-2 border-orange-500 pl-3">
                    <Check className="h-4 w-4 shrink-0 text-orange-400" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl" aria-label="Visão da operação integrada em cinco canais">
              <div className="border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
                <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-orange-400">Central de publicação</p>
                    <p className="mt-1 font-semibold text-slate-100">Operação multicanal</p>
                  </div>
                  <span className="flex items-center gap-2 text-xs text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Operação ativa
                  </span>
                </div>

                <div className="space-y-2 p-4 sm:p-5">
                  {redes.map((rede, index) => (
                    <div key={rede.nome} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border border-slate-800 bg-slate-950/70 p-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${rede.tom}`}>
                        {rede.sigla}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-100">{rede.nome}</p>
                        <p className="truncate text-xs text-slate-400">
                          {index === 4 ? "Atendimento e qualificação" : "Campanha institucional — 14:00"}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-slate-300">{rede.status}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 border-t border-slate-700 bg-slate-900">
                  {[
                    ["5", "canais"],
                    ["1", "aprovação"],
                    ["API", "oficial"],
                  ].map(([valor, rotulo]) => (
                    <div key={rotulo} className="border-r border-slate-700 px-3 py-4 text-center last:border-r-0">
                      <p className="text-lg font-bold text-orange-400">{valor}</p>
                      <p className="text-xs text-slate-400">{rotulo}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="border-b border-slate-800 bg-slate-900 px-6 py-20 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase text-orange-400">Como funciona</p>
              <h2 className="text-3xl font-bold md:text-5xl">Da identidade da marca à publicação, com controle humano.</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-300">
                A tecnologia organiza o processo; sua equipe mantém a decisão final sobre cada conteúdo.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden border border-slate-700 bg-slate-700 md:grid-cols-3">
              {[
                {
                  numero: "01",
                  icon: Globe2,
                  titulo: "Importe sua identidade",
                  texto: "Cole o endereço do seu site. A plataforma extrai cores, logo, tipografia e tom de voz da sua marca.",
                },
                {
                  numero: "02",
                  icon: FileAudio,
                  titulo: "Peça por áudio no WhatsApp",
                  texto: "Diga o que quer publicar. A IA escreve, cria a arte ou o vídeo e monta o post com o contexto do negócio.",
                },
                {
                  numero: "03",
                  icon: Send,
                  titulo: "Aprove e publique",
                  texto: "Nada vai ao ar sem sua confirmação. A publicação é distribuída nas cinco redes pelas integrações oficiais.",
                },
              ].map((passo) => {
                const Icon = passo.icon;
                return (
                  <article key={passo.numero} className="bg-slate-950 p-7 md:p-9">
                    <div className="mb-10 flex items-center justify-between">
                      <span className="text-sm font-semibold text-orange-400">{passo.numero}</span>
                      <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-semibold">{passo.titulo}</h3>
                    <p className="mt-4 leading-relaxed text-slate-300">{passo.texto}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-800 bg-slate-950 px-6 py-20 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <p className="mb-3 text-sm font-semibold uppercase text-orange-400">Capacidade operacional</p>
                <h2 className="text-3xl font-bold md:text-5xl">Tudo que sua empresa precisa para operar conteúdo em escala.</h2>
              </div>
              <p className="max-w-2xl text-lg leading-relaxed text-slate-300 lg:justify-self-end">
                Da solicitação no WhatsApp à publicação e ao atendimento de leads, mantendo identidade, governança e visão por unidade.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recursos.map((recurso) => {
                const Icon = recurso.icon;
                return (
                  <article key={recurso.titulo} className="border border-slate-800 bg-slate-900 p-7 transition-colors hover:border-orange-500/60">
                    <Icon className="h-7 w-7 text-orange-400" aria-hidden="true" />
                    <h3 className="mt-7 text-xl font-semibold">{recurso.titulo}</h3>
                    <p className="mt-3 leading-relaxed text-slate-300">{recurso.texto}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-800 bg-slate-900 px-6 py-20 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase text-orange-400">Credenciais verificáveis</p>
              <h2 className="text-3xl font-bold md:text-5xl">Infraestrutura oficial para uma operação corporativa.</h2>
              <p className="mt-6 text-lg leading-relaxed text-slate-300">
                Sem números inflados ou depoimentos genéricos. A confiança está na empresa identificada, nas integrações documentadas e no controle de aprovação.
              </p>

              <div className="mt-8 border-l-2 border-orange-500 pl-5">
                <p className="font-semibold text-slate-100">ATOM BRASIL DIGITAL LTDA</p>
                <p className="mt-1 text-slate-400">CNPJ 22.003.550/0001-05</p>
                <p className="mt-1 text-slate-400">Rio de Janeiro, Brasil</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border border-slate-700 bg-slate-950 p-6">
                <div className="flex gap-4">
                  <BadgeCheck className="mt-0.5 h-7 w-7 shrink-0 text-orange-400" aria-hidden="true" />
                  <div>
                    <h3 className="text-lg font-semibold">Tech Provider verificado pela Meta</h3>
                    <p className="mt-2 leading-relaxed text-slate-300">
                      Business Verification e Access Verification aprovadas para operar integrações empresariais.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-700 bg-slate-950 p-6">
                <div className="flex gap-4">
                  <ShieldCheck className="mt-0.5 h-7 w-7 shrink-0 text-orange-400" aria-hidden="true" />
                  <div className="w-full">
                    <h3 className="text-lg font-semibold">Integrações por API oficial</h3>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {integracoes.map((integracao) => (
                        <div key={integracao} className="flex items-center gap-2 text-sm text-slate-300">
                          <CircleCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                          {integracao}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-700 bg-slate-950 p-6">
                <div className="flex gap-4">
                  <Building2 className="mt-0.5 h-7 w-7 shrink-0 text-orange-400" aria-hidden="true" />
                  <div>
                    <h3 className="text-lg font-semibold">Operação com governança</h3>
                    <p className="mt-2 leading-relaxed text-slate-300">
                      Aprovação humana antes da publicação, identidade por empresa e gestão de conteúdo por operação ou unidade.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="planos" className="border-b border-slate-800 bg-slate-950 px-6 py-20 md:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 border border-slate-700 bg-slate-900 p-7 md:grid-cols-[1fr_0.8fr] md:p-12">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase text-orange-400">AMZ Ofertas Pro</p>
              <h2 className="text-3xl font-bold md:text-4xl">Uma operação configurada para a realidade da sua empresa.</h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
                Conectamos seus canais, configuramos a identidade da marca e preparamos o agente para o fluxo da equipe.
              </p>
            </div>

            <div className="border-l border-slate-700 md:pl-10">
              <ul className="space-y-3 text-slate-300">
                {["Cinco canais integrados", "Conteúdo em texto, imagem e vídeo", "Agente de IA no WhatsApp", "Aprovação e agendamento centralizados"].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-orange-400" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-8 h-12 w-full bg-orange-500 font-semibold text-slate-950 hover:bg-orange-400">
                <a href={contatoUrl} target="_blank" rel="noopener noreferrer">
                  Falar com um especialista
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </a>
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => navigate("/cadastro")}
                className="mt-4 w-full text-sm font-medium text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-slate-50"
              >
                Acessar o cadastro da plataforma
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-slate-900 px-6 py-20 md:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12">
              <p className="mb-3 text-sm font-semibold uppercase text-orange-400">Perguntas frequentes</p>
              <h2 className="text-3xl font-bold md:text-5xl">Informações para avaliar a operação.</h2>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              <AccordionItem value="item-1" className="border border-slate-700 bg-slate-950 px-6">
                <AccordionTrigger className="text-left text-lg font-semibold hover:text-orange-300">
                  Como a plataforma aprende a identidade da empresa?
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-slate-300">
                  A empresa informa o endereço do próprio site. A plataforma identifica cores, logo, tipografia, segmento e tom de voz, e apresenta tudo para revisão antes de salvar.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border border-slate-700 bg-slate-950 px-6">
                <AccordionTrigger className="text-left text-lg font-semibold hover:text-orange-300">
                  Quais canais estão integrados?
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-slate-300">
                  Instagram, Facebook, TikTok, LinkedIn e WhatsApp, por meio das APIs oficiais de cada plataforma.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border border-slate-700 bg-slate-950 px-6">
                <AccordionTrigger className="text-left text-lg font-semibold hover:text-orange-300">
                  A plataforma publica sem aprovação?
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-slate-300">
                  Não. O conteúdo é apresentado para confirmação antes da publicação. A empresa mantém controle sobre texto, imagem, vídeo, canais e horário.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border border-slate-700 bg-slate-950 px-6">
                <AccordionTrigger className="text-left text-lg font-semibold hover:text-orange-300">
                  É possível trabalhar com várias lojas ou unidades?
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-slate-300">
                  Sim. Redes e franquias podem organizar conteúdo por unidade, preservando a identidade da marca e a aprovação central.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border border-slate-700 bg-slate-950 px-6">
                <AccordionTrigger className="text-left text-lg font-semibold hover:text-orange-300">
                  A IA também cria imagens e vídeos?
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-slate-300">
                  Sim. A plataforma cria textos, artes, vídeos animados verticais e anúncios de produto, sempre usando a identidade aprovada da empresa.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-950 px-6 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <Sparkles className="mx-auto h-8 w-8 text-orange-400" aria-hidden="true" />
            <h2 className="mt-6 text-3xl font-bold md:text-5xl">Avalie como a AMZ se encaixa na sua operação.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              Converse com nossa equipe sobre canais, unidades, volume de conteúdo e atendimento pelo WhatsApp.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 bg-orange-500 px-8 font-semibold text-slate-950 hover:bg-orange-400">
                <a href={contatoUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  Falar com um especialista
                </a>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => navigate("/cadastro")}
                className="h-12 border-slate-600 bg-transparent px-8 text-slate-100 hover:bg-slate-800 hover:text-slate-50"
              >
                Conhecer a plataforma
              </Button>
            </div>
          </div>
        </section>

        <FooterOptIn />
      </main>
      <WhatsAppSupportButton />
      <WhatsAppFloatingButton />
    </SiteLayout>
  );
}

export default Landing;