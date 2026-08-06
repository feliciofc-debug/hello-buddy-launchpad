# Plano — 2 pedidos do JARVIS (carrossel por WhatsApp + logo do cliente)

Objetivo: o cliente conversa com o JARVIS no WhatsApp e (1) pede um carrossel, que é gerado com o mesmo padrão visual da plataforma e publicado no Instagram; (2) manda a logo dele uma vez e passa a receber as imagens já com a logo aplicada.

Tudo multi-tenant (por `user_id` do tenant dono do número), sem quebrar nada do funil atual.

---

## Frente 1 — Carrossel pelo WhatsApp

### Como funciona hoje
- O conteúdo do carrossel (slides + legenda) já é gerado por IA na função `gerar-carousel-content`.
- Os 5 templates visuais (`CleanBright`, `DarkPremium`, `ElegantSerif`, `GradientVibrant`, `NeonTech`) e o `SlideRenderer` são componentes React.
- A conversão slide → PNG acontece **no navegador** (`html-to-image`), dentro de `CarouselGenerator.tsx`.
- A publicação já existe: `meta-publish-carousel`.

### O ponto crítico
O JARVIS roda no servidor e não tem navegador, então não consegue usar o exportador atual. Precisamos de uma renderização de slides server-side. Duas opções:

- **Opção A (recomendada):** renderizador server-side próprio — uma função gera o HTML do slide (mesma tipografia/paleta dos templates) e converte em PNG. Fica idêntico ao padrão da plataforma, custo zero por imagem, e passa a servir também o app.
- **Opção B (rápida):** o JARVIS só gera o conteúdo e devolve um link para o cliente abrir a tela de carrossel e publicar com 1 clique. Menos automático, mas entrega em pouco tempo.

Sugestão: fazer B como fallback e A como caminho definitivo.

### Fluxo alvo (Opção A)
```text
Cliente no WhatsApp: "faz um carrossel sobre X"
  -> tool criar_carrossel (tema, nº de slides, template)
  -> gerar-carousel-content (slides + legenda)
  -> render server-side dos slides em PNG (1080x1350) + logo do tenant
  -> upload no Storage (bucket por tenant)
  -> JARVIS envia as imagens no WhatsApp para aprovação
  -> Cliente responde por BOTÃO: [ Publicar ] [ Ajustar ] [ Descartar ]
  -> Publicar -> meta-publish-carousel na conta do tenant
```

### Regras
- Nada é publicado sem aprovação explícita do cliente (botão de 1 toque, padrão da plataforma).
- Publicação sempre na conexão Meta do próprio tenant, sem fallback para a conta admin.
- Todas as imagens passam pelo tratamento de formato já existente (AVIF/PNG → JPEG) antes de ir para a Meta.

---

## Frente 2 — Logo do cliente nas imagens

### Duas coisas diferentes, ambas viáveis
1. **Logo real, pixel-perfect (recomendado):** o cliente manda a logo pelo WhatsApp uma vez; salvamos como asset do tenant e a plataforma **compõe** a logo sobre a imagem gerada (canto configurável, tamanho e opacidade padrão). A logo sai exatamente como é.
2. **Logo interpretada pela IA:** hoje o padrão de imagem da plataforma pede logo "nativa embutida" — a IA redesenha a marca. Bom para cena/ambientação, ruim para fidelidade. Mantemos só como estilo opcional.

### Fluxo alvo
```text
Cliente envia imagem no WhatsApp
  -> JARVIS pergunta: "É a logo da sua empresa? Quer que eu use nas imagens?"
  -> [ Sim, é minha logo ] [ Não, é outra coisa ]
  -> Sim: salva como logo do tenant (Storage privado + registro por user_id)
  -> A partir daí toda imagem gerada sai com a logo aplicada
```
Também exposto na tela de configuração do tenant (upload/troca/remover, com preview), para quem preferir pelo painel.

### Regras
- Uma logo ativa por tenant, isolada por `user_id`.
- Se o tenant não tem logo, a imagem sai sem logo (sem fallback para logo de outro cliente).
- Posição/tamanho com padrão bom e ajustável.

---

## Entregas em ordem

| # | Entrega | Depende de |
| - | ------- | ---------- |
| 1 | Logo do tenant: storage + registro + tela de upload | — |
| 2 | Composição da logo nas imagens geradas | 1 |
| 3 | JARVIS reconhece "essa é minha logo" e salva | 1 |
| 4 | Tool `criar_carrossel` no JARVIS (conteúdo + aprovação por botão) | — |
| 5 | Renderização server-side dos slides no padrão da plataforma | 4 |
| 6 | Publicação aprovada no Instagram do tenant | 4, 5 |

## Notas técnicas
- Novo registro por tenant para a logo (com RLS por `user_id`) e bucket privado, no mesmo padrão de `tenant_ebooks`.
- Renderização de slides no servidor precisa ser uma função nova; os templates React atuais servem de referência visual, não são reaproveitados diretamente.
- Reaproveitar `gerar-carousel-content` (sem mudança de contrato) e `meta-publish-carousel`.
- Toda imagem enviada à Meta continua passando pelo conversor de formato já em produção.
- Aprovação sempre por quick-reply, e o gate de botões do processador de entrada já entende respostas positivas/negativas.
