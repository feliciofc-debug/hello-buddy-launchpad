---
name: LinkedIn Fase 1 (perfil pessoal)
description: Integração LinkedIn multi-tenant — OAuth w_member_social, publicação /rest/posts e link sempre no primeiro comentário
type: feature
---
Escopo Fase 1: apenas PERFIL PESSOAL (`urn:li:person:{sub}`), scopes `openid profile email w_member_social` (self-serve, sem aprovação manual da Meta/LinkedIn).

Arquitetura:
- Tabela `linkedin_connections` (1 por `user_id`, RLS por `auth.uid()`), `linkedin_oauth_states` (service_role only).
- `social_posts_queue` aceita `platform = 'linkedin'` com `linkedin_post_urn`, `post_text_linkedin`, `link_no_primeiro_comentario`. `page_id` é nullable (não usar o default de Facebook em posts LinkedIn).
- Edge functions: `linkedin-oauth-start` (gera state), `linkedin-oauth-callback` (verify_jwt=false, redirect_uri = URL da própria função), `linkedin-publish`, `linkedin-token-refresh` (cron diário 04:10; access ~60d, refresh ~365d; marca `alert_status='reconectar'`).
- Header obrigatório `LinkedIn-Version: 202601` + `X-Restli-Protocol-Version: 2.0.0`.

REGRA DE ALCANCE: link NUNCA no corpo do post. O helper `separarLink` retira o link do texto e publica como PRIMEIRO COMENTÁRIO via `/rest/socialActions/{urn}/comments`. Se o comentário falhar, o post continua publicado e o erro é registrado.

Tom LinkedIn: profissional, sem emojis, sem gírias. Tool do Jarvis: `publicar_linkedin` (restrita ao dono).

UI: aba LinkedIn em `/configuracoes` (conectar/reconectar/desconectar) e página `/linkedin` (compositor + histórico).
