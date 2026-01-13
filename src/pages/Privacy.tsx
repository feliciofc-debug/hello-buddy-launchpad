import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          {/* Seção 1 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introdução</h2>
            <p className="text-foreground/80 leading-relaxed">
              A AMZ Ofertas está comprometida com a proteção da privacidade e dos dados pessoais de seus usuários. 
              Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações 
              pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e demais 
              legislações aplicáveis.
            </p>
          </section>

          {/* Seção 2 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Dados Coletados</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Coletamos as seguintes categorias de dados pessoais:
            </p>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">2.1. Dados Fornecidos por Você</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Dados de cadastro:</strong> nome completo, CPF/CNPJ, email, telefone/WhatsApp</li>
              <li><strong>Dados de pagamento:</strong> informações de cartão de crédito, PIX ou boleto (processados por gateways seguros)</li>
              <li><strong>Dados de perfil:</strong> foto, biografia, redes sociais, links de afiliado</li>
              <li><strong>Dados de conteúdo:</strong> posts, campanhas, produtos, imagens e vídeos criados</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2. Dados Coletados Automaticamente</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Dados de navegação:</strong> endereço IP, tipo de navegador, sistema operacional, páginas visitadas</li>
              <li><strong>Dados de uso:</strong> horários de acesso, funcionalidades utilizadas, tempo de sessão</li>
              <li><strong>Cookies e tecnologias similares:</strong> identificadores únicos para melhorar a experiência</li>
              <li><strong>Dados de analytics:</strong> métricas de performance de campanhas e produtos</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.3. Dados de Terceiros</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>APIs de marketplaces:</strong> dados de produtos da Amazon, Shopee, Lomadee</li>
              <li><strong>Redes sociais:</strong> dados públicos do Instagram, Facebook, TikTok (quando conectado)</li>
              <li><strong>Google Analytics e Google Ads:</strong> métricas de campanhas publicitárias</li>
            </ul>
          </section>

          {/* Seção 3 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Finalidades do Tratamento de Dados</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Utilizamos seus dados pessoais para as seguintes finalidades:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Prestação de serviços:</strong> fornecer acesso à plataforma e suas funcionalidades</li>
              <li><strong>Gestão de conta:</strong> autenticação, recuperação de senha, gerenciamento de assinatura</li>
              <li><strong>Processamento de pagamentos:</strong> cobranças, emissão de notas fiscais e recibos</li>
              <li><strong>Comunicação:</strong> envio de notificações, atualizações, suporte técnico</li>
              <li><strong>Personalização:</strong> oferecer recomendações e conteúdo relevante</li>
              <li><strong>Analytics:</strong> análise de uso para melhorias da plataforma</li>
              <li><strong>Marketing:</strong> envio de ofertas e novidades (com seu consentimento)</li>
              <li><strong>Segurança:</strong> prevenção de fraudes e proteção da plataforma</li>
              <li><strong>Cumprimento legal:</strong> atender obrigações legais e regulatórias</li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Base Legal para Tratamento</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Tratamos seus dados pessoais com base nas seguintes hipóteses legais previstas na LGPD:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Execução de contrato:</strong> fornecimento dos serviços contratados</li>
              <li><strong>Consentimento:</strong> quando você autoriza expressamente (ex: marketing)</li>
              <li><strong>Legítimo interesse:</strong> melhorias da plataforma, segurança, analytics</li>
              <li><strong>Cumprimento de obrigação legal:</strong> emissão de notas fiscais, retenção de impostos</li>
              <li><strong>Exercício regular de direitos:</strong> defesa em processos judiciais</li>
            </ul>
          </section>

          {/* Seção 5 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Compartilhamento de Dados</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Podemos compartilhar seus dados pessoais com:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Processadores de pagamento:</strong> Stripe, Mercado Pago, PagSeguro (para processar transações)</li>
              <li><strong>Provedores de infraestrutura:</strong> Supabase, Google Cloud (para hospedagem e banco de dados)</li>
              <li><strong>Ferramentas de analytics:</strong> Google Analytics (para métricas de uso)</li>
              <li><strong>APIs de terceiros:</strong> Amazon, Shopee, Lomadee (para busca de produtos)</li>
              <li><strong>Provedores de IA:</strong> Google Gemini, OpenAI (para geração de conteúdo)</li>
              <li><strong>Autoridades legais:</strong> quando exigido por lei ou ordem judicial</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              Todos os parceiros são cuidadosamente selecionados e se comprometem a proteger seus dados conforme esta política e a LGPD.
            </p>
          </section>

          {/* Seção 6 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Transferência Internacional de Dados</h2>
            <p className="text-foreground/80 leading-relaxed">
              Alguns de nossos provedores de serviços estão localizados fora do Brasil (ex: Google Cloud, OpenAI). 
              Garantimos que essas transferências sejam realizadas com cláusulas contratuais adequadas e em conformidade 
              com a LGPD, assegurando nível de proteção equivalente ao oferecido no Brasil.
            </p>
          </section>

          {/* Seção 7 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Armazenamento e Retenção de Dados</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Armazenamos seus dados pessoais enquanto:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li>Sua conta estiver ativa na plataforma</li>
              <li>For necessário para cumprir obrigações legais (ex: dados fiscais por 5 anos)</li>
              <li>For necessário para exercício de direitos em processos judiciais</li>
              <li>Você não solicitar a exclusão dos seus dados</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              Após o encerramento da conta, seus dados serão mantidos por até 6 meses para fins de auditoria e segurança, 
              exceto quando houver obrigação legal de retenção por período maior.
            </p>
          </section>

          {/* Seção 8 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Segurança dos Dados</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Implementamos medidas técnicas e organizacionais para proteger seus dados:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Criptografia:</strong> dados sensíveis criptografados em trânsito (HTTPS/TLS) e em repouso</li>
              <li><strong>Controle de acesso:</strong> autenticação multifator e controle de permissões</li>
              <li><strong>Monitoramento:</strong> logs de auditoria e detecção de atividades suspeitas</li>
              <li><strong>Backups:</strong> cópias de segurança regulares dos dados</li>
              <li><strong>Testes:</strong> avaliações periódicas de segurança e vulnerabilidades</li>
              <li><strong>Treinamento:</strong> capacitação da equipe sobre proteção de dados</li>
            </ul>
          </section>

          {/* Seção 9 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Seus Direitos (LGPD)</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              De acordo com a LGPD, você tem os seguintes direitos:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Confirmação e acesso:</strong> confirmar se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> corrigir dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários ou tratados irregularmente</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado e interoperável</li>
              <li><strong>Eliminação:</strong> excluir dados tratados com seu consentimento</li>
              <li><strong>Informação:</strong> sobre compartilhamento de dados com terceiros</li>
              <li><strong>Revogação de consentimento:</strong> retirar consentimento a qualquer momento</li>
              <li><strong>Oposição:</strong> opor-se ao tratamento de dados em determinadas situações</li>
              <li><strong>Revisão:</strong> de decisões automatizadas baseadas em seus dados</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              Para exercer seus direitos, entre em contato através do email: <strong>amzofertas@amzofertas.com.br</strong>
            </p>
          </section>

          {/* Seção 10 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Cookies e Tecnologias de Rastreamento</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Utilizamos cookies e tecnologias similares para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Cookies essenciais:</strong> necessários para funcionamento da plataforma (login, sessão)</li>
              <li><strong>Cookies de performance:</strong> análise de uso e métricas (Google Analytics)</li>
              <li><strong>Cookies de funcionalidade:</strong> lembrar preferências do usuário (tema, idioma)</li>
              <li><strong>Cookies de marketing:</strong> personalização de anúncios (com consentimento)</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              Você pode gerenciar cookies através das configurações do seu navegador, mas isso pode afetar 
              algumas funcionalidades da plataforma.
            </p>
          </section>

          {/* Seção 11 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Dados de Menores de Idade</h2>
            <p className="text-foreground/80 leading-relaxed">
              Nossos serviços são destinados a pessoas maiores de 18 anos. Não coletamos intencionalmente dados de 
              menores de idade sem o consentimento dos pais ou responsáveis legais. Se tomarmos conhecimento de que 
              coletamos dados de menores sem autorização, tomaremos medidas imediatas para excluir tais informações.
            </p>
          </section>

          {/* Seção 12 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Alterações nesta Política</h2>
            <p className="text-foreground/80 leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças em nossas práticas 
              ou na legislação. Notificaremos você sobre alterações significativas por email ou através de aviso na 
              plataforma. Recomendamos que você revise esta política regularmente.
            </p>
          </section>

          {/* Seção 13 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Encarregado de Proteção de Dados (DPO)</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Nosso Encarregado de Proteção de Dados está disponível para esclarecer dúvidas sobre o tratamento 
              de dados pessoais e auxiliá-lo no exercício de seus direitos:
            </p>
            <ul className="list-none space-y-2 text-foreground/80 ml-4">
              <li><strong>Email:</strong> amzofertas@amzofertas.com.br</li>
            </ul>
          </section>

          {/* Seção 14 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contato</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Para dúvidas, solicitações ou reclamações relacionadas à privacidade e proteção de dados:
            </p>
            <ul className="list-none space-y-2 text-foreground/80 ml-4">
              <li><strong>Email:</strong> amzofertas@amzofertas.com.br</li>
              <li><strong>WhatsApp:</strong> Disponível através da plataforma</li>
              <li><strong>Horário de atendimento:</strong> Segunda a Sexta, 9h às 18h</li>
            </ul>
          </section>

          {/* Seção 15 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Autoridade Nacional de Proteção de Dados (ANPD)</h2>
            <p className="text-foreground/80 leading-relaxed">
              Caso você não esteja satisfeito com nossas respostas sobre o tratamento de seus dados pessoais, 
              você pode registrar uma reclamação junto à Autoridade Nacional de Proteção de Dados (ANPD) através 
              do site: <strong>www.gov.br/anpd</strong>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © {new Date().getFullYear()} AMZ Ofertas. Todos os direitos reservados.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
