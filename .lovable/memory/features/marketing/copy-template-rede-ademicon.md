---
name: Template de voz das copies por segmento (rede Ademicon)
description: Regras de voz de TODAS as copies vivem em agent_knowledge_segments.copy_template; consórcio nunca é crédito, copy termina no raciocínio, assinatura com o nome
type: feature
---
As regras de voz das copies são COMPARTILHADAS por segmento, igual ao prompt do agente:
`agent_knowledge_segments.copy_template` (segmento `ademicon-consultor`). Variáveis do tenant: `{{LINK}}` (empresa_config.link_post → fallback wa.me do display_phone) e `{{ASSINATURA}}` (empresa_config.nome_assinatura → fallback whatsapp_cloud_agent_config.nome_consultor).

`_shared/copy-style.ts` → quando o tenant tem `copy_template`, ele SUBSTITUI o bloco genérico de voz; `empresa_config.regras_copy` entra como ajuste complementar. Cobre posts, carrossel, story, gerar-conteudo-ia, gerar-posts e o fluxo A/B/C do vídeo (`_shared/video-legenda-flow.ts` troca o bloco de tom pelo template).

Diretrizes (rede Ademicon):
- CRÉDITO NÃO É CONSÓRCIO: nunca comparar com financiamento/empréstimo/banco, nem indiretamente ("sem juros altos"). Carta de crédito = poder de compra recebido, não dívida.
- Copy TERMINA NO RACIOCÍNIO: zero CTA, zero pergunta no fim. Link sozinho na 1ª linha, sem frase apresentando.
- Primeira pessoa como experiência ("o que eu mais vejo"), nunca vitrine ("eu sou especialista").
- Eixos: preservação de capital / planejamento / vantagem técnica / quebra de objeção. A=capital, B=objeção, C=planejamento. Objeções em rodízio: prazo de contemplação, taxa cara, juntar por conta, precisar sair, comparar com poupança.
- Estrutura: link · observação · UM argumento técnico · fecho · `— Nome` · 3-4 hashtags. Até 4 linhas.
- Proibido: financiamento, empréstimo, crédito barato, juros, banco, parcela que cabe no bolso, realizar sonhos, solução, o melhor, imperdível; hashtags de juros/crédito/financiamento; emoji em excesso.
- ASSINATURA VOLTOU (só quando há copy_template): `aplicarEstiloCopy` insere `— {nome}` antes das hashtags. Isso substitui a antiga regra "posts sem assinatura" para tenants com template.
