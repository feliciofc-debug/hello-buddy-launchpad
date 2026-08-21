import SiteLayout from "@/components/site/SiteLayout";

export default function Plataforma() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Plataforma AMZ Ofertas
          </h1>
          <p className="text-lg text-muted-foreground">
            Automação de marketing e atendimento com inteligência artificial,
            integrada às principais redes sociais e ao WhatsApp Business.
          </p>
        </div>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Atendimento no WhatsApp
          </h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            A AMZ Ofertas se conecta à API oficial do WhatsApp Business da Meta,
            usando o número comercial do próprio cliente. O agente de IA é
            treinado no contexto do negócio para responder perguntas frequentes,
            qualificar leads e encaminhar para o atendimento humano quando
            necessário.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            O fluxo de conversa respeita as diretrizes da Meta, trabalha com
            opt-in do usuário e mantém o operador humano no controle da
            transferência. Todas as mensagens ficam registradas no painel da
            conta, com histórico completo e busca por contato.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            A plataforma também permite disparos programados, campanhas por
            segmento e envio de mídia, sempre dentro dos limites de uso da
            Cloud API e das regras anti-spam do WhatsApp.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Publicação em redes sociais
          </h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            O cliente publica diretamente nas páginas e perfis comerciais do
            Instagram, Facebook, TikTok e LinkedIn, sem precisar trocar de
            ambiente. Cada publicação passa por uma etapa de aprovação dentro da
            plataforma antes de ir ao ar.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            A AMZ não publica automaticamente sem ação explícita do usuário. O
            fluxo de aprovação pode ser manual, com agendamento, ou via piloto
            automático configurado pelo cliente, que sempre mantém a palavra
            final sobre o conteúdo aprovado.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            As integrações usam as APIs oficiais de cada rede, com tokens
            vinculados às contas do próprio usuário e revogáveis a qualquer
            momento.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Criação de conteúdo
          </h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            A plataforma gera textos, imagens e carrosséis a partir dos produtos
            e serviços cadastrados pelo cliente. A IA considera o público-alvo, o
            tom de voz configurado e as regras de compliance do negócio para
            produzir variações de copy em poucos segundos.
          </p>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Também é possível editar imagens, aplicar melhorias visuais e
            gerar carrosséis com chamadas de ação. Para vídeos, o sistema oferece
            legendagem automática, que transcreve o áudio e queima as legendas
            diretamente no arquivo final.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Todo conteúdo gerado fica disponível para revisão antes da
            publicação. O cliente escolhe a versão que mais se aproxima da sua
            estratégia e aprova o envio.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Agendamento e piloto automático
          </h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            O calendário de conteúdo permite agendar posts para datas e
            horários específicos, com fila de publicação e notificações de
            sucesso ou falha. O piloto automático mantém a frequência de postagem
            configurada pelo cliente, respeitando os limites de cada rede social.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            O cliente define a quantidade de posts por dia, os horários de
            preferência e as redes ativas. O sistema executa a programação e
            entrega relatório de desempenho por publicação, com métricas de
            alcance, engajamento e cliques.
          </p>
        </section>
      </div>
    </SiteLayout>
  );
}
