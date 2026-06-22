import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Facebook,
  Instagram,
  Link2,
  Rocket,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
      {n}
    </div>
    <div className="flex-1 pt-1">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <div className="text-muted-foreground space-y-2 text-[15px] leading-relaxed">{children}</div>
    </div>
  </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
    <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
    <div className="text-sm text-amber-900 dark:text-amber-200">{children}</div>
  </div>
);

export default function GuiaContasComerciais() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
          <span className="text-sm font-semibold">AMZ Ofertas</span>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/10 to-background py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Rocket className="h-3 w-3" /> GUIA PASSO A PASSO
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Como preparar seu Facebook e Instagram para a AMZ Ofertas
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Em 4 etapas simples você deixa suas redes prontas para receber postagens automáticas e impulsionar seu negócio.
            Tempo estimado: <strong>10 a 15 minutos</strong>.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-10">
        {/* Resumo / Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              O que você vai fazer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2"><span className="font-semibold text-primary">1.</span> Criar uma <strong>Página comercial no Facebook</strong> (Fanpage)</li>
              <li className="flex gap-2"><span className="font-semibold text-primary">2.</span> Transformar seu Instagram em <strong>Conta Profissional</strong></li>
              <li className="flex gap-2"><span className="font-semibold text-primary">3.</span> <strong>Vincular Facebook e Instagram</strong> no Meta Business Suite</li>
              <li className="flex gap-2"><span className="font-semibold text-primary">4.</span> <strong>Conectar tudo</strong> à plataforma AMZ Ofertas</li>
            </ol>
          </CardContent>
        </Card>

        {/* Parte 1 */}
        <section id="parte-1" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center">
              <Facebook className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Parte 1</p>
              <h2 className="text-2xl font-bold">Criar sua Página comercial no Facebook</h2>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <p className="text-muted-foreground">
                A <strong>Página (Fanpage)</strong> é diferente do seu perfil pessoal. Ela é o "endereço comercial" do
                seu negócio no Facebook — sem ela, o Instagram e a AMZ Ofertas não conseguem publicar pra você.
              </p>

              <Step n={1} title="Entre no Facebook">
                Faça login na sua conta pessoal do Facebook (a mesma que você usa todo dia).
              </Step>

              <Step n={2} title="Crie uma nova Página">
                Acesse o link oficial:{" "}
                <a
                  href="https://www.facebook.com/pages/create"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium inline-flex items-center gap-1 hover:underline"
                >
                  facebook.com/pages/create <ExternalLink className="h-3 w-3" />
                </a>{" "}
                e clique em <strong>"Criar nova Página"</strong>.
              </Step>

              <Step n={3} title="Preencha os dados do seu negócio">
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Nome da Página:</strong> o nome do seu negócio (ex: "Loja da Maria")</li>
                  <li><strong>Categoria:</strong> escolha o que mais combina (ex: "Loja de Roupas", "Restaurante")</li>
                  <li><strong>Descrição:</strong> uma frase curta sobre o que você vende</li>
                </ul>
              </Step>

              <Step n={4} title="Coloque foto de perfil e capa">
                Use o <strong>logo</strong> da sua marca como foto de perfil e uma <strong>foto de capa</strong> bonita
                que represente o negócio. Isso passa profissionalismo.
              </Step>

              <Step n={5} title="Finalize">
                Preencha telefone, horário de funcionamento e um botão de ação (ex: "Enviar Mensagem"). Pronto, sua Página está no ar!
              </Step>

              <Tip>
                <strong>Dica:</strong> mantenha o telefone e endereço sempre atualizados. É assim que seus clientes te encontram.
              </Tip>
            </CardContent>
          </Card>
        </section>

        {/* Parte 2 */}
        <section id="parte-2" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center">
              <Instagram className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Parte 2</p>
              <h2 className="text-2xl font-bold">Transformar Instagram em Conta Profissional</h2>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <p className="text-muted-foreground">
                A Conta Profissional é <strong>gratuita</strong> e libera métricas, anúncios e — o mais importante — a integração com a AMZ Ofertas.
              </p>

              <Step n={1} title="Abra seu perfil no app do Instagram">
                Pelo celular, toque na sua foto no canto inferior direito.
              </Step>

              <Step n={2} title="Vá em Configurações">
                Toque no <strong>menu (☰)</strong> no canto superior direito → <strong>"Configurações e privacidade"</strong>.
              </Step>

              <Step n={3} title="Mude para Conta Profissional">
                Role até <strong>"Tipo de conta e ferramentas"</strong> → toque em <strong>"Mudar para conta profissional"</strong>.
              </Step>

              <Step n={4} title="Escolha a categoria">
                Selecione a categoria que descreve seu negócio. Depois escolha <strong>"Empresa"</strong> (recomendado para a maioria dos clientes AMZ).
              </Step>

              <Step n={5} title="Conecte à sua Página do Facebook">
                O Instagram vai oferecer pra você vincular à Página que você criou na Parte 1. <strong>Aceite!</strong> Isso facilita muito o próximo passo.
              </Step>

              <Step n={6} title="Confira suas informações de contato">
                E-mail, telefone e endereço — deixe tudo certo e visível.
              </Step>

              <Tip>
                <strong>Atenção:</strong> se aparecer a opção "Criador de Conteúdo", <strong>NÃO escolha</strong>. Para vender, sempre use "Empresa".
              </Tip>
            </CardContent>
          </Card>
        </section>

        {/* Parte 3 */}
        <section id="parte-3" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
              <Link2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Parte 3</p>
              <h2 className="text-2xl font-bold">Vincular tudo no Meta Business Suite</h2>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <p className="text-muted-foreground">
                O <strong>Meta Business Suite</strong> é o "painel de controle" oficial da Meta. É por ele que a AMZ Ofertas recebe permissão para postar pra você.
              </p>

              <Step n={1} title="Acesse o Meta Business Suite">
                Entre em{" "}
                <a
                  href="https://business.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium inline-flex items-center gap-1 hover:underline"
                >
                  business.facebook.com <ExternalLink className="h-3 w-3" />
                </a>{" "}
                com a mesma conta do Facebook que criou a Página.
              </Step>

              <Step n={2} title="Confira se sua Página apareceu">
                No painel inicial você deve ver sua Página do Facebook listada. Se sim, perfeito.
              </Step>

              <Step n={3} title="Adicione/vincule o Instagram">
                <ul className="list-disc list-inside space-y-1">
                  <li>Menu lateral → <strong>Configurações</strong> (ícone de engrenagem ⚙️)</li>
                  <li>Em <strong>"Contas"</strong> → clique em <strong>"Contas do Instagram"</strong></li>
                  <li>Clique em <strong>"Adicionar conta do Instagram"</strong> e faça login</li>
                  <li>Confirme que ele está vinculado à <strong>Página correta</strong></li>
                </ul>
              </Step>

              <Tip>
                <strong>Como saber se deu certo?</strong> Sua Página do Facebook e seu Instagram precisam aparecer <strong>juntos</strong>, na mesma conta do Business Suite.
              </Tip>
            </CardContent>
          </Card>
        </section>

        {/* Parte 4 */}
        <section id="parte-4" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <Rocket className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Parte 4</p>
              <h2 className="text-2xl font-bold">Conectar à plataforma AMZ Ofertas</h2>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <p className="text-muted-foreground">
                Agora é a parte mais rápida — e a mais importante. Sem essa conexão, a AMZ Ofertas não consegue publicar pra você.
              </p>

              <Step n={1} title="Entre na sua conta AMZ Ofertas">
                Faça login em{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  amzofertas.com.br
                </Link>
                .
              </Step>

              <Step n={2} title="Vá em Configurações → Redes Sociais">
                No menu lateral, abra <strong>Configurações</strong> e depois <strong>"Conectar Redes Sociais"</strong>.
              </Step>

              <Step n={3} title="Faça login no Facebook e autorize TODAS as permissões">
                Você vai cair em uma tela do Facebook pedindo autorização.
                <div className="mt-3 p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900">
                  <div className="flex gap-2">
                    <ShieldCheck className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-900 dark:text-red-200">
                      <strong>MUITO IMPORTANTE:</strong> deixe <strong>TODAS as permissões marcadas (verde/azul)</strong>. Se desmarcar alguma, a automação NÃO vai funcionar.
                    </div>
                  </div>
                </div>
              </Step>

              <Step n={4} title="Selecione a Página e o Instagram certos">
                Marque a Página do Facebook e a conta do Instagram que você configurou. Confirme.
              </Step>

              <Step n={5} title="Pronto! 🎉">
                Você volta automaticamente para a AMZ Ofertas e suas contas aparecem como <strong>conectadas</strong>. A partir de agora, suas postagens são automáticas.
              </Step>
            </CardContent>
          </Card>
        </section>

        {/* Conclusão / CTA */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto" />
            <h2 className="text-2xl font-bold">Parabéns, está tudo pronto!</h2>
            <p className="opacity-90 max-w-xl mx-auto">
              Suas redes sociais estão conectadas e a AMZ Ofertas já pode trabalhar 24h por dia pra impulsionar seu negócio.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button asChild variant="secondary" size="lg">
                <Link to="/login">Entrar na plataforma</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white">
                <a href="https://wa.me/5562999999999" target="_blank" rel="noopener noreferrer">
                  Falar com o suporte
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Ainda com dúvidas? Nosso time de suporte está pronto pra te ajudar em cada etapa.
        </p>
      </main>
    </div>
  );
}
