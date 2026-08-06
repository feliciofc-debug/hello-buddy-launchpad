---
name: Botão de 1 toque padrão em todo template
description: Regra multi-tenant — todo template WhatsApp gerado pela plataforma nasce com botão quick-reply/URL; nunca depender de "digite SIM"
type: preference
---

Todo template que a plataforma gera para qualquer cliente (multi-tenant) deve vir com
botão de ação por padrão (1 toque). Nunca depender de o contato digitar ("responda SIM",
"responda SAIR") — digitar derruba a conversão.

Padrões atuais:
- `convite_ebook_v1` (UTILITY): "Sim, quero!" / "Não, obrigado"
- `novidade_v1` (UTILITY): "Quero ver!" / "Agora não"
- `campanha_oferta_img_v1` (MARKETING): "Quero esta oferta!" / "Não quero mais" (link do marketplace no BODY)

**How to apply:** ao criar/rascunhar template, se `botoes` estiver vazio, injetar
quick-reply positivo + negativo. O gate de opt-in do `whatsapp-cloud-inbound-processor`
reconhece resposta por botão (`payload.button.text/payload` e
`interactive.button_reply.id/title`) com prefixos positivos (sim, quero, ver oferta) e
negativos (nao, agora nao, sair, parar) — vale para todos os templates, não só o do ebook.
