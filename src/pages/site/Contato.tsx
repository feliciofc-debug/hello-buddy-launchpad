import SiteLayout from "@/components/site/SiteLayout";
import { Link } from "react-router-dom";
import { Mail, Building, HeadphonesIcon } from "lucide-react";

export default function Contato() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Contato
          </h1>
          <p className="text-lg text-muted-foreground">
            Entre em contato com a equipe da AMZ Ofertas pelos canais abaixo.
            Respondemos solicitações comerciais e de suporte em horário
            comercial.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto mb-12">
          <div className="bg-card border rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              E-mail
            </h2>
            <a
              href="mailto:amzofertas@amzofertas.com.br"
              className="text-primary hover:underline break-all"
            >
              amzofertas@amzofertas.com.br
            </a>
          </div>

          <div className="bg-card border rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Empresa
            </h2>
            <p className="text-sm text-muted-foreground">
              ATOM BRASIL DIGITAL LTDA
              <br />
              CNPJ 22.003.550/0001-05
              <br />
              Rio de Janeiro
            </p>
          </div>

          <div className="bg-card border rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <HeadphonesIcon className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Suporte a clientes
            </h2>
            <p className="text-sm text-muted-foreground">
              Clientes ativos são atendidos pelo canal informado no painel,
              após o login na conta.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto bg-muted rounded-lg p-6 md:p-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Solicitações sobre dados pessoais
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Para pedidos de acesso, correção ou exclusão de dados pessoais,
            acesse a página de{" "}
            <Link to="/data-deletion" className="text-primary hover:underline">
              Exclusão de Dados
            </Link>
            . Também é possível consultar a{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Política de Privacidade
            </Link>{" "}
            para entender como coletamos e usamos as informações.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            As solicitações são analisadas em até 15 dias úteis e confirmadas
            pelo e-mail vinculado à conta.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}
