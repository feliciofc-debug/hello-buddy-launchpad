# Plano — Facebook Ads (Marketing API) — Fase 1: Somente Leitura

Módulo multi-tenant em Lovable + Supabase Edge Functions. Cliente conecta a própria conta de Ads via OAuth; plataforma só lê.

App Meta: `1254152493364240` (Live, Advanced). Permissão `business_management` já aprovada. `ads_read` será solicitada no próximo App Review — código fica pronto.

---

## 1) Schema (migration única)

**Tabela `public.facebook_ads_connections`** (1 linha por `user_id`):

- `user_id uuid` (FK auth.users, unique) — dono
- `meta_user_id text` — id do usuário Meta autenticado
- `access_token text` — token longo (60d). Não exposto no frontend; lido só por edge function via service role.
- `token_expires_at timestamptz`
- `scopes text[]`
- `selected_ad_account_id text` — escolha do cliente quando tem múltiplas contas
- `status text` check (`active`, `expired`, `revoked`, `error`)
- `last_error text`
- `connected_at`, `created_at`, `updated_at`

**GRANTs**: `SELECT, INSERT, UPDATE, DELETE` para `authenticated`; `ALL` para `service_role`. Sem grant para `anon`.

**RLS**:
- `SELECT` próprio: `auth.uid() = user_id` — mas **sem** retornar `access_token` no frontend (usar VIEW `facebook_ads_connections_safe` que omite o token, ou política de coluna).
- `INSERT/UPDATE/DELETE` próprios: `auth.uid() = user_id`.
- Edge functions usam `SUPABASE_SERVICE_ROLE_KEY` para ler o token cru.

**Tabela `public.facebook_ads_insights_cache`** (cache opcional, evita estourar rate limit):
- `user_id`, `ad_account_id`, `level` (account/campaign/adset/ad), `entity_id`, `date_start`, `date_stop`, `metrics jsonb`, `fetched_at`
- Unique `(user_id, ad_account_id, level, entity_id, date_start, date_stop)`
- RLS: SELECT/INSERT/UPDATE próprios; service_role full.

**Trigger `update_updated_at_column`** já existe — reusar.

---

## 2) OAuth (2 edge functions)

Mesmo padrão de `google-ads-auth/callback`.

**`facebook-ads-auth`** (`verify_jwt = true`)
- Input: `userId` (vem do JWT, não confiar no body).
- Monta URL `https://www.facebook.com/v25.0/dialog/oauth` com:
  - `client_id = META_APP_ID`
  - `redirect_uri = https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/facebook-ads-callback`
  - `scope = ads_read,business_management`
  - `state = <user_id assinado com HMAC>` (evita CSRF e garante isolamento)
  - `response_type = code`
- Retorna `{ authUrl }`.

**`facebook-ads-callback`** (`verify_jwt = false`, pública)
- Recebe `code` + `state`. Valida HMAC do state → extrai `user_id`.
- Troca code por **short-lived token**: `GET /v25.0/oauth/access_token?...`
- Troca para **long-lived (60d)**: `GET /v25.0/oauth/access_token?grant_type=fb_exchange_token&...`
- `GET /me?fields=id` para `meta_user_id`.
- UPSERT em `facebook_ads_connections` (service role).
- Redireciona pra `${APP_URL}/marketing/facebook-ads?connected=1`.

**Secrets necessários**: `META_APP_ID` ✅ existe, `META_APP_SECRET` ✅ existe. Reusar.

**Renovação**: token FB de 60d **não tem refresh_token**. Estratégia: cron diário `facebook-ads-refresh-tokens` que, para tokens com `expires_at < now() + 7 dias`, chama de novo `fb_exchange_token` com o próprio token vigente (Meta aceita re-extensão). Se falhar → marca `status=expired` e o frontend pede reconexão.

---

## 3) Leitura de métricas (1 edge function, ações por query)

**`facebook-ads-read`** (`verify_jwt = true`) — concentra todas as leituras pra simplificar review e logging.

Ações via `?action=`:

