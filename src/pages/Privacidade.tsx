import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Privacidade = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold">Política de Privacidade</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-muted-foreground mb-8">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introdução</h2>
            <p>
              A AMZ Ofertas está comprometida com a proteção da sua privacidade. 
              Esta política descreve como coletamos, usamos e protegemos suas informações pessoais 
              em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Dados que Coletamos</h2>
            <p>Coletamos os seguintes tipos de informações:</p>
            
            <h3 className="text-xl font-medium mt-4 mb-2">2.1 Dados de Cadastro</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>Número de telefone/WhatsApp</li>
              <li>CPF (quando aplicável para pagamentos)</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">2.2 Dados de Uso</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Produtos cadastrados e links de afiliado</li>
              <li>Histórico de campanhas e envios</li>
              <li>Interações com a plataforma</li>
              <li>Logs de acesso e endereço IP</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">2.3 Dados de Integrações</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Tokens de acesso de plataformas conectadas (TikTok, Meta, Shopee)</li>
              <li>Dados de sessão do WhatsApp</li>
              <li>Informações de pagamento processadas por terceiros</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Como Usamos seus Dados</h2>
            <p>Utilizamos suas informações para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Fornecer e manter nossos serviços</li>
              <li>Processar transações e assinaturas</li>
              <li>Enviar comunicações importantes sobre a conta</li>
              <li>Melhorar a experiência do usuário</li>
              <li>Cumprir obrigações legais</li>
              <li>Prevenir fraudes e garantir segurança</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Compartilhamento de Dados</h2>
            <p>
              Não vendemos seus dados pessoais. Podemos compartilhar informações com:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li><strong>Processadores de pagamento:</strong> Mercado Pago, Stripe (para transações)</li>
              <li><strong>Plataformas integradas:</strong> TikTok, Meta, WhatsApp (conforme suas autorizações)</li>
              <li><strong>Provedores de infraestrutura:</strong> Serviços de hospedagem e banco de dados</li>
              <li><strong>Autoridades legais:</strong> Quando exigido por lei</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Segurança dos Dados</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais, incluindo:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
              <li>Armazenamento seguro de senhas (hash + salt)</li>
              <li>Controle de acesso baseado em funções</li>
              <li>Monitoramento e logs de segurança</li>
              <li>Backups regulares</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Seus Direitos (LGPD)</h2>
            <p>
              Conforme a LGPD, você tem direito a:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li><strong>Acesso:</strong> Solicitar cópia dos seus dados pessoais</li>
              <li><strong>Correção:</strong> Corrigir dados incompletos ou desatualizados</li>
              <li><strong>Exclusão:</strong> Solicitar a eliminação dos seus dados</li>
              <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
              <li><strong>Revogação:</strong> Retirar consentimento a qualquer momento</li>
              <li><strong>Informação:</strong> Saber com quem seus dados são compartilhados</li>
            </ul>
            <p className="mt-4">
              Para exercer esses direitos, acesse <Link to="/data-deletion" className="text-primary hover:underline">nossa página de exclusão de dados</Link> ou 
              entre em contato pelo e-mail: privacidade@amzofertas.com.br
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Cookies e Tecnologias de Rastreamento</h2>
            <p>
              Utilizamos cookies e tecnologias similares para:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Manter sua sessão ativa</li>
              <li>Lembrar suas preferências</li>
              <li>Analisar o uso da plataforma</li>
              <li>Melhorar nossos serviços</li>
            </ul>
            <p className="mt-4">
              Você pode gerenciar cookies através das configurações do seu navegador.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Retenção de Dados</h2>
            <p>
              Mantemos seus dados pelo tempo necessário para:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Fornecer os serviços contratados</li>
              <li>Cumprir obrigações legais (até 5 anos para dados fiscais)</li>
              <li>Resolver disputas e fazer cumprir acordos</li>
            </ul>
            <p className="mt-4">
              Após o encerramento da conta, seus dados serão anonimizados ou excluídos em até 30 dias.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Transferência Internacional</h2>
            <p>
              Seus dados podem ser processados em servidores localizados fora do Brasil. 
              Garantimos que essas transferências seguem padrões adequados de proteção de dados.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Mudanças significativas serão 
              comunicadas por e-mail ou notificação na plataforma.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contato do Encarregado (DPO)</h2>
            <p>
              Para questões sobre privacidade e proteção de dados:
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

export default Privacidade;
