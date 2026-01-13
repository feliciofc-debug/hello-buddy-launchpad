import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Termos = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold">Termos de Serviço</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-muted-foreground mb-8">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar a plataforma AMZ Ofertas, você concorda com estes Termos de Serviço. 
              Se você não concordar com qualquer parte destes termos, não deverá usar nossos serviços.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Descrição do Serviço</h2>
            <p>
              A AMZ Ofertas é uma plataforma de marketing e automação para afiliados que permite:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Gerenciamento de produtos e links de afiliado</li>
              <li>Automação de mensagens via WhatsApp</li>
              <li>Integração com marketplaces (Amazon, Shopee, Magalu, Mercado Livre, TikTok Shop)</li>
              <li>Sistema de cashback para clientes</li>
              <li>Ferramentas de IA para marketing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Cadastro e Conta</h2>
            <p>
              Para utilizar nossos serviços, você deve:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Ter pelo menos 18 anos de idade</li>
              <li>Fornecer informações verdadeiras e atualizadas</li>
              <li>Manter a segurança de sua conta e senha</li>
              <li>Notificar imediatamente sobre qualquer uso não autorizado</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Uso Aceitável</h2>
            <p>
              Você concorda em não usar a plataforma para:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Enviar spam ou mensagens não solicitadas</li>
              <li>Violar leis ou regulamentos aplicáveis</li>
              <li>Infringir direitos de propriedade intelectual</li>
              <li>Transmitir conteúdo ilegal, ofensivo ou prejudicial</li>
              <li>Tentar acessar sistemas ou dados não autorizados</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Pagamentos e Assinaturas</h2>
            <p>
              Os planos de assinatura são cobrados conforme o período escolhido (mensal ou anual). 
              Pagamentos são processados através de gateways seguros (Mercado Pago, Stripe). 
              Cancelamentos podem ser feitos a qualquer momento, mas reembolsos seguem nossa política específica.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da plataforma, incluindo software, design, textos e marcas, 
              são propriedade da AMZ Ofertas ou de seus licenciadores. Você não pode copiar, 
              modificar ou distribuir qualquer parte sem autorização prévia por escrito.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Limitação de Responsabilidade</h2>
            <p>
              A AMZ Ofertas não se responsabiliza por:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Interrupções temporárias do serviço</li>
              <li>Perdas decorrentes do uso ou impossibilidade de uso</li>
              <li>Ações de terceiros ou marketplaces parceiros</li>
              <li>Bloqueios ou restrições impostas pelo WhatsApp ou outras plataformas</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Modificações dos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. 
              Alterações significativas serão comunicadas por e-mail ou notificação na plataforma. 
              O uso continuado após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Lei Aplicável</h2>
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil. 
              Qualquer disputa será submetida ao foro da comarca do Rio de Janeiro, RJ.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Contato</h2>
            <p>
              Para dúvidas sobre estes termos, entre em contato:
            </p>
            <ul className="list-none mt-2 space-y-1">
              <li>📧 Email: amzofertas@amzofertas.com.br</li>
              <li>📱 WhatsApp: (21) 99537-9550</li>
              <li>🌐 Site: www.amzofertas.com.br</li>
            </ul>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
          <p>© {currentYear} AMZ Ofertas. Todos os direitos reservados.</p>
        </footer>
      </main>
    </div>
  );
};

export default Termos;
