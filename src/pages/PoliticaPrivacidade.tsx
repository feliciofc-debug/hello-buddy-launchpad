import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function PoliticaPrivacidade() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12 px-4 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        
        <h1 className="text-4xl font-bold mb-8">
          🔒 Política de Privacidade e Cookies
        </h1>
        
        <div className="prose max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Introdução</h2>
            <p className="text-muted-foreground">
              Esta Política de Privacidade descreve como a AMZ Ofertas ("nós", "nosso") 
              coleta, usa e protege suas informações pessoais quando você usa nossa 
              plataforma.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">2. Informações que Coletamos</h2>
            
            <h3 className="text-xl font-semibold mt-4 mb-2">
              2.1. Informações fornecidas por você:
            </h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Nome completo e e-mail (ao criar conta)</li>
              <li>Telefone e WhatsApp (para campanhas)</li>
              <li>Informações de pagamento (via processadores seguros)</li>
              <li>Dados da empresa (CNPJ, endereço)</li>
              <li>Contatos e listas (para campanhas)</li>
            </ul>
            
            <h3 className="text-xl font-semibold mt-4 mb-2">
              2.2. Informações coletadas automaticamente:
            </h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Endereço IP e localização aproximada</li>
              <li>Tipo de dispositivo e navegador</li>
              <li>Páginas visitadas e ações realizadas</li>
              <li>Data e hora de acesso</li>
              <li>Cookies e identificadores únicos</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">3. Como Usamos Suas Informações</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>✅ Fornecer e melhorar nossos serviços</li>
              <li>✅ Processar pagamentos e transações</li>
              <li>✅ Enviar campanhas de marketing (quando autorizado)</li>
              <li>✅ Analisar uso da plataforma (métricas e analytics)</li>
              <li>✅ Prevenção de fraudes e segurança</li>
              <li>✅ Comunicação sobre atualizações e suporte</li>
              <li>✅ Cumprir obrigações legais</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">4. Cookies e Tecnologias Similares</h2>
            
            <h3 className="text-xl font-semibold mt-4 mb-2">
              4.1. Tipos de Cookies que Usamos:
            </h3>
            
            <div className="bg-muted/50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2">🔒 Cookies Necessários</h4>
              <p className="text-sm text-muted-foreground">
                Essenciais para funcionamento básico (login, sessão, segurança).
                Não podem ser desativados.
              </p>
            </div>
            
            <div className="bg-blue-500/10 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2">📊 Cookies de Analytics</h4>
              <p className="text-sm text-muted-foreground">
                Google Analytics para entender uso da plataforma e melhorar experiência.
                Podem ser desativados nas preferências.
              </p>
            </div>
            
            <div className="bg-green-500/10 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2">🎯 Cookies de Marketing</h4>
              <p className="text-sm text-muted-foreground">
                Google Ads, Facebook Pixel para remarketing e medição de campanhas.
                Podem ser desativados nas preferências.
              </p>
            </div>
            
            <div className="bg-purple-500/10 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2">⚡ Cookies Funcionais</h4>
              <p className="text-sm text-muted-foreground">
                Chat, vídeos, personalização. Podem ser desativados nas preferências.
              </p>
            </div>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">5. Seus Direitos (LGPD)</h2>
            <p className="mb-4 text-muted-foreground">Você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>✅ Acessar seus dados pessoais</li>
              <li>✅ Corrigir dados incorretos</li>
              <li>✅ Solicitar exclusão de dados</li>
              <li>✅ Revogar consentimento</li>
              <li>✅ Portabilidade de dados</li>
              <li>✅ Informações sobre compartilhamento</li>
            </ul>
            <p className="mt-4 text-muted-foreground">
              <strong>Para exercer seus direitos:</strong>{' '}
              <a href="mailto:amzofertas@amzofertas.com.br" className="text-primary underline">
                amzofertas@amzofertas.com.br
              </a>
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">6. Segurança</h2>
            <p className="text-muted-foreground">
              Implementamos medidas de segurança técnicas e organizacionais para 
              proteger seus dados contra acesso não autorizado, perda ou destruição:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
              <li>🔒 Criptografia SSL/TLS em todas as comunicações</li>
              <li>🔒 Armazenamento seguro em servidores certificados</li>
              <li>🔒 Autenticação de dois fatores disponível</li>
              <li>🔒 Backups regulares</li>
              <li>🔒 Acesso restrito a dados sensíveis</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">7. Compartilhamento de Dados</h2>
            <p className="mb-4 text-muted-foreground">Compartilhamos dados apenas com:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>✅ Processadores de pagamento (Stripe, Mercado Pago)</li>
              <li>✅ Serviços de analytics (Google Analytics)</li>
              <li>✅ Plataformas de marketing (Google Ads, Meta)</li>
              <li>✅ Infraestrutura cloud (Supabase, Vercel)</li>
              <li>✅ Serviços de comunicação (WhatsApp Business API)</li>
            </ul>
            <p className="mt-4 text-muted-foreground">
              ❌ <strong>NUNCA</strong> vendemos seus dados para terceiros.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">8. Retenção de Dados</h2>
            <p className="text-muted-foreground">
              Mantemos seus dados enquanto sua conta estiver ativa ou conforme 
              necessário para fornecer serviços. Após cancelamento:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
              <li>Dados de conta: 90 dias (backup)</li>
              <li>Dados de transações: 5 anos (obrigação legal)</li>
              <li>Logs de acesso: 6 meses</li>
              <li>Cookies: até revogação do consentimento</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">9. Alterações nesta Política</h2>
            <p className="text-muted-foreground">
              Podemos atualizar esta política periodicamente. Notificaremos sobre 
              mudanças significativas via e-mail ou banner no site.
            </p>
            <p className="mt-4 text-muted-foreground">
              <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold mb-4">10. Contato</h2>
            <p className="mb-4 text-muted-foreground">
              Para dúvidas sobre privacidade ou exercer seus direitos:
            </p>
            <div className="bg-primary/10 p-6 rounded-lg">
              <p><strong>E-mail:</strong> amzofertas@amzofertas.com.br</p>
              <p><strong>WhatsApp:</strong> (21) 98080-4901</p>
              <p><strong>Site:</strong> amzofertas.com.br</p>
            </div>
          </section>
        </div>
        
        <div className="mt-12 pt-8 border-t">
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem('cookie-consent');
              window.location.reload();
            }}
          >
            🍪 Gerenciar Preferências de Cookies
          </Button>
        </div>
      </div>
    </div>
  );
}
