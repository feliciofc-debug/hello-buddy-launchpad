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
- [x] Criar nova trilha instrumental profissional, temática de liberdade, com volume audível e mixar em nova versão do teaser

## Campanha "AMZ em 30 Segundos" — 30 dias
- [x] Calendário de 30 dias com 6 pilares (impacto, agendar com IA, multi-plataforma, agente no WhatsApp, resultados, CTA/objeção)
- [x] Produzir lote 1 (dias 1 a 5, 1 por pilar) em Remotion vertical 9:16 — `/mnt/documents/amz-30-dias/dia-01..05`
- [ ] Produzir lotes 2 a 6 reaproveitando cenas
- [x] Trilha sonora comum a toda a série (identidade sonora)
- [x] Legenda embutida em todos os vídeos

## TikTok — aprovação da API
- [ ] Definir URL pública para o cadastro (site institucional já existe: /plataforma, /integracoes, /sobre, /contato)
- [ ] Plano B: criar conta de teste e informar no campo Apply Reason
- [ ] Garantir que revisores consigam entrar, conectar a conta TikTok e fazer uma postagem de teste em sandbox

## Vídeos animados — controle da renderização
- [x] Diagnosticar o job da Ademicon e confirmar seu resultado final.
- [x] Permitir cancelar jobs na fila ou em renderização pela tela Meus Produtos.
- [x] Impedir que uma conclusão tardia do worker reative um job cancelado.