- `accounts` → `GET /me/adaccounts?fields=id,name,account_status,currency,timezone_name`
- `campaigns` → `GET /act_{ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time`
- `insights` → `GET /act_{ad_account_id}/insights` ou `/{campaign_id}/insights` com:
  - `fields=impressions,clicks,ctr,cpc,spend,reach,frequency,actions`
  - `time_range={'since':'YYYY-MM-DD','until':'YYYY-MM-DD'}`
  - `level=account|campaign`
- `select_account` (POST) → grava `selected_ad_account_id`.

Comportamento padrão (não-negociável):
- Sempre carrega o token via service role pelo `user_id` do JWT.
- Nunca aceita `user_id` do body.
- Trata 190 (token inválido) → marca `status=expired`, retorna 401 estruturado.
- Trata 17/4 (rate limit) → retorna 429 e usa cache se existir.
- Salva resposta em `facebook_ads_insights_cache` (TTL 15min para período corrente, 24h para períodos fechados).

---

## 4) Frontend

**Arquivo novo**: `src/pages/FacebookAds.tsx` (rota `/marketing/facebook-ads`, adicionar em `App.tsx`).

Componentes:
- `ConectarFacebookAdsButton` — chama `facebook-ads-auth`, abre `authUrl` em nova aba/popup.
- Banner de status (conectado / expirado / nunca conectado).
- `SeletorContaAds` — Select com `accounts`, persiste via `select_account`.
- 4 cards de KPI: Gasto, Cliques, CTR, CPC (período selecionado).
- `FiltroPeriodo` — chips 7d / 30d / custom (date range).
- `TabelaCampanhas` — colunas: nome, status, gasto, impressões, cliques, CTR, CPC. Destaque verde na melhor CTR e vermelho na pior (com `spend > 0`).

**Hook**: `useFacebookAds()` em `src/hooks/` — wraps das ações via `supabase.functions.invoke`.

**Nada de chamar Graph API direto do browser. Nada de token no localStorage.**

---

## 5) Segurança (checklist do PR)

- [ ] Token só lido via service role nas edge functions.
- [ ] Frontend nunca recebe `access_token` (VIEW `_safe` ou SELECT com coluna omitida).
- [ ] `state` do OAuth assinado com HMAC usando `META_APP_SECRET` — previne CSRF e troca de tenant.
- [ ] Edge functions de leitura usam SEMPRE `user_id` do JWT, ignoram body.
- [ ] RLS fechada em ambas as tabelas; sem grant pra `anon`.
- [ ] Logs estruturados sem vazar token (mascarar pros 4 últimos chars).
- [ ] Rate limit: respeita 429 da Meta, cache em DB.
- [ ] Sem mudança em `meta_connections` / `integrations` — tabela nova, isolada.

---

## 6) Ordem de execução (quando aprovado)

1. Migration (tabelas + RLS + grants + VIEW segura).
2. `facebook-ads-auth` + `facebook-ads-callback`.
3. Testar OAuth ponta-a-ponta com a conta da AMZ (1 cliente).
4. `facebook-ads-read` (accounts → campaigns → insights, nessa ordem).
5. Página `/marketing/facebook-ads` + hook.
6. Cron `facebook-ads-refresh-tokens` (pg_cron diário 03:00).
7. Smoke test com a AMZ + 1 cliente piloto.

---

## 7) Dependências e premissas

- App Meta `1254152493364240` precisa ter `https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/facebook-ads-callback` adicionado em **Valid OAuth Redirect URIs** antes de testar.
- `ads_read` em Advanced Access ainda não aprovado: o OAuth roda em Dev Mode só para usuários listados como tester/admin/dev do app. Plataforma só vai pra produção após App Review #2.
- Reusa `META_APP_ID` e `META_APP_SECRET` já configurados. Nenhum secret novo necessário nesta fase.

---

## 8) Fora de escopo (Fase 1)

- Criar/editar/pausar campanhas (vem na Fase 2).
- IA otimizadora (Fase 2.3).
- Boost de post (Fase 2.1).
- Webhooks de Ads.
