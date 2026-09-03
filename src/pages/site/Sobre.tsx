import SiteLayout from "@/components/site/SiteLayout";
import { Link } from "react-router-dom";

export default function Sobre() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Sobre a AMZ Ofertas
          </h1>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Quem desenvolve
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              A AMZ Ofertas é uma plataforma desenvolvida e mantida pela{" "}
              <a
                href="https://atombrasildigital.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Atom Brasil
              </a>
              , empresa brasileira de desenvolvimento de tecnologia. A equipe
              atua na construção de ferramentas de automação de marketing e
              atendimento para pequenas e médias empresas, com foco em
              inteligência artificial e integrações oficiais com as principais
              redes sociais.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              O que a plataforma resolve
            </h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              A AMZ Ofertas centraliza o atendimento no WhatsApp e a publicação
              em redes sociais em um único painel. O agente de IA responde
              perguntas repetitivas, qualifica leads e encaminha conversas para
              o atendimento humano quando necessário, reduzindo o tempo de
              resposta e aumentando a capacidade de atendimento.
            </p>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Para as redes sociais, a plataforma permite criar, agendar e
              publicar conteúdo no Instagram, Facebook, TikTok e LinkedIn. Cada
              publicação passa por aprovação do cliente antes de ir ao ar: a
              AMZ Ofertas nunca publica automaticamente sem consentimento
              explícito.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              O objetivo é reduzir a operação manual de marketing e vendas,
              mantendo o controle e a voz da marca nas mãos do cliente.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Como tratamos os dados dos clientes
            </h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Cada cliente conecta suas próprias contas comerciais à
              plataforma. Os dados de uma conta não são acessados por outra:
              todo o ambiente é isolado por usuário, com controle de acesso e
              políticas de segurança aplicadas em cada consulta ao banco de
              dados.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Não vendemos dados pessoais nem compartilhamos informações entre
              clientes. Para saber mais sobre coleta, uso e exclusão de dados,
              consulte a{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Política de Privacidade
              </Link>{" "}
              e a página de{" "}
              <Link to="/data-deletion" className="text-primary hover:underline">
                Exclusão de Dados
              </Link>
              .
            </p>
          </section>

          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Dados da empresa
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="font-medium text-muted-foreground sm:w-40 shrink-0">
                  Razão social:
                </dt>
                <dd className="text-foreground">ATOM BRASIL DIGITAL LTDA</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="font-medium text-muted-foreground sm:w-40 shrink-0">
                  Nome fantasia:
                </dt>
                <dd className="text-foreground">Atom Brasil Digital</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="font-medium text-muted-foreground sm:w-40 shrink-0">
                  CNPJ:
                </dt>
                <dd className="text-foreground">22.003.550/0001-05</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="font-medium text-muted-foreground sm:w-40 shrink-0">
                  Atividade principal:
                </dt>
                <dd className="text-foreground">desenvolvimento de tecnologia</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="font-medium text-muted-foreground sm:w-40 shrink-0">
                  Site da desenvolvedora:
                </dt>
                <dd className="text-foreground">
                  <a
                    href="https://atombrasildigital.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    atombrasildigital.com
                  </a>
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="font-medium text-muted-foreground sm:w-40 shrink-0">
                  Contato:
                </dt>
                <dd className="text-foreground">
                  <a
                    href="mailto:amzofertas@amzofertas.com.br"
                    className="text-primary hover:underline"
                  >
                    amzofertas@amzofertas.com.br
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </SiteLayout>
  );
}
