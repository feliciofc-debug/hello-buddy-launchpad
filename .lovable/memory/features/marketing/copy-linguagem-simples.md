---
name: Copy simples, não formal, e sem assinatura
description: Regras de vocabulário/ritmo das copies (rede Ademicon): linguagem falada em vez de relatório bancário, 2-3 frases curtas, 3-4 hashtags simples, posts sem assinatura
type: feature
---

- Elegante é SIMPLES, não formal. Proibido tom de relatório bancário.
- Trocas obrigatórias: estruturar a aquisição→comprar; desequilibrar as finanças→apertar o orçamento; preservar a liquidez→não mexer na reserva; potencializar o poder de compra→comprar melhor; aportes programados→parcelas; formação de capital→juntar dinheiro; expansão patrimonial→crescer; custo eficiente→custo que compensa; demanda um olhar atento→vale olhar; desmistificar→explicar; consolidar patrimônio→construir patrimônio.
- Ritmo: frases curtas, uma ideia por frase, 2-3 frases no total. Nunca duas palavras técnicas na mesma frase.
- Abrir pela situação concreta do leitor ("quase todo mundo que me procura..."), nunca pelo conceito.
- Engajamento por reconhecimento, nunca por pergunta ou convite. Segue valendo: link sozinho na 1ª linha, fim no raciocínio, sem CTA.
- Hashtags: 3 (máx. 4), reais e simples (#Consórcio #Ademicon + tema). Proibido inventar #GestãoDeAtivos, #CapitalInteligente.
- POSTS NÃO LEVAM ASSINATURA: `aplicarEstiloCopy` não anexa mais `nome_assinatura`, e os prompts proíbem assinar com nome de pessoa/empresa.
- Implementado em `_shared/copy-style.ts` (promptBlock global) e `_shared/video-legenda-flow.ts`.
