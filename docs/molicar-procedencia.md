# Molicar — procedência assíncrona

Documentação oficial consultada em 26/10/2026:

- `https://docs.decodermolicar.com.br/docs/debts/overview`
- páginas de endpoints, resposta, webhook e códigos de Débitos e Restrições,
  Gravame e Renajud;
- páginas gerais de autenticação e configuração de webhooks.

## Autenticação

Todos os endpoints usam OAuth2 Client Credentials, com as mesmas credenciais do
Decoder:

- `POST https://auth-decoder.molicar.com.br/oauth2/token`
- `Content-Type: application/x-www-form-urlencoded`
- body: `grant_type=client_credentials`, `client_id`, `client_secret`
- resposta: `access_token`, `token_type` e `expires_in` (exemplo: 3600)
- chamadas seguintes: `Authorization: Bearer {access_token}`

Erros gerais documentados: `401` para token ausente/inválido e `403` para token
válido sem permissão. A documentação não lista scopes OAuth específicos.

## Fluxo assíncrono

A criação também usa `GET`. Uma resposta `202 PROCESSING` contém `JobId`, que
deve ser persistido. O resultado pode ser obtido por polling com esse `JobId` ou
por webhook. Resultados concluídos ficam disponíveis por 24 horas.

Não há duração típica/máxima de processamento, frequência recomendada de polling
ou política de backoff documentadas.

### Débitos e restrições

Criação:

- placa: `GET https://decoder.molicar.com.br/api/v1/plate/{plate}/debts`
- chassi: `GET https://decoder.molicar.com.br/api/v1/vin/{vin}/debts`

Polling:

- placa: `GET /api/v1/plate/{plate}/debts/{jobId}`
- chassi: a página publica `GET /api/v1/vin/{vin}/debts`, sem `JobId`

Resultado:

- `Plate`, `Vin`
- `Debts.Summary`: `Licensing`, `Ipva`, `Fines`
- `Debts.Details[]`: `Identifier`, `Description`, `Type`, `Total`, `SubTotal`,
  `Fees`, `Fine`, `DueDate`, `OriginalDueDate`, `ReferenceDate`,
  `PaymentStatus`, `Quota`, `PaymentGuid`, `UnavailableReason`
- `Debts.AdditionalData[]`: `Group`, `Key`, `Value1`, `Value2`, `Value3`
- `Debts.Message`
- `Restrictions`: `RenainfRestrictionIndicator`, `HasGravame`,
  `HasSalesAnnouncement`, `HasSellIntention`, `HasAdministrative`,
  `RenajudRestrictionIndicator`, `RfbRestrictionIndicator`, `RobberyOrTheft`,
  `InsuranceClaim`, `Recall`, `Occurrence` e `Restriction1` a `Restriction4`

### Gravame

Criação:

- placa: `GET https://decoder.molicar.com.br/api/v1/plate/{plate}/gravame`
- chassi: `GET https://decoder.molicar.com.br/api/v1/vin/{vin}/gravame`

Polling:

- placa: `GET /api/v1/plate/{plate}/gravame/{jobId}`
- chassi: a página publica `GET /api/v1/vin/{vin}/gravame`, sem `JobId`

Resultado: `Plate`, `Vin`, `Gravame[]` com `FinancedName`,
`FinancedDocumentNumber`, `ProprietaryDocumentType`, `AgentName`, `AgentCnpj`,
`ContractDate`, `State`, `ContractNumber`, `Status`, `RestrictionId`,
`RestrictionDate`, `RestrictionState`, além de `message` opcional quando não há
gravame. Nome e documento do financiado são PII e não devem ser persistidos;
nome/CNPJ do agente financeiro podem ser mantidos.

### Renajud

Criação:

- placa: `GET https://decoder.molicar.com.br/api/v1/plate/{plate}/renajud`

Polling:

- placa: `GET /api/v1/plate/{plate}/renajud/{jobId}`

Resultado: `Plate`, `Renajud[]` com `Restriction`, `Court`, `JudicialBody`,
`Process`, `ProcessDate`, além de `Message` opcional.

A documentação não publica rota Renajud por chassi.

## Status e erros

Os três serviços documentam:

- `202 PROCESSING`: aceito ou ainda processando
- `200 SUCCESS`: concluído com dados
- `200 RESOURCE_NOT_FOUND`: concluído, veículo ausente na base
- `400 INVALID_PARAMETER`: parâmetro ausente ou inválido
- `404 JOB_NOT_FOUND`: protocolo inexistente
- `410 REQUEST_EXPIRED`: solicitação com mais de 24 horas
- `422 UNPROCESSABLE_ENTITY`: não foi possível obter todos os dados; tentar
  novamente

## Webhook

Cada serviço possui uma assinatura separada (`debts`, `gravame`, `renajud`).

- criar/atualizar:
  `POST https://decoder.molicar.com.br/api/v1/webhook-subscriptions`
- listar: `GET https://decoder.molicar.com.br/api/v1/webhook-subscriptions`
- criação exige `EndpointUrl` HTTPS, `SubscriptionType` e `AuthConfig`
- autenticação de entrega aceita OAuth2 Client Credentials, API key em header ou
  API key na query
- esta integração usa `API_KEY` em header para recusar callbacks sem o segredo
  configurado

O callback é `POST application/json`, traz `X-JobId` e o mesmo envelope do
polling. Deve receber resposta em até 20 segundos; qualquer `2xx` confirma.
Respostas `5xx` ou `429` geram até três tentativas de reentrega. O webhook pode
entregar `422 UNPROCESSABLE_ENTITY`.

Na implementação, `MOLICAR_PROCEDENCIA_WEBHOOK_URL` define a URL HTTPS e
`MOLICAR_PROCEDENCIA_WEBHOOK_SECRET` é registrado como `X-Molicar-Webhook-Key`.
O endpoint compara esse segredo antes de ler o body. Um cron mantém polling com
backoff de 30 segundos até 30 minutos para consultas por placa, como recuperação
caso o callback não chegue. Consultas por chassi dependem do webhook porque a
rota oficial de polling com `JobId` não foi publicada.

## Cobrança

A documentação pública consultada não informa preço, momento exato da cobrança
nem se `RESOURCE_NOT_FOUND`, erro ou reconsulta do mesmo veículo são cobrados.
No produto AMZ, por regra funcional, cada serviço disparado reserva uma unidade
do teto mensal; falhas liberam a reserva.

## Dúvidas que a documentação não resolve

1. As rotas de polling por chassi de Débitos e Gravame aparecem sem `{jobId}`.
   Não está claro se isso é intencional ou erro da documentação.
2. Renajud não possui rota por chassi publicada.
3. Não há duração esperada/máxima do processamento nem intervalo de polling.
4. Não há prazo entre as até três reentregas do webhook.
5. Não há scopes OAuth específicos documentados.
6. Não há tabela de custo/cobrança ou regra de cobrança por status.
7. Não está documentado se o provedor envia callbacks duplicados ou fora de
   ordem; por isso o consumidor deve ser idempotente pelo `JobId`.
