# REPORT PARA CLAUDE — Embedded Signup (WhatsApp Cloud API) falha em `code_exchange`

## Objetivo do fluxo
Onboarding self-service: cada cliente conecta o **próprio** número WhatsApp Business,
com WABA e billing **na conta Meta do cliente** (não na nossa). Usamos o
**Embedded Signup** (Facebook Login for Business, `response_type=code`) e trocamos o
`code` por token na Edge Function `whatsapp-embedded-signup-callback`.

## Onde estamos
Popup da Meta abre corretamente. O usuário conclui o assistente. Ao voltar,
o frontend recebe `authResponse.code`, chama a Edge Function e a Meta responde:

```
Falha ao conectar (code_exchange):
"Não é possível carregar a URL: O domínio dessa URL não está incluído nos domínios do app.
Para carregar essa URL, adicione todos os domínios e subdomínios ao campo Domínios do app
nas configurações do app."
```

Ou seja: o erro **não** é de payload nem de permissão — é o `redirect_uri` sendo
rejeitado pela configuração do app Meta.

## Como está implementado hoje

Frontend (`src/components/ConectarWhatsAppCloud.tsx`):
```ts
const redirectUri = `${window.location.origin}${window.location.pathname}`;
// => https://amzofertas.com.br/configuracoes-whatsapp

window.FB.login(cb, {
  config_id: metaCfg.embedded_config_id,
  redirect_uri: redirectUri,
  response_type: "code",
  override_default_response_type: true,
  extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
});
```
O mesmo `redirect_uri` é enviado ao backend, que repete no
`GET /v25.0/oauth/access_token?client_id=...&client_secret=...&code=...&redirect_uri=...`.

Contexto do app: `947857854845641` ("AMZ Ofertas WA"), permissões
`whatsapp_business_messaging` e `whatsapp_business_management` em **Advanced Access**.

Domínios em jogo (o app é acessado por vários hosts):
- `amzofertas.com.br` (domínio do cliente/produção — onde o erro aparece)
- `hello-buddy-launchpad.lovable.app` (published)
- `id-preview--…lovable.app` (preview)

## Hipótese principal
O app Meta não tem `amzofertas.com.br` em **App Domains** nem a URL exata em
**Facebook Login for Business → Valid OAuth Redirect URIs**. Como usamos
`override_default_response_type: true` com `redirect_uri` explícito, a Meta valida
a URL estritamente (match exato, incluindo path e barra final).

Hipótese secundária: no fluxo Embedded Signup canônico, **não se envia `redirect_uri`**
no `FB.login` nem na troca do code — o SDK usa o próprio endpoint da Meta e o
`code` é trocado sem `redirect_uri`. Se isso for verdade, nossa "correção" anterior
(alinhar os dois `redirect_uri`) foi o que introduziu esse erro.

## Perguntas para você, Claude
1. No **Embedded Signup com `response_type=code` via `FB.login`**, o `redirect_uri`
   deve ser omitido tanto no login quanto no `oauth/access_token`? Qual é o
   comportamento correto documentado hoje (Graph v25.0)?
2. Se o `redirect_uri` for realmente necessário, qual é a lista exata de campos
   a preencher no app: **App Domains**, **Website → Site URL**,
   **Valid OAuth Redirect URIs** — e para múltiplos hosts (domínio custom +
   published + preview), qual estratégia recomenda (uma URL canônica única de
   callback, ex. `https://amzofertas.com.br/auth/whatsapp/callback`, usada por todos)?
3. Vale padronizar um **callback fixo** por app em vez de `window.location.pathname`
   (que muda conforme a rota e quebra o match exato)? Riscos?
4. Existe algum requisito adicional para clientes com WABA própria (billing próprio)
   que possa produzir esse mesmo erro de domínio — por exemplo o app precisar estar
   em modo **Live** e com **Business Verification** concluída?
5. Recomendação de plano de fallback enquanto isso não estabiliza: seguir
   provisionando manualmente o `phone_number_id` do cliente sob a nossa WABA, ou
   insistir no Embedded Signup? Qual o menor caminho para o cliente Paulo Canarim
   (21 97514-1829) ficar ativo hoje?

## Anexo — evidência
Print do dashboard em `amzofertas.com.br/configuracoes-whatsapp` com o toast:
"Falha ao conectar (code_exchange): … O domínio dessa URL não está incluído nos
domínios do app."
