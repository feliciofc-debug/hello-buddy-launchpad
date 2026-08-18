---
name: Copy do vídeo acompanha a fala, sem CTA no fim
description: Regras das 3 copies do fluxo de vídeo legendado (rede Ademicon): mesmo assunto da transcrição mas reescrito, link sozinho na 1ª linha, copy termina no raciocínio
type: feature
---

- A copy trata do MESMO assunto falado no vídeo (lance, FGTS, contemplação, taxa, caso de cliente), mas **escrita, não transcrita**. Deve fazer sentido lida sozinha, antes do play.
- Proibido: repetir frases do vídeo, citar dia/local/"estou aqui"/"nesse vídeo", "assista"/"dá o play".
- **A copy termina no raciocínio, nunca em convite.** Sem "me chama", "clica no link", "fale comigo", sem pergunta final.
- Link de atendimento vai **sozinho na primeira linha**, sem frase de chamada (`aplicarEstiloCopy` em `_shared/copy-style.ts`).
- 1ª pessoa sem vitrine: "o que eu mais vejo", "aprendi que" — nunca "eu tenho a solução"/"sou especialista". Centro da frase = situação do leitor.
- Palavras proibidas: financiamento, empréstimo, crédito barato, juros, banco, realizar sonhos, parcela que cabe no bolso, o melhor, imperdível. Máx. 1 emoji.
- 3 opções = mesmo assunto, 3 entradas diferentes. Máx. 500 chars, 3-6 hashtags.
- Implementado no prompt de `gerarTresCopies` em `supabase/functions/_shared/video-legenda-flow.ts` (template compartilhado, vale para toda a rede Ademicon).
