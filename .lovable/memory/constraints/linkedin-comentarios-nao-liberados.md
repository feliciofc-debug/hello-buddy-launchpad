---
name: LinkedIn — API de comentários bloqueada (403)
description: /rest/socialActions/{urn}/comments retorna 403 ACCESS_DENIED para apps self-serve; usar fallback de link no corpo
type: constraint
---
`POST /rest/socialActions/{postUrn}/comments` retorna `403 ACCESS_DENIED — partnerApiSocialActions.CREATE` para apps com apenas `openid profile email w_member_social`. Criar comentário exige permissão de parceiro (Community Management API, aprovação manual).

**Por isso:** o link NÃO é acrescentado depois da publicação. Editar post (`PARTIAL_UPDATE` em `/rest/posts/{urn}`) também retorna 403 no escopo `w_member_social` — que só permite CRIAR post. O link é montado dentro do `commentary` ANTES do POST único de criação (`posicionarLinkLinkedIn`), depois do raciocínio e antes das hashtags.

A tentativa de comentário permanece no código dentro de try/catch silencioso, só para quando a permissão de parceiro sair. Não fazer nenhuma chamada extra após a criação do post.
