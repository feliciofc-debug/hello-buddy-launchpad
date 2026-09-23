# Importador AMZ — Dry-run A

O Dry-run A valida a exportação da Lovable e o estado atual da VPS sem
alterar autenticação, banco de dados, arquivos ou serviços.

## O que ele verifica

- os JSONs e as quantidades esperadas dos quatro clientes;
- UUIDs, campos obrigatórios, enums e referências entre registros;
- descarte de tokens, configurações antigas e histórico operacional;
- `autopilot_config` sempre planejado com `ativo = false`;
- contas-âncora, e-mails, vínculos de WhatsApp e colisões no PostgreSQL;
- os 5.123 arquivos, tamanho, leitura, SHA-256 e colisões de destino;
- reescrita exclusiva de URLs de
  `jibpvpqgplmahjhswiza.supabase.co`;
- troca do UUID antigo pelo UUID canônico em qualquer componente do caminho;
- espaço livre no filesystem que contém `/opt/amz-media`.

Ele não consulta `storage.buckets` nem `storage.objects`. As pastas sob
`/opt/amz-media` são tratadas como diretórios comuns; pasta ausente é apenas
uma criação planejada para a etapa de importação, não um bloqueador.

## Estrutura esperada

```text
/caminho/export_amz/
  atom/*.json
  duda/*.json
  marcelo/*.json
  renata/*.json
  _arquivos/
    jibpvpqgplmahjhswiza.supabase.co/
      storage/v1/object/public/<caminho-legacy>
```

Cada JSON de tabela pode ser uma lista ou um objeto `{"data": [...]}`.
Se os arquivos estiverem em outra raiz, `--media-dir` aceita tanto a pasta
que contém o host quanto a própria pasta `storage/v1/object/public`.
O UUID antigo do cliente pode estar em qualquer posição do caminho, por
exemplo `<pasta>/<uuid>/<arquivo>` ou
`produtos/midias/<uuid>/<arquivo>`. Quando encontrado, apenas esse componente
é substituído pelo UUID canônico. Caminhos compartilhados sem UUID, como
`produtos/ia-marketing/<arquivo>`, são preservados e geram somente aviso.
Um arquivo regular, legível e íntegro nunca é bloqueado apenas pelo layout do
caminho. Symlinks continuam bloqueados.

## Política de dados

- `integrations`: não importar; reconectar as integrações no ambiente novo;
- `whatsapp_config`: não importar a linha antiga nem seus tokens; preservar as
  duas configurações funcionais da VPS e transferir somente o proprietário;
- `social_posts_queue`: não inserir as 10.861 linhas na fila operacional. Os
  JSONs permanecem como histórico bruto para consulta;
- Marcelo: importar somente `profiles`, `produtos` e `midias_whatsapp`;
  preservar integralmente as configurações e os demais dados já existentes
  na VPS, inclusive WhatsApp e o agente Silvester;
- `autopilot_config`: importar depois com `ativo=false` e
  `proxima_execucao=NULL`;
- `midias_whatsapp`: descartar `arquivo_nome`, `generation_job_id` e
  `generation_job_type`, ausentes no destino;
- `autopilot_config`: descartar `desativado_em`, `desativado_motivo` e
  `desativado_por`, ausentes no destino;
- `social_posts_queue`: além de a tabela inteira não ser importada,
  `approval_token`, `approved_at`, `approved_by`, `approved_media_type`,
  `approved_media_url`, `asset_id`, `asset_tipo` e `origem_fluxo` não existem
  no schema atual do destino.

Valores de `cliente_id` sem a tabela `clientes` e de `campanha_id` sem
`campanhas_recorrentes` são planejados como `NULL`. URLs externas, como
Shopee, não são alteradas.

## Execução na VPS

Use uma credencial PostgreSQL que possa ler as tabelas de destino. Mesmo que
a credencial possua mais permissões, cada consulta é envolvida por
`BEGIN TRANSACTION READ ONLY` e finalizada com `ROLLBACK`.

```bash
cd /opt/hello-buddy-launchpad
export AMZ_DATABASE_URL='postgresql://...'

python3 scripts/importador_amz/dry_run.py \
  --export-dir /opt/importacoes/export_amz \
  --target-media-dir /opt/amz-media \
  --require-db \
  --report-json /opt/importacoes/dry-run-a-report.json \
  --manifest-json /opt/importacoes/dry-run-a-sha256.json
```

O endereço de conexão não aparece no relatório nem na saída. Os dois arquivos
indicados acima são as únicas escritas do comando; omita as opções
`--report-json` e `--manifest-json` para não escrever nem mesmo relatórios.
Por segurança, o programa recusa gravar esses relatórios dentro de
`export_amz`, do destino configurado ou de `/opt/amz-media`, mesmo que outro
destino tenha sido informado na linha de comando.

## Códigos de saída

- `0`: nenhuma condição bloqueante;
- `1`: erro operacional (JSON inválido, falha do `psql`, entre outros);
- `2`: o dry-run terminou e encontrou bloqueadores.

Arquivo referenciado ausente gera aviso e recebe no relatório a ação planejada
`remove_reference`; a decisão conhecida é importar o registro sem essa
referência. Referência entre tenants em tabela descartada, como
`social_posts_queue`, é apenas informativa. Campo vazio de `profiles` só
bloqueia quando a consulta ao schema confirmar que a coluna de destino é
`NOT NULL`; o relatório identifica campo, cliente e registro exatos.
Quantidades divergentes, IDs inválidos, colisões não comparadas e falta de
espaço continuam bloqueando.

## Limites deliberados desta fase

Os UUIDs futuros de Atom, Duda e Renata aparecem como marcadores
`$AMZ_NEW_USER_ID`, `$DUDA_NEW_USER_ID` e `$RENATA_NEW_USER_ID`. O Dry-run B
será executado depois da criação dessas contas, com os UUIDs reais. Até lá,
os arquivos desses três clientes recebem o estado
`pending_target_user_id`: seus checksums de origem são calculados, mas o
programa não afirma ter comparado um caminho de destino fictício.

Nenhum código para copiar mídia, criar usuário, atualizar e-mail, inserir
linha ou recarregar o PostgREST faz parte deste programa.
