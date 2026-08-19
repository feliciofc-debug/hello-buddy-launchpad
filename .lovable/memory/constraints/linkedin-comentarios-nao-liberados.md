---
name: LinkedIn — API de comentários bloqueada (403)
description: /rest/socialActions/{urn}/comments retorna 403 ACCESS_DENIED para apps self-serve; usar fallback de link no corpo
type: constraint
---
`POST /rest/socialActions/{postUrn}/comments` retorna `403 ACCESS_DENIED — partnerApiSocialActions.CREATE` para apps com apenas `openid profile email w_member_social`. Criar comentário exige permissão de parceiro (Community Management API, aprovação manual).

**Por isso:** a regra "link no primeiro comentário" não é executável hoje. Em `linkedin-publish`, se o comentário falhar, o link é acrescentado ao corpo do post via `PARTIAL_UPDATE` em `/rest/posts/{urn}` (`adicionarLinkNoCorpo`). O post nunca fica sem link em silêncio: a resposta traz `link_no_corpo` e `link_ausente`, e a UI mostra aviso com o motivo.

Não "corrigir" o encoding do URN nem trocar endpoint — o formato já está correto; o bloqueio é de permissão.
