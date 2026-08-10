---
name: TikTok Dual Client Keys (Sandbox vs Produção)
description: O app TikTok tem duas client_keys distintas — produção aw2ouo90dyp4ju9w e sandbox sbawx08s3trep7gfvg — e regras de qual usar em cada momento
type: feature
---

O app TikTok possui DOIS ambientes, cada um com credenciais próprias:

- **Produção**: `client_key = aw2ouo90dyp4ju9w` + `TIKTOK_CLIENT_SECRET` de produção.
  Só permite postagem pública depois que o app passar no **review** do TikTok.
  Antes da aprovação, funciona apenas para contas listadas como *Target Users*
  (contas de teste adicionadas no app) e com privacidade restrita.
- **Sandbox**: `client_key = sbawx08s3trep7gfvg` + client_secret do sandbox.
  Serve para testes: os posts entram como rascunho/`SELF_ONLY` (privado),
  não requer review, e só funciona para as contas adicionadas ao sandbox.

Regras:
- A **Redirect URI** `https://amzofertas.com.br/tiktok/callback` deve estar
  cadastrada nos DOIS ambientes (sandbox e produção), sem barra final.
- O domínio verificado (`public/tiktok*.txt`) também precisa estar válido nos dois.
- Não é possível usar sandbox e produção com a mesma credencial — a troca é
  por client_key + client_secret. Se ambos precisarem coexistir, usar um flag
  de ambiente (ex.: `TIKTOK_ENV=sandbox|producao`) que seleciona o par de
  credenciais no frontend e na edge function `tiktok-auth-callback`.
- Tokens obtidos num ambiente NÃO valem no outro: ao trocar de ambiente é
  necessário reconectar (novo OAuth) e limpar a row de `integrations`
  (`platform = 'tiktok'`) do usuário.
- Hoje o código usa a client_key de PRODUÇÃO hardcoded no frontend
  (`TikTokIntegrationCard.tsx`, `AfiliadoTikTok.tsx`, `SettingsPage.tsx`,
  `TikTokShareModal.tsx`) e `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` como
  secrets na edge function.
