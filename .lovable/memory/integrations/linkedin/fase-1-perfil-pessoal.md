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

REGRA DE ALCANCE (definitiva): comentário e edição de post são bloqueados (403) no escopo atual. O link é montado no `commentary` ANTES da criação, via `posicionarLinkLinkedIn` — nunca na primeira linha, sempre depois do raciocínio e ANTES das hashtags. Uma única chamada POST /rest/posts, nada depois. Toggle e tentativa de comentário ficam em try/catch silencioso para o futuro.

ESTRUTURA DA COPY LINKEDIN: (1) observação/raciocínio, (2) um argumento técnico, (3) fecho sem convite/CTA, (4) link, (5) 2-3 hashtags. Proibido escrever "link nos comentários", "link abaixo" e variações.

Tom LinkedIn: profissional, sem emojis, sem gírias. Tool do Jarvis: `publicar_linkedin` (restrita ao dono).

UI: aba LinkedIn em `/configuracoes` (conectar/reconectar/desconectar) e página `/linkedin` (compositor + histórico).
