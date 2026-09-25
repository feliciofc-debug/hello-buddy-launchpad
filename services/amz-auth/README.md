# Cadastro no `amz-auth`

O arquivo `signup-route.js` é o módulo versionado da rota `POST /auth/v1/signup`
que deve ser carregado pelo `/opt/amz-auth/server.js`.

Integração no servidor, depois de criar `app`, `pool` e importar o mesmo
`bcrypt` usado pelo login:

```js
const {
  createSignupNotifier,
  registerSignupRoute,
} = require('/caminho/do/deploy/signup-route');

registerSignupRoute({
  app,
  pool,
  bcrypt,
  notifySignup: createSignupNotifier({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
  rateLimit: {
    windowMs: Number(process.env.SIGNUP_RATE_LIMIT_WINDOW_MS || 900000),
    max: Number(process.env.SIGNUP_RATE_LIMIT_MAX || 5),
  },
});
```

Se o Express estiver atrás do nginx, configure uma única vez:

```js
app.set('trust proxy', 1);
```

Isso faz `req.ip` usar o IP encaminhado pelo proxy sem confiar livremente em
uma cadeia arbitrária de `X-Forwarded-For`.

Variáveis necessárias:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOTRUE_SITE_INSTANCE_ID` (opcional; usa o UUID zero por compatibilidade)
- `SIGNUP_RATE_LIMIT_WINDOW_MS` (opcional; padrão 15 minutos)
- `SIGNUP_RATE_LIMIT_MAX` (opcional; padrão 5 tentativas por IP)

Antes de reiniciar o serviço, aplique a migration
`20260925121500_signup_plan_selection.sql` e publique a função
`notify-new-signup`.
