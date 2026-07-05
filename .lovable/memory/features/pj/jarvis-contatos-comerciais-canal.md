---
name: Jarvis Contatos Comerciais - Canal WhatsApp Texto
description: Jarvis contata contatos comerciais SOMENTE via WhatsApp texto, nunca por ligação de voz
type: constraint
---
O Jarvis NUNCA faz ligações de voz para os contatos comerciais (tabela `contatos_comerciais`).
Todo contato acionado pelo Jarvis (confirmação de reunião, follow-up de proposta, resposta comercial, check-in de relacionamento) é feito EXCLUSIVAMENTE via **mensagem de WhatsApp texto**, humanizada e gentil.

**Why:** Decisão explícita do dono. Ligações de voz automatizadas com clientes/parceiros próximos são invasivas e quebram a confiança da relação.

**How to apply:**
- Nunca sugerir integração com Twilio Voice, ElevenLabs TTS ou qualquer voice call para o módulo de Contatos Comerciais.
- UI, textos, labels e prompts devem falar em "enviar mensagem" / "acionar via WhatsApp", nunca "ligar" / "chamar".
- A Fase 2 (comando ao Jarvis) e Fase 3 (resposta comercial inteligente) usam apenas o gateway WhatsApp local (Baileys).
