# Roadmap

## Instagram Shopping — sacolinha
- [x] Área de Produtos: campo para informar o ID do produto no catálogo do Instagram.
- [x] Publicação de fotos: enviar `product_tags` quando o produto tiver ID cadastrado.
- [x] Publicação de carrosséis: enviar a tag do produto vinculado no container do carrossel.
- [x] Agendamentos e Autopilot: preservar o `produto_id` e resolver o vínculo no backend, por cliente.
- [ ] Requisitos externos: conta IG Business com Instagram Shopping aprovado, catálogo no Commerce Manager vinculado à conta IG e permissões da Meta aprovadas.
- [ ] Validar publicação real somente depois que o cliente autorizar um teste.

- [x] Áudio no WhatsApp: transcrição determinística via STT dedicado (agente não pode dizer que "não transcreve")

## BART — identidade e notificações do Paulo
- [x] Reconhecer como dono os dois números do Paulo (profissional e pessoal), sem tratá-lo como cliente.
- [x] Registrar status real da notificação (aceita, entregue, lida ou falhou), sem considerar apenas o ID inicial da Meta como entrega.
- [x] Remover completamente o telefone pessoal do cadastro e do conhecimento operacional do BART.
- [x] Fixar todos os reports do BART exclusivamente no profissional 55 21 99720-8854, inclusive após falha de entrega.
