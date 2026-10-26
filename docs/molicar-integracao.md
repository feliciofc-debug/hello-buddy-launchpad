# Integração KBB-Molicar (Decoder v3)

## Fluxo

Cada loja conecta a própria conta em **Gestão → Integrações → Molicar**. O
`client_secret` é cifrado com `GESTAO_INTEGRACOES_KEY` e nunca volta ao
navegador. O teste de conexão solicita apenas um token OAuth; não consome uma
consulta de veículo.

`molicar-consulta` aceita placa ou chassi, respeita o teto mensal e reaproveita
identificação por até 365 dias. Preços são atualizados conforme o intervalo da
loja (7 dias por padrão). Consultas vinculadas ao estoque geram snapshots
`molicar_b2c`, `molicar_b2b` e `molicar_c2b` sem alterar o fluxo FIPE.

`molicar-refresh` atualiza veículos ativos com preço vencido, começando pelos
mais antigos no estoque e parando no teto mensal. O endpoint exige a service
key ou `MOLICAR_CRON_SECRET`.

Todos os blocos da resposta são opcionais. Antes da persistência, nomes,
documentos e outros campos pessoais de proprietário ou financiado são
removidos recursivamente. RENAVAM fica somente na tabela interna e não é
devolvido pela function.

## Variáveis

- `GESTAO_INTEGRACOES_KEY`: chave usada pelo cofre de integrações existente.
- `MOLICAR_TOKEN_URL`: opcional; padrão
  `https://auth-decoder.molicar.com.br/oauth2/token`.
- `MOLICAR_DECODER_URL`: opcional; padrão
  `https://decoder.molicar.com.br`.
- `MOLICAR_CRON_SECRET`: segredo alternativo para o refresh agendado.
- `MOLICAR_DECODER_CLIENT_ID` e `MOLICAR_DECODER_CLIENT_SECRET`: credenciais
  da conta AMZ.
- `MOLICAR_AMZ_TENANTS`: lista de `user_id` separada por vírgulas. As
  credenciais AMZ nunca são usadas para tenants fora desta lista.

## Cache, consumo e fallback

- O consumo mensal aumenta antes de cada chamada Decoder efetiva; resposta de
  cache não consome cota.
- HTTP 429 não é repetido. HTTP 401 renova o token uma única vez.
- O Giro usa B2B Molicar quando disponível. A desvalorização usa dois snapshots
  B2C separados por pelo menos 25 dias; sem esse histórico, mantém a taxa/FIPE
  já configurada.
- Ausência de `Pricing` ou de blocos de procedência não invalida a consulta.
  No painel, a ausência é mostrada como “Procedência: serviço não contratado”.
