import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AmzAutoLogoAnchor } from "./AmzAutoLogo";
import { AmzAutoPageShell } from "./AmzAutoLayout";

const META_DESCRIPTION =
  "AMZ Auto: atendimento no WhatsApp 24h, estoque publicado e gestão com lucro por carro para revendas, concessionárias e grupos.";

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-5">
      <strong className="text-lg">{title}</strong>
      <span className="text-base leading-relaxed text-[#45413B]">{text}</span>
    </div>
  );
}

export default function AmzAutoLandingPage() {
  useEffect(() => {
    document.title = "AMZ Auto — sistema para lojas de veículos";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", META_DESCRIPTION);
  }, []);

  return (
    <AmzAutoPageShell>
      <div className="bg-[#0C0E11] text-[#F5F3EE]">
        <nav
          aria-label="Principal"
          className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5"
        >
          <AmzAutoLogoAnchor href="#topo" />
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
            <a href="#atendimento" className="py-3 text-[#D9D6CF] no-underline">Atendimento</a>
            <a href="#vitrine" className="py-3 text-[#D9D6CF] no-underline">Vitrine</a>
            <a href="#gestao" className="py-3 text-[#D9D6CF] no-underline">Gestão</a>
            <a href="#grupos" className="py-3 text-[#D9D6CF] no-underline">Grupos</a>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/amz_auto/entrar"
              className="inline-flex min-h-11 items-center rounded-[10px] border border-[#4A505A] px-[18px] text-[15px] font-semibold text-[#F5F3EE] no-underline"
            >
              Entrar
            </Link>
            <Link
              to="/amz_auto/cadastro"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-[#FF6B1A] px-[18px] text-[15px] font-bold text-[#0C0E11] no-underline"
            >
              Cadastrar minha loja
            </Link>
          </div>
        </nav>

        <header
          id="topo"
          className="mx-auto flex max-w-7xl flex-wrap items-center gap-14 px-6 pb-20 pt-12 md:pb-22"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-6 basis-[520px]">
            <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#FF6B1A]">
              Uma divisão AMZ Ofertas para lojas de veículos
            </div>
            <h1 className="font-display m-0 text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] tracking-tight">
              Sua loja atendendo no WhatsApp 24 horas. E você sabendo o lucro de cada carro.
            </h1>
            <p className="m-0 max-w-xl text-lg leading-relaxed text-[#C9C5BC]">
              Atendimento com inteligência artificial, estoque publicado em todos os canais e a gestão completa da loja. Um sistema só, feito para revendas, concessionárias e grupos.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/amz_auto/cadastro"
                className="inline-flex min-h-14 items-center gap-2.5 rounded-xl bg-[#FF6B1A] px-6 text-[17px] font-bold text-[#0C0E11] no-underline"
              >
                Cadastrar minha loja
                <span aria-hidden>→</span>
              </Link>
              <Link
                to="/amz_auto/entrar"
                className="inline-flex min-h-14 items-center rounded-xl border border-[#4A505A] px-6 text-[17px] font-semibold text-[#F5F3EE] no-underline"
              >
                Já sou cliente — Entrar
              </Link>
            </div>
            <div className="text-sm text-[#A8A49B]">
              Implantação acompanhada pelo nosso time: WhatsApp, estoque e equipe configurados com você.
            </div>
          </div>

          <div className="relative flex min-w-0 flex-1 basis-[520px] justify-center">
            <div className="w-full max-w-[340px] rounded-[34px] bg-[#1B1F25] p-3 shadow-2xl">
              <div className="overflow-hidden rounded-3xl bg-[#E9E4DA]">
                <div className="flex items-center gap-2.5 bg-[#12302A] px-4 py-3.5 text-[#F5F3EE]">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#FF6B1A] text-[13px] font-extrabold text-[#0C0E11]">
                    AA
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[15px] font-bold">Sua Loja · Jarvis</span>
                    <span className="text-xs text-[#A9C9BF]">online agora</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 p-3.5 text-sm leading-snug">
                  <div className="max-w-[85%] self-end rounded-[10px_10px_2px_10px] bg-[#D3F5C4] px-3 py-2">
                    Oi! Vi o anúncio. Tem SUV automático disponível?
                  </div>
                  <div className="max-w-[88%] self-start rounded-[10px_10px_10px_2px] bg-white px-3 py-2">
                    Tenho 3 opções pra você agora. Olha só:
                  </div>
                  <div className="flex gap-2 overflow-hidden">
                    {["Evoque P300 2020", "SW4 SRX 2021"].map((nome) => (
                      <div key={nome} className="min-w-[150px] flex-none overflow-hidden rounded-[10px] bg-white">
                        <div className="flex h-[82px] items-center justify-center bg-[#2A2F37] text-[11px] text-[#A8A49B]">
                          [foto do carro]
                        </div>
                        <div className="flex flex-col gap-0.5 px-2.5 py-2">
                          <strong className="text-[13px]">{nome}</strong>
                          <span className="text-xs font-semibold text-[#1F5F4E]">Simular parcelas</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="max-w-[85%] self-end rounded-[10px_10px_2px_10px] bg-[#D3F5C4] px-3 py-2">
                    Gostei do Evoque. Dá pra ver amanhã?
                  </div>
                  <div className="max-w-[88%] self-start rounded-[10px_10px_10px_2px] bg-white px-3 py-2">
                    Agendado amanhã às 10h com a Ana, nossa consultora. Ela já recebeu seu contato.
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-6 right-0 hidden max-w-[220px] flex-col gap-1 rounded-[14px] bg-[#F5F3EE] p-4 text-[#0C0E11] shadow-xl sm:flex">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">Só o dono vê</span>
              <span className="text-[15px] font-bold">Evoque P300 2020</span>
              <span className="text-sm">
                Lucro previsto: <strong className="text-[#1F5F4E]">margem real na tela</strong>
              </span>
            </div>
          </div>
        </header>
      </div>

      <section aria-label="Canais" className="border-b border-[#DDD8CE]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-7 gap-y-2 px-6 py-5 text-[15px] text-[#45413B]">
          <span className="font-bold text-[#0C0E11]">Funciona com o que sua loja já usa:</span>
          {["WhatsApp", "Instagram", "Facebook", "TikTok", "Mercado Livre", "portais de veículos", "site da loja"].map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6">
        <section id="atendimento" className="flex flex-wrap items-start gap-12 py-20">
          <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-4">
            <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#B4410C]">01 · Atendimento</div>
            <h2 className="font-display m-0 text-[clamp(1.75rem,4vw,2.625rem)] leading-tight">
              Nenhum cliente fica sem resposta. Nem às 23h de domingo.
            </h2>
            <p className="m-0 text-lg leading-relaxed text-[#45413B]">
              O Jarvis atende pelo WhatsApp da sua loja os contatos que chegam de todos os seus canais, mostra os carros certos e entrega o cliente pronto para o vendedor.
            </p>
          </div>
          <div className="grid min-w-0 flex-1 basis-[560px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            <FeatureCard title="Atende 24 horas" text="Responde em segundos, entende áudio e texto, tira dúvidas de ano e opcionais." />
            <FeatureCard title="Carrossel do estoque" text="Mostra os carros que combinam com o pedido do cliente, com foto, direto no WhatsApp." />
            <FeatureCard title="Financiamento e visita" text="Simula parcelas, coleta os dados e agenda a visita no horário da loja." />
            <FeatureCard title="Distribui para a equipe" text="Cada cliente vai para o vendedor certo, com o histórico da conversa. Ninguém disputa lead." />
          </div>
        </section>

        <section id="vitrine" className="flex flex-wrap items-start gap-12 border-t border-[#DDD8CE] py-14">
          <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-4">
            <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#B4410C]">02 · Vitrine e publicação</div>
            <h2 className="font-display m-0 text-[clamp(1.75rem,4vw,2.625rem)] leading-tight">Cadastrou o carro, ele aparece em todo lugar.</h2>
            <p className="m-0 text-lg leading-relaxed text-[#45413B]">
              Arte, vídeo e legenda criados para cada carro, publicados nas redes, no marketplace e nos portais — e a vitrine online da loja sempre atualizada.
            </p>
          </div>
          <div className="grid min-w-0 flex-1 basis-[560px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            <FeatureCard title="Mídia pronta" text="Imagens e vídeos com a identidade da loja, gerados a partir das fotos do carro." />
            <FeatureCard title="Redes sociais" text="Instagram, Facebook e TikTok com publicações programadas." />
            <FeatureCard title="Portais" text="Mercado Livre e portais de veículos conectados ao seu estoque. Vendeu, sai de todos." />
            <FeatureCard title="Vitrine da loja" text="Página com todo o estoque, que leva o cliente direto para o WhatsApp." />
          </div>
        </section>

        <section id="gestao" className="flex flex-wrap items-center gap-12 border-t border-[#DDD8CE] py-14">
          <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-4">
            <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#B4410C]">03 · Gestão</div>
            <h2 className="font-display m-0 text-[clamp(1.75rem,4vw,2.625rem)] leading-tight">
              Faturar bem não é lucrar bem. Agora você sabe a diferença.
            </h2>
            <p className="m-0 text-lg leading-relaxed text-[#45413B]">
              Custo, despesas e comissão de cada carro, contas da loja, equipe e financeiro — com o lucro de verdade na tela e no seu WhatsApp.
            </p>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-base leading-snug">
              {[
                "Lucro por carro e margem real de cada venda",
                "Despesas lançadas por áudio no WhatsApp",
                "Equipe, comissões, metas e projeção do mês",
                "Contas a pagar, fluxo de caixa e conciliação bancária",
                "Nota fiscal, contratos digitais e pacote para o contador",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="text-[#1F5F4E]" aria-hidden>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-1 basis-[560px] flex-col gap-4 rounded-[20px] bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="text-lg">Resultado do mês</strong>
              <span className="text-[13px] text-[#5A5650]">exemplo ilustrativo</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              {[
                { label: "Faturamento", value: "Consolidado" },
                { label: "Lucro líquido", value: "Na tela", green: true },
                { label: "Meta", value: "Por loja" },
              ].map((k) => (
                <div key={k.label} className="flex flex-col gap-1 rounded-xl bg-[#F5F3EE] p-3.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#5A5650]">{k.label}</span>
                  <span className={`font-display text-2xl ${k.green ? "text-[#1F5F4E]" : ""}`}>{k.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="grupos" className="mb-8 mt-8 flex flex-wrap items-start gap-10 rounded-3xl bg-[#0C0E11] p-10 text-[#F5F3EE]">
          <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-4">
            <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#FF6B1A]">04 · Grupos e concessionárias</div>
            <h2 className="font-display m-0 text-[clamp(1.75rem,4vw,2.5rem)] leading-tight">Várias lojas, uma visão só.</h2>
            <p className="m-0 text-lg leading-relaxed text-[#C9C5BC]">
              O diretor acompanha todas as lojas do grupo. Cada gerente opera a sua. Cada vendedor vê só o que é dele. Tudo também pelo WhatsApp.
            </p>
          </div>
          <div className="grid min-w-0 flex-1 basis-[520px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
            {[
              { role: "Diretor", text: "Painel do grupo, ranking das lojas, estoque parado e aprovações." },
              { role: "Gerente", text: "Lança despesas, registra vendas e pede relatórios da loja." },
              { role: "Vendedor", text: "Recebe os clientes, acompanha a meta e a comissão. Sem ver custo." },
            ].map((r) => (
              <div key={r.role} className="flex flex-col gap-2 rounded-[14px] bg-[#1B1F25] p-5">
                <strong className="text-[17px] text-[#FF6B1A]">{r.role}</strong>
                <span className="text-[15px] leading-relaxed text-[#D9D6CF]">{r.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Como começar" className="flex flex-col gap-7 py-20">
          <h2 className="font-display m-0 text-[clamp(1.75rem,4vw,2.625rem)] leading-tight">Como começar</h2>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 p-0">
            {[
              { n: "1", t: "Cadastre sua loja", d: "Leva dois minutos. Conte quantas lojas e quantos carros você tem." },
              { n: "2", t: "Configuramos com você", d: "Nosso time conecta o WhatsApp, sobe o estoque e cadastra a equipe." },
              { n: "3", t: "Sua loja no ar", d: "Acesso liberado na área exclusiva AMZ Auto. O Jarvis começa a atender." },
            ].map((step) => (
              <li key={step.n} className="flex flex-col gap-2.5 rounded-2xl bg-white p-6">
                <span className="font-display text-4xl text-[#B4410C]">{step.n}</span>
                <strong className="text-lg">{step.t}</strong>
                <span className="text-base leading-relaxed text-[#45413B]">{step.d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-label="Cadastro"
          className="mb-16 flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-[#FF6B1A] p-10 text-[#0C0E11]"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 basis-[480px]">
            <h2 className="font-display m-0 text-[clamp(1.75rem,4vw,2.5rem)] leading-tight">
              Pronto para a sua loja vender mais e lucrar melhor?
            </h2>
            <p className="m-0 text-lg leading-snug">
              Cadastre a loja e nosso time entra em contato para montar o plano ideal.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/amz_auto/cadastro"
              className="inline-flex min-h-14 items-center rounded-xl bg-[#0C0E11] px-6 text-[17px] font-bold text-[#F5F3EE] no-underline"
            >
              Cadastrar minha loja
            </Link>
            <Link
              to="/amz_auto/entrar"
              className="inline-flex min-h-14 items-center rounded-xl border-2 border-[#0C0E11] px-6 text-[17px] font-bold text-[#0C0E11] no-underline"
            >
              Entrar
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#DDD8CE]">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-6 py-7 text-sm text-[#5A5650]">
          <span>
            <strong className="text-[#0C0E11]">AMZ Auto</strong> é uma divisão da AMZ Ofertas
          </span>
          <span>Atom Brasil Digital LTDA · CNPJ 22.003.550/0001-05</span>
        </div>
      </footer>
    </AmzAutoPageShell>
  );
}
