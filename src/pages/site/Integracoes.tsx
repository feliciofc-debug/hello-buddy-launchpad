import SiteLayout from "@/components/site/SiteLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Integracoes() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Integrações
          </h1>
          <p className="text-lg text-muted-foreground">
            A AMZ Ofertas se conecta às APIs oficiais das principais redes
            sociais e do WhatsApp Business. Abaixo estão os dados acessados e
            como cada usuário pode desconectar sua conta.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              TikTok
            </h2>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              O usuário conecta sua própria conta do TikTok por OAuth. A AMZ
              Ofertas envia vídeos ao perfil do cliente a partir do painel e
              exige uma ação explícita antes de cada publicação.
            </p>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              No ambiente de testes, o conteúdo é enviado de forma privada ou
              para revisão no aplicativo TikTok. Depois da aprovação da API, o
              usuário poderá escolher as opções de visibilidade autorizadas
              pela própria conta.
            </p>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              <strong>Dados acessados:</strong> perfil básico do usuário, lista
              de contas vinculadas e status das publicações enviadas.
            </p>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              <strong>Desconexão:</strong> a revogação do token pode ser feita
              em Configurações dentro da plataforma, ou diretamente nas
              configurações de aplicativos e sites do TikTok.
            </p>
            <Button asChild>
              <Link to="/login?next=/meus-produtos">Entrar e testar publicação</Link>
            </Button>
          </section>

          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Instagram e Facebook
            </h2>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              A publicação ocorre nas páginas e contas comerciais do próprio
              cliente, via Meta Graph API. O usuário seleciona a página ou
              conta desejada durante a conexão OAuth.
            </p>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              <strong>Dados acessados:</strong> páginas e contas comerciais
              vinculadas, identificadores de publicação e métricas básicas de
              desempenho.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Desconexão:</strong> em Configurações, o usuário remove a
              conexão da Meta. Também é possível revogar o acesso nas
              configurações de aplicativos e sites do Facebook.
            </p>
          </section>

          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              LinkedIn
            </h2>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              A integração permite publicar no perfil do próprio cliente por
              meio da API do LinkedIn. Todo post passa pela tela de aprovação
              antes de ser enviado.
            </p>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              <strong>Dados acessados:</strong> informações básicas do perfil
              profissional e permissão para criar publicações no nome do
              usuário.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Desconexão:</strong> a desconexão é feita em Configurações
              na plataforma, ou nas permissões de aplicativos vinculados do
              LinkedIn.
            </p>
          </section>

          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              WhatsApp Business
            </h2>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              O atendimento é feito pela Cloud API oficial do WhatsApp Business,
              usando o número comercial do cliente. A AMZ Ofertas não substitui
              o WhatsApp do usuário: ela orquestra as conversas no painel e
              permite automações configuradas.
            </p>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              <strong>Dados acessados:</strong> número comercial vinculado,
              mensagens trocadas, status de entrega e leitura, e nome de
              exibição dos contatos conforme fornecido pela Meta.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Desconexão:</strong> o usuário remove a conexão em
              Configurações ou desvincula o número diretamente no portal de
              negócios da Meta.
            </p>
          </section>
        </div>

        <div className="max-w-3xl mx-auto mt-16 text-center">
          <p className="text-muted-foreground leading-relaxed">
            Para mais detalhes sobre como tratamos dados pessoais, consulte a{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Política de Privacidade
            </Link>{" "}
            e a página de{" "}
            <Link to="/data-deletion" className="text-primary hover:underline">
              Exclusão de Dados
            </Link>
            .
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}
