# AMZ RENAVE

Serviço isolado para chamadas ao RENAVE/Serpro e selagem em memória dos
certificados A1 e-CNPJ das lojas. Ele não persiste PFX, senha ou chave privada e
escuta em `127.0.0.1:3012` fora do contêiner.

## Configuração

Variáveis obrigatórias:

```text
AMZ_RENAVE_TOKEN=<token forte para chamadas locais>
AMZ_RENAVE_MASTER_KEY=<32 bytes em base64>
AMZ_RENAVE_KEY_VERSION=<identificador da chave atual, por exemplo v1>
```

Variáveis opcionais:

```text
AMZ_RENAVE_MASTER_KEY_PREV=<chave anterior de 32 bytes em base64>
AMZ_RENAVE_PROD_ENABLED=true
```

Sem chave mestra válida o processo encerra antes de abrir a porta. Produção
permanece bloqueada quando `AMZ_RENAVE_PROD_ENABLED` não é exatamente `true`.

## Execução

```bash
docker build -t amz-renave:renave-1 services/amz-renave

docker run --rm \
  --name amz-renave \
  -p 127.0.0.1:3012:3012 \
  --read-only \
  --cap-drop ALL \
  --env-file /root/amz-renave.env \
  amz-renave:renave-1
```

O contêiner roda como usuário não-root, não declara volumes e não precisa
escrever no filesystem. A porta interna aceita conexões do bridge Docker, mas
o comando acima a publica somente no loopback do host.

## Rotas

- `GET /health`: única rota sem autenticação.
- `POST /certificados/selar`: valida e sela um PFX e-CNPJ ICP-Brasil.
- `POST /renave/chamar`: executa uma operação da whitelist.

As duas rotas `POST` exigem `X-RENAVE-Token`. Em homologação, omitir
`params.cnpjEstabelecimento` usa o cliente-padrão do Serpro
(`85106037000585`). Quando informado, esse parâmetro é enviado como o header
`CNPJ-Estabelecimento`, nunca como query string.

Operações permitidas:

```text
clienteAutenticado
aptidaoVeiculo
consultarVeiculos
consultarEstoques
municipios
mockVeiculoUsado (somente homologação)
```

Em produção, `lojaId` e `selado` são obrigatórios. O certificado é aberto
somente em memória, usado por um `https.Agent` exclusivo daquela requisição e
os buffers são zerados ao final.

## Testes

```bash
cd services/amz-renave
npm ci
npm test
npm run typecheck
```

Smoke de homologação, sem certificado:

```bash
AMZ_RENAVE_TOKEN='<token local>' \
  node services/amz-renave/scripts/smoke-hom.mjs
```

O smoke mostra somente status, etapas e a placa mascarada. Logs do serviço
também são limitados a `requestId`, operação, ambiente, status, duração e
`lojaId`; corpo, documentos, placa completa e segredos nunca são registrados.
