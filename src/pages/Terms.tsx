import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
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
        <h1 className="text-4xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          {/* Seção 1 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Aceitação dos Termos</h2>
            <p className="text-foreground/80 leading-relaxed">
              Ao acessar e usar a plataforma AMZ Ofertas, você concorda em cumprir e estar sujeito aos seguintes termos e condições de uso. 
              Se você não concordar com qualquer parte destes termos, não deverá usar nossos serviços.
            </p>
          </section>

          {/* Seção 2 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Descrição dos Serviços</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              A AMZ Ofertas é uma plataforma de marketing digital que oferece:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li>Ferramentas de busca e análise de produtos para afiliados</li>
              <li>Integração com marketplaces (Amazon, Shopee, Lomadee, etc.)</li>
              <li>Geração de conteúdo com inteligência artificial</li>
              <li>Gestão de campanhas de marketing digital</li>
              <li>Analytics e métricas de performance</li>
              <li>Marketplace para conexão entre indústrias e afiliados</li>
            </ul>
          </section>

          {/* Seção 3 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Cadastro e Conta de Usuário</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Para utilizar nossos serviços, você deve:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li>Fornecer informações verdadeiras, precisas e completas durante o cadastro</li>
              <li>Manter suas credenciais de acesso em sigilo</li>
              <li>Notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta</li>
              <li>Ser maior de 18 anos ou ter autorização dos responsáveis legais</li>
              <li>Ter CPF/CNPJ válido para cadastro</li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Planos e Pagamentos</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Nossa plataforma oferece diferentes planos de assinatura:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li><strong>Plano Grátis:</strong> Acesso limitado a funcionalidades básicas</li>
              <li><strong>Plano Empresa (R$ 97/mês):</strong> Ferramentas completas de marketing local</li>
              <li><strong>Plano Indústria (R$ 947/mês):</strong> Solução completa para fabricantes e marcas</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              Os pagamentos podem ser realizados via PIX, cartão de crédito ou boleto. 
              A cobrança é recorrente e renovada automaticamente até o cancelamento.
            </p>
          </section>

          {/* Seção 5 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Política de Cancelamento e Reembolso</h2>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li>Você pode cancelar sua assinatura a qualquer momento através das configurações da conta</li>
              <li>O cancelamento interrompe cobranças futuras, mas não gera reembolso proporcional</li>
              <li>Após o cancelamento, você mantém acesso até o fim do período já pago</li>
              <li>Garantia de 7 dias: reembolso total se solicitado dentro dos primeiros 7 dias da primeira assinatura</li>
            </ul>
          </section>

          {/* Seção 6 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Uso Aceitável</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Você concorda em NÃO utilizar a plataforma para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li>Violar qualquer lei ou regulamento aplicável</li>
              <li>Enviar spam, malware ou conteúdo malicioso</li>
              <li>Fazer engenharia reversa ou tentar acessar sistemas não autorizados</li>
              <li>Compartilhar sua conta com terceiros</li>
              <li>Usar bots ou automações não autorizadas</li>
              <li>Divulgar produtos ilegais, perigosos ou inadequados</li>
              <li>Violar direitos autorais ou de propriedade intelectual</li>
            </ul>
          </section>

          {/* Seção 7 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Propriedade Intelectual</h2>
            <p className="text-foreground/80 leading-relaxed">
              Todo o conteúdo da plataforma AMZ Ofertas, incluindo mas não limitado a textos, gráficos, logos, ícones, imagens, 
              clipes de áudio, downloads digitais e compilações de dados, é de propriedade exclusiva da AMZ Ofertas ou de seus 
              licenciadores e está protegido pelas leis de direitos autorais e propriedade intelectual.
            </p>
          </section>

          {/* Seção 8 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitação de Responsabilidade</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              A AMZ Ofertas não se responsabiliza por:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li>Resultados de vendas ou comissões obtidas através da plataforma</li>
              <li>Interrupções temporárias do serviço por manutenção ou problemas técnicos</li>
              <li>Mudanças nas políticas de programas de afiliados de terceiros (Amazon, Shopee, etc.)</li>
              <li>Perda de dados decorrente de falhas técnicas ou ações do usuário</li>
              <li>Danos indiretos, incidentais ou consequenciais</li>
            </ul>
          </section>

          {/* Seção 9 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Privacidade e Proteção de Dados</h2>
            <p className="text-foreground/80 leading-relaxed">
              Coletamos e processamos seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD). 
              Para mais informações sobre como tratamos seus dados, consulte nossa Política de Privacidade.
            </p>
          </section>

          {/* Seção 10 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Modificações dos Termos</h2>
            <p className="text-foreground/80 leading-relaxed">
              Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente 
              após a publicação na plataforma. O uso continuado dos serviços após as modificações constitui aceitação dos novos termos.
            </p>
          </section>

          {/* Seção 11 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Suspensão e Encerramento de Conta</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Podemos suspender ou encerrar sua conta caso:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80 ml-4">
              <li>Você viole estes termos de uso</li>
              <li>Haja suspeita de fraude ou atividade ilegal</li>
              <li>Seu pagamento seja recusado ou esteja em atraso</li>
              <li>Você solicite o encerramento da conta</li>
            </ul>
          </section>

          {/* Seção 12 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Lei Aplicável e Foro</h2>
            <p className="text-foreground/80 leading-relaxed">
              Estes termos são regidos pelas leis da República Federativa do Brasil. 
              Qualquer disputa será resolvida no foro da comarca da sede da empresa, 
              com renúncia expressa a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          {/* Seção 13 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contato</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Para dúvidas, sugestões ou suporte relacionado a estes termos, entre em contato:
            </p>
            <ul className="list-none space-y-2 text-foreground/80 ml-4">
              <li><strong>Email:</strong> amzofertas@amzofertas.com.br</li>
              <li><strong>WhatsApp:</strong> Disponível através da plataforma</li>
              <li><strong>Horário de atendimento:</strong> Segunda a Sexta, 9h às 18h</li>
            </ul>
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

export default Terms;
