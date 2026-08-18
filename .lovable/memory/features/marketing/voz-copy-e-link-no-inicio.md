---
name: Voz da copy por tenant e link no início da legenda
description: empresa_config.voz_copy ('empresa'|'pessoa') + nome_assinatura; link de atendimento sempre no INÍCIO da legenda (Instagram corta em ~125 chars)
type: feature
---

- `empresa_config.voz_copy`: `'empresa'` (padrão, 1ª pessoa do plural) ou `'pessoa'` (1ª pessoa do singular, "me chama", assina com `nome_assinatura`).
- Helper único: `supabase/functions/_shared/copy-style.ts` (`getCopyStyle`, `aplicarEstiloCopy`, `userIdDoRequest`).
- Link de atendimento: `empresa_config.link_post`; se vazio, `https://wa.me/<whatsapp_config.display_phone>` do PRÓPRIO user_id. Nunca constante no código.
- O link vai no **início** da legenda (Instagram corta com "... mais" em ~125 caracteres) — aplicado em publicação por `_shared/link-post.ts` (`appendLinkPost`), idempotente.
- Prompt de voz injetado em: `gerar-posts`, `gerar-conteudo-ia`, `generate-social-post`, `gerar-carousel-content`, `_shared/video-legenda-flow.ts` (fluxo A/B/C) e `_shared/agent-soul.ts`.
- UI: card "Voz das legendas" em `/whatsapp-painel`.
- Tenant Paulo Canarim (`d6159ef4-f0bd-4935-a335-c5e8964e4f17`): voz `pessoa`, assinatura "Paulo Canarim".
