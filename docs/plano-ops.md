# PLANO-OPS — Ordem de Serviço, Despachante e operações via Jarvis

## 0. Objetivo, base e decisões já tomadas

Este documento é somente um plano técnico. Não implementa banco, telas, automações nem
alterações no WhatsApp.

Base inspecionada: `cursor/troca-venda-1` no commit `8ee1c649`. Em 25/10/2026, a
branch remota ainda não contém o TROCA-VENDA-1.1 nem o status
`veiculos_estoque.status = 'em_preparacao'`. O plano considera esse status como
pré-requisito e exige uma conferência de compatibilidade ao rebasear sobre a futura
base.

Decisões de produto já fechadas:

- o despachante atualiza o processo por link seguro sem login;
- a loja também pode atualizar o processo manualmente;
- a cobrança da taxa de transferência do cliente é configurável por loja;
- documentos pessoais ficam em storage privado e nunca são enviados à IA;
- vendedor não vê custos;
- o processor do WhatsApp só será alterado em JARVIS-OPS e GARANTIA-CLIENTE.

### Contrato esperado do TROCA-VENDA-1.1

Antes de iniciar OS-1, validar que a base:

1. aceita `em_preparacao` no CHECK de `veiculos_estoque.status`;
2. faz o carro recebido em compra/troca nascer em preparação quando aplicável;
3. mantém `em_preparacao` como capital próprio no lucro/Giro, mas fora da vitrine e
   dos portais;
4. atualiza os tipos e rótulos de status no frontend;
5. não confunde `gestao_troca.preparacao_estimada` com o status operacional;
6. define a transição segura `em_preparacao → disponivel`.

Hoje os filtros divergem: Giro e resumo aceitam apenas `disponivel`/`reservado`,
posição da loja aceita tudo que não seja `vendido`, e vitrine/WhatsApp frequentemente
consultam apenas `disponivel`. Essa matriz deve ser validada no rebase.

---

## 1. Resumo executivo da arquitetura

A implementação deve acrescentar uma camada operacional sobre o estoque existente,
sem criar um segundo cadastro de veículo, uma segunda despesa ou um segundo
financeiro.

Os cinco blocos propostos são:

1. **Parceiros e serviços**: um cadastro único de oficinas, fornecedores e
   despachantes, com contatos, especialidades, preço de referência e prazo.
2. **Ordem de Serviço**: orçamento, aprovação, check-in, execução, check-out e
   entrega assinada; custos sincronizados com `veiculo_despesas` e
   `gestao_conta_lancamento`.
3. **Garantia**: vigência iniciada pela venda e OS do tipo garantia vinculada à
   ocorrência, sem duplicar a venda ou o contrato.
4. **Processo documental**: processo por veículo, checklist, documentos privados,
   prazos, custos e portal temporário do despachante.
5. **Automação e consulta**: eventos de venda/compra/troca abrem tarefas idempotentes;
   o resumo diário e, em fase posterior, o Jarvis expõem pendências sem enviar
   documentos à IA.

A fonte de verdade continuará sendo:

- `veiculos_estoque` para o carro e seu status;
- `veiculo_compra`, `veiculo_venda` e `veiculo_consignacao` para a operação;
- `veiculo_despesas` para custo real por carro;
- `gestao_conta_lancamento` para contas a pagar/receber;
- `gestao_troca` e seu laudo para a avaliação de entrada;
- `gestao_contrato` + ZapSign para documentos assináveis;
- `gestao_giro_config` e o pipeline Giro para o resumo diário.

---

## 2. Inventário do que já existe e será reaproveitado

### 2.1 Estoque, compra, venda e consignação

| Recurso atual | Onde | Reuso |
|---|---|---|
| Estoque canônico | `veiculos_estoque`, migration `20261014135000_vehicle_inventory_vertical.sql` | Toda OS/processo aponta para `veiculo_id`; não haverá veículo paralelo. |
| Compra e origem | `veiculo_compra` em `20261021100000_gestao_g1_lucro.sql` | Data de entrada, custo e origem compra/troca/consignação. |
| Venda | `veiculo_venda`; composição em `20261032240000_gestao_venda_troca.sql` | Início de garantia e transferência de venda. |
| Consignação | `veiculo_consignacao` e `descontar_do_consignante` em `20261032230000_gestao_consignacao_hibrida.sql` | Decisão explícita sobre quem absorve cada item de OS. |
| Entrada de veículo | `GestaoEntradaVeiculoDialog.tsx` e `GestaoVeiculoDrawer.tsx` | Pontos do painel onde compra/troca podem abrir preparação. |

Não alterar os cálculos puros de lucro, consignação e Giro para representar custos.
O custo entra pelos registros existentes de `veiculo_despesas`, e os cálculos passam
a enxergá-lo naturalmente.

### 2.2 Despesas e financeiro

| Recurso atual | Onde | Reuso |
|---|---|---|
| Despesa do carro | `veiculo_despesas` | Custo real de OS, garantia e documentação. |
| Categorias | `gestao-lucro-categories.ts`, `gestao-categoria-pt.ts` | Mecânica, funilaria, pneus, estética, documentação e outros. |
| Conta a pagar/receber | `gestao_conta_lancamento`, migration `20261023100000_gestao_g3_financeiro.sql` | Pagamento do parceiro e receita de taxa cobrada do cliente. |
| Soft delete e baixa | `deleted_at`, `pago_em`, `recebido_em` | Preservação de intervenção humana. |
| Proteções financeiras | `sync_consignacao_venda()` e `registrar_venda_com_troca()` | Padrão obrigatório: não ressuscitar, não mudar baixado, não sobrescrever editado. |
| Comprovantes | bucket `gestao-comprovantes`, `gestao-comprovante-url` | Referência de upload privado e URL assinada curta. |

As novas entidades guardarão FKs explícitas para a despesa e o lançamento gerados.
Não dependerão apenas de texto em `observacao`.

### 2.3 Troca, laudo e preparação estimada

| Recurso atual | Onde | Reuso |
|---|---|---|
| Avaliação | `gestao_troca` | `preparacao_estimada`, destino, teto, veículo recebido. |
| Checklist e fotos | `checklist_json`, `fotos_json`, `GestaoTrocaChecklistPanel.tsx`, `GestaoTrocaFotoGaleria.tsx` | Fonte da sugestão de OS e padrão visual; o histórico do laudo não será movido. |
| Itens/avarias da IA | `gestao_troca_ia_item`, `gestao_troca_custo_reparo` | Sugestão revisável de itens de preparação. |
| Timeline | `gestao_troca_evento` | Modelo para eventos imutáveis da OS e do despachante. |
| Trava de laudo | migrations `20261032100000` a `20261032140001` | O laudo finalizado continua imutável; a OS referencia sua versão. |
| Entrada por troca | `_shared/gestao-troca-ops.ts` e RPC `registrar_venda_com_troca` | Pontos de abertura idempotente da OS. |

A IA pode sugerir serviços a partir do laudo já processado, mas a OS não enviará
CRLV, documentos pessoais nem novos anexos à IA.

### 2.4 Contratos e ZapSign

| Recurso atual | Onde | Reuso |
|---|---|---|
| Modelos/contratos | `gestao_contrato_modelo`, `gestao_contrato` | Termo de entrega/check-out e garantia. |
| Assinatura | `gestao-zapsign-sign`, `gestao-zapsign-webhook`, `gestao-zapsign-api.ts` | Assinatura da entrega sem nova integração. |
| Segredo por loja | `gestao_zapsign_conta` | Continua acessível somente via service role. |
| UI | `GestaoContratosTab.tsx`, `gestao-contrato-pdf.ts` | Geração, acompanhamento e link de assinatura. |

OS-1 deve apenas ampliar o conjunto permitido de tipos de contrato para um tipo de
entrega de OS, ou adicionar um propósito equivalente, mantendo o mesmo pipeline.

### 2.5 Link seguro e storage privado

O melhor padrão existente para acesso sem login é o pacote do contador:

- `gestao_contador_token`: hash do token, expiração, revogação e último acesso;
- `_shared/gestao-contador-token.ts` e `gestao-contador-pacote`;
- rota pública `/contador/:token`.

O portal do despachante seguirá o mesmo princípio, com melhorias:

- token aleatório armazenado apenas como hash;
- escopo para um único processo;
- expiração e revogação;
- log de cada acesso e alteração, não apenas `last_access_at`;
- dados e documentos liberados por allowlist;
- arquivos entregues por URL assinada curta, nunca bucket público.

O bucket `trocas` oferece o padrão de path `{user_id}/{entidade_id}/...`. CRLV já é
marcado e excluído de IA/PDF por `gestao-troca-fotos.ts`; essa exclusão deve ser
obrigatória em OPS.

### 2.6 Vistoria e WhatsApp

- Checklist/fotos: `gestao-troca-checklist.ts`, componentes em
  `src/components/gestao/trocas/`.
- Vistoria pelo WhatsApp: `_shared/gestao-troca-whatsapp.ts`.
- Coleta documental: `silvester_documentos` e `silvester-extract-document`, apenas
  como referência de upload; documentos OPS não devem usar extração por IA.
- Autorização: `_shared/gestao-auth-phone.ts`, dono e
  `empresa_config.gestao_gestores_json`.
- Auditoria: `gestao_lancamentos_whatsapp`.

OS-1 e DESP-1 serão painel-first e não tocarão nesses fluxos de entrada.

### 2.7 Resumo diário e Giro

- carga: `_shared/giro-resumo-load.ts`;
- agregação/texto: `_shared/giro-resumo-mensagem.ts`;
- política anti-spam: `_shared/giro-resumo-diario-policy.ts`;
- execução/envio: `_shared/giro-resumo-diario-run.ts` e
  `_shared/giro-resumo-whatsapp.ts`;
- configuração: `GestaoGiroTab.tsx` e `gestao_giro_config`.

As novas linhas do resumo usarão agregados já calculados no backend e manterão a
regra atual de uma tentativa diária com retentativa técnica limitada.

### 2.8 Permissões atuais

- Banco/painel: a Gestão é majoritariamente isolada por `user_id = auth.uid()`.
- WhatsApp: dono e gestores são autorizados por telefone.
- Vendedores são cadastro comercial, não identidades autenticadas de painel.
- Vendedor participa do WhatsApp de Trocas em escopo restrito, mas não tem acesso à
  Gestão financeira.

Consequência: “vendedor não vê custos” deve ser garantido no serviço/API e nos
payloads, não apenas escondendo componentes.

---

## 3. Modelo de dados proposto

Os nomes abaixo são desenho; a implementação final deve usar migrations novas.

### 3.0 Identidade operacional e convenções

Hoje `user_id` é simultaneamente dono da loja e tenant, e os gestores existem apenas
como telefones em `empresa_config.gestao_gestores_json`. Para o alvo “dono/gerente
aprova no painel” sem compartilhar login, OS-1 precisa introduzir
`gestao_membro`:

- `tenant_user_id` (dono/tenant) e `auth_user_id`, ambos UUID e chave composta;
- `papel`: dono, gestor, vendedor;
- permissões explícitas `aprovar_os`, `operar_os`, `operar_despachante`,
  `ver_custos`;
- `ativo`, timestamps e quem convidou.

Uma função estável de autorização deve verificar membro + permissão. As tabelas OPS
continuam guardando `user_id = tenant_user_id`; toda FK de entidade operacional deve
ser composta por `(user_id, id)` ou validada por constraint equivalente, impedindo
referência cross-tenant. O owner atual é tratado como membro dono implicitamente
durante a transição.

Convenções para todas as tabelas propostas:

- UUID `id` com geração automática; `user_id` e FKs obrigatórias salvo quando
  marcadas opcionais;
- valores monetários `numeric(14,2)`, não negativos;
- datas operacionais `date`, eventos `timestamptz`;
- `created_at`/`updated_at` obrigatórios;
- CHECKs para estados/tipos e índices por `user_id`;
- FKs compostas ou validação equivalente de tenant;
- eventos são append-only: authenticated pode SELECT/INSERT autorizado, nunca
  UPDATE/DELETE;
- outbox e logs de acesso são escritos apenas por funções controladas/service role.

### 3.1 Parceiros e tabela de serviços

#### `gestao_parceiro`

Cadastro único para não duplicar oficina, fornecedor e despachante.

- `id`, `user_id`;
- `nome`, `nome_fantasia`, `documento` (CPF/CNPJ cifrado ou acesso restrito);
- `whatsapp_e164`, `email`, `endereco_json`;
- `tipos text[]`: mecânica, funilaria, estética, pneus, vidros, despachante, outros;
- `prazo_medio_dias`, `ativo`, `observacao`;
- timestamps.

#### `gestao_parceiro_servico`

- `id`, `user_id`, `parceiro_id`;
- `codigo`, `nome`, `categoria_despesa`;
- `preco_referencia`, `prazo_medio_dias`;
- `tipo_veiculo`/segmento opcional;
- `ativo`, timestamps.

Índices:

- parceiro por `(user_id, ativo, nome)`;
- GIN em `tipos`, se a consulta justificar;
- serviço único por `(parceiro_id, codigo)` quando `codigo` existir.

### 3.2 Ordem de Serviço

#### `gestao_os`

- `id`, `user_id`, `numero`;
- `veiculo_id`, `parceiro_id`;
- `tipo`: `preparacao`, `garantia`, `revisao`, `avulsa`;
- `status`: `rascunho`, `orcamento`, `aguardando_aprovacao`, `aprovada`,
  `checkin`, `em_execucao`, `aguardando_retirada`, `checkout`,
  `aguardando_assinatura`, `concluida`, `cancelada`;
- `origem`: manual, compra, troca, venda/garantia;
- `troca_id`, `troca_laudo_versao_id`, `garantia_id` opcionais;
- `km_checkin`, `km_checkout`, datas previstas e reais;
- `valor_estimado`, `valor_aprovado`, `valor_real`;
- `descontar_do_consignante` quando aplicável;
- `aprovado_por`, `aprovado_em`;
- `contrato_entrega_id` para ZapSign;
- `despesa_id`, `conta_lancamento_id`, `valor_sincronizado`;
- `sync_aviso`, `observacao`, timestamps.

Restrições:

- número único por loja;
- OS concluída exige check-out e valor real;
- `descontar_do_consignante` só é aceito para consignação ativa;
- uma automação não pode criar duas OS de preparação para a mesma origem.

#### `gestao_os_item`

- `id`, `user_id`, `os_id`, `parceiro_servico_id`;
- descrição, categoria de despesa;
- quantidade;
- valores estimado, aprovado e real;
- status: sugerido, aprovado, recusado, executado, cancelado;
- origem do item: manual ou laudo;
- referência opcional ao item/avaria do laudo;
- observação e timestamps.

#### `gestao_os_vistoria`

Uma linha por check-in/check-out:

- `id`, `user_id`, `os_id`, `tipo`;
- `km`, `checklist_json`, `registrado_por`, `registrado_em`.

#### `gestao_os_documento`

- `id`, `user_id`, `os_id`, `vistoria_id` opcional;
- `tipo`: foto_checkin, foto_checkout, orçamento, nota, comprovante, outro;
- `storage_path`, MIME, tamanho, hash;
- classificação de sensibilidade;
- timestamps e soft delete.

#### `gestao_os_evento`

Timeline append-only: estado anterior/novo, autor, origem painel/automação/Jarvis/
ZapSign, mensagem e metadados sem PII.

### 3.3 Garantia

#### `gestao_garantia`

- `id`, `user_id`, `veiculo_id`;
- referência à venda pelo par `(user_id, veiculo_id)`;
- início na `data_venda`;
- `prazo_legal_dias`, `prazo_contratual_dias`, datas finais calculadas;
- `status`: ativa, expirada, suspensa, encerrada;
- `contrato_id`, observação e timestamps.

#### `gestao_garantia_ocorrencia`

- `id`, `user_id`, `garantia_id`, `os_id`;
- abertura, origem painel/cliente futuro, relato e status;
- cobertura: pendente, coberta, não_coberta, cortesia;
- decisão por dono/gerente e timestamps.

Uma OS de garantia concluída gera despesa com origem “custo pós-venda”. Isso reduz o
lucro real do veículo pelos cálculos existentes, sem reescrever o lucro da venda.

Para não sobrecarregar `veiculo_despesas.origem_lancamento` (que hoje representa o
canal), OS-1 adiciona `origem_operacional` opcional (`os_preparacao`,
`os_garantia`, `despachante`) e `origem_operacional_id`. O CHECK atual de
`origem_lancamento` permanece com painel/WhatsApp/automática.

### 3.4 Despachante e processos

#### `gestao_despachante_config`

- `user_id` PK;
- `cobrar_taxa_transferencia_cliente boolean`;
- `prazo_padrao_dias` (30 inicialmente);
- `prazos_uf_json`;
- `renave_ufs text[]`;
- `dias_alerta_antes`;
- timestamps.

Default proposto para cobrança: `false`, por ser financeiramente conservador. É uma
pergunta de negócio a confirmar antes de DESP-1.

#### `gestao_despachante_processo`

- `id`, `user_id`, `numero`, `veiculo_id`, `parceiro_id`;
- `tipo`: transferencia_venda, comunicacao_venda, transferencia_loja, renave,
  baixa_gravame, licenciamento, segunda_via, vistoria, troca_placa,
  consulta_debitos;
- `status`: rascunho, enviado, em_andamento, pendencia, concluido, entregue,
  cancelado;
- `origem`: manual, venda, compra, troca;
- `venda_veiculo_id`/`troca_id` opcionais;
- UF, data de abertura, prazo legal, vencimento e conclusão;
- taxas, honorário, custo total e valor cobrado do cliente;
- `despesa_id`, `conta_pagar_id`, `conta_receber_id`;
- últimos valores sincronizados e `sync_aviso`;
- pendência atual sem documento pessoal;
- timestamps.

Índices:

- `(user_id, status, prazo_limite)`;
- `(user_id, veiculo_id, created_at desc)`;
- unicidade parcial por origem/tipo para impedir abertura automática duplicada.

#### `gestao_despachante_checklist_item`

- processo, código/título, obrigatório, status pendente/recebido/dispensado;
- quem atualizou e quando;
- sem conteúdo de documento no campo textual.

#### `gestao_despachante_documento`

- processo, checklist item opcional;
- tipo, `storage_path`, MIME, tamanho e hash;
- origem loja/despachante;
- sensibilidade e timestamps;
- nunca contém URL permanente.

#### `gestao_despachante_evento`

Timeline append-only de estado, prazo, pendência e alterações manuais.

#### `gestao_despachante_token`

- processo, hash do token, expiração, revogação e último acesso;
- permissões fechadas: ver checklist/documentos autorizados, atualizar status,
  registrar pendência, anexar resultado;
- token em texto existe apenas no momento da emissão.

#### `gestao_despachante_acesso`

Log append-only:

- token/processo;
- ação, data/hora;
- IP truncado/hasheado, user-agent reduzido;
- sucesso/falha e metadados sem PII.

### 3.5 Auditoria de automações

#### `gestao_operacao_automacao`

Outbox/idempotência para desacoplar a venda das operações secundárias:

- `id`, `user_id`, `evento`, entidade/tipo/id;
- chave idempotente única;
- payload mínimo, sem documentos/PII;
- status pendente/processando/concluído/falha;
- tentativas, último erro sanitizado e timestamps.

Uma venda não deve falhar porque ZapSign, WhatsApp ou o despachante está indisponível.
A transação grava a venda e o evento; um runner executa efeitos idempotentes.
Operações obrigatórias internas que precisam nascer junto da venda podem ser
materializadas na mesma transação, deixando apenas notificações na outbox.

`gestao_conta_lancamento.origem` deve ganhar valores explícitos `os_auto` e
`despachante_auto` (ou colunas de origem operacional equivalentes); novas contas não
devem ser disfarçadas como `manual`.

### 3.6 RLS, grants e storage

- Tabelas internas mutáveis: RLS pela função de membro/tenant e permissão da ação;
  owner atual continua autorizado. Grants mínimos para `authenticated`, ALL para
  `service_role`, nada para `anon`.
- Eventos append-only: SELECT/INSERT autorizado, sem UPDATE/DELETE.
- Outbox, tokens e logs: leitura administrativa quando necessária; escrita somente
  por RPC/edge/service role.
- Tokens e logs de acesso: sem CRUD direto por `authenticated`; emissão via edge
  autenticada e acesso público via edge com service role.
- Portal do despachante: nenhuma policy anon nas tabelas internas.
- Bucket novo `gestao-ops-documentos`, privado, path
  `{user_id}/{entidade}/{entidade_id}/...`.
- URL assinada curta gerada por edge após validar JWT da loja ou token do processo.
- Documentos com tipo pessoal são bloqueados em qualquer adapter de IA.
- Payload de vendedor omite custos no servidor; a UI não é a barreira de segurança.

---

## 4. Fluxos, estados e autorização

### 4.1 Ordem de Serviço

Fluxo normal:

`rascunho → orcamento → aguardando_aprovacao → aprovada → checkin → em_execucao
→ aguardando_retirada → checkout → aguardando_assinatura → concluida`

Saídas laterais:

- rascunho/orçamento/aguardando aprovação → cancelada;
- aprovada pode voltar a orçamento apenas por dono/gerente, com evento;
- execução pode registrar orçamento complementar, que volta a
  `aguardando_aprovacao` sem apagar o histórico;
- conclusão assinada é imutável; correção vira evento/aditivo.

| Ação | Loja/dono | Gestor | Vendedor | Parceiro externo |
|---|---:|---:|---:|---:|
| Criar/editar orçamento | sim | sim | não | não em OS-1 |
| Aprovar custo | sim | sim | não | não |
| Check-in/check-out | sim | sim | sem custos, fase futura | não |
| Ver valores/custos | sim | sim | não | apenas seu orçamento, se portal futuro |
| Concluir e sincronizar | sim | sim | não | não |
| Assinar entrega | cliente via ZapSign | — | — | — |

“Gestor” na tabela significa membro autenticado com a permissão correspondente; até
essa identidade existir, somente o owner autenticado executa ações de painel.
Limites de valor por gestor continuam pendentes de regra de negócio.

Regras por tipo:

- **Preparação**: conclusão muda `em_preparacao → disponivel`, se não houver outra OS
  de preparação bloqueante, e emite “complete o anúncio”.
- **Garantia**: exige garantia/ocorrência; despesa recebe origem custo pós-venda.
- **Revisão/avulsa**: não muda status do estoque automaticamente.
- **Consignado**: antes da aprovação, exige escolha “descontar do dono”; não inferir.

### 4.2 Processo do despachante

Fluxo:

`rascunho → enviado → em_andamento → pendencia → em_andamento → concluido → entregue`

Também é permitido:

- rascunho/enviado → cancelado pela loja;
- concluído → em andamento apenas pela loja, com justificativa;
- entregue é terminal; correção cria evento ou novo processo.

| Transição/ação | Loja/dono | Gestor | Despachante por token | Vendedor |
|---|---:|---:|---:|---:|
| Criar processo e definir custos | sim | sim | não | não |
| Enviar/renovar/revogar link | sim | sim | não | não |
| Marcar em andamento | sim | sim | sim | não |
| Registrar pendência | sim | sim | sim | não |
| Anexar protocolo/resultado | sim | sim | sim | não |
| Alterar honorário/taxa | sim | sim | não | não |
| Concluir | sim | sim | sim, sujeito a checklist | não |
| Marcar entregue | sim | sim | não | não |

O token não concede acesso a outros processos do mesmo veículo ou cliente. A loja
pode executar as mesmas transições pelo painel, conforme a decisão de produto.

### 4.3 Garantia

- venda registrada → garantia ativa com início na data da venda;
- prazo efetivo exibe separadamente legal e contratual;
- ocorrência aberta no painel → triagem → decisão de cobertura → OS de garantia;
- OS concluída → custo pós-venda no carro e conta a pagar;
- expiração é calculada, não apaga ocorrências anteriores;
- atendimento do cliente via Jarvis fica bloqueado até GARANTIA-CLIENTE.

---

## 5. Integrações automáticas e idempotência

### 5.1 Eventos de origem

| Evento | Efeitos |
|---|---|
| Venda criada | processo de transferência de venda, garantia ativa e lembretes pós-venda. |
| Venda atualizada | recalcular prazo apenas se data mudou e ainda não houve ação manual incompatível. |
| Troca fechada | OS de preparação sugerida pelo laudo; processo de gravame/transferência conforme checklist/config. |
| Compra criada | OS de preparação e processos documentais aplicáveis. |
| Consignação iniciada | checklist de entrada; sem assumir custo da loja. |
| Consignação devolvida | checklist de devolução; preserva histórico. |
| OS concluída | despesa + conta a pagar; estado do veículo; aviso de anúncio. |
| Processo concluído | despesa + conta a pagar; receita opcional da taxa; Giro atualizado pela despesa. |

### 5.2 Estratégia técnica

- Funções puras calculam valores, prazo, transições e plano de sincronização.
- RPCs transacionais materializam OS/processo + despesas/contas.
- Trigger fino ou chamada explícita grava a outbox com chave idempotente.
- Runner processa notificações e integrações externas.
- Cada efeito tem constraint/índice único pela origem.
- Reexecução retorna a entidade já criada, sem duplicá-la.

### 5.3 Proteções financeiras obrigatórias

Para despesa e lançamento automático, guardar:

- FK do registro gerado;
- último valor calculado/sincronizado;
- aviso de divergência;
- versão/data da sincronização.

Ao recalcular:

1. registro apagado: não recriar; apenas aviso;
2. conta paga/recebida: não alterar;
3. valor atual diferente do último calculado: considerar edição manual e preservar;
4. tipo/categoria/vencimento manual incompatível: preservar e avisar;
5. registro intacto: atualizar;
6. nova origem sem registro anterior: criar uma vez;
7. cancelamento: soft delete apenas se aberto e intacto.

Isso incorpora as proteções de CONSIG-1.1 e acrescenta proteção de
tipo/categoria/vencimento, além de usar FKs explícitas em vez de localizar apenas por
prefixo de observação.

### 5.4 Taxa de transferência cobrada do cliente

- Configuração por loja decide se o processo sugere conta a receber.
- O custo do despachante sempre permanece separado da receita cobrada do cliente.
- Alterar a configuração não modifica processos antigos.
- Valor cobrado pode vir da tabela de serviço e ser editado antes da confirmação.
- Conta recebida, apagada ou editada segue as mesmas proteções.

---

## 6. Telas planejadas

### OS-1

- Nova aba **Operações/OS** na Gestão, com kanban/lista por status e prazo.
- Drawer/ficha da OS: orçamento, itens, aprovação, check-in, fotos, execução,
  check-out, assinatura e timeline.
- Cadastro compartilhado **Parceiros** e tabela de serviços.
- Na ficha do veículo: seção de OS e ação “Abrir OS”.
- Na troca/laudo: ação “Criar OS de preparação” pré-preenchida e comparação
  estimado × real.
- Em estoque: selo “Em preparação”; ao concluir, CTA “Completar anúncio”.

### DESP-1

- Aba **Despachante**: processos por prazo/status e filtros.
- Cadastro de despachantes usa o mesmo parceiro.
- Configuração: cobrança do cliente, prazo padrão, prazos/RENAVE por UF.
- Ficha: checklist, documentos, timeline, custos, link temporário e ações manuais.
- Portal público mínimo: veículo identificado sem dados excessivos, checklist,
  documentos permitidos, status, pendência e upload de resultado.

### JARVIS-OPS e GARANTIA-CLIENTE

As telas do painel permanecem fonte de verdade. O WhatsApp chama os mesmos serviços
de domínio; não duplica regras ou SQL.

---

## 7. Fases pequenas e deployáveis

## Fase 0 — conferência da base TROCA-VENDA-1.1

**Objetivo:** rebasear o plano/implementação e validar `em_preparacao`.

**Arquivos a conferir:** migration do status, `vehicle-inventory.tsx`,
`gestao-lucro-data.ts`, `gestao-estoque-snapshot.ts`, `estoque-giro-data.ts`,
`giro-resumo-load.ts`, `gestao-troca-ops.ts`,
`20261032240000_gestao_venda_troca.sql` e adapters de portais.

**Risco:** status entrar no painel/Giro com semânticas diferentes ou ser publicado
antes da preparação.

**Não muda:** processor, cálculos puros de lucro/consignação.

**Testes:** matriz de visibilidade por status; entrada compra/troca; Giro considera
capital e vitrine/portais não anunciam.

## OS-1 — fornecedores + OS no painel + custo + laudo + preparação

**Entregas:**

- identidade de membro/gestor para o painel, sem compartilhar login;
- parceiro/serviços;
- OS, itens, vistorias, documentos e eventos;
- estados/aprovação;
- sugestão a partir do laudo;
- estimado × aprovado × real;
- custo em despesa e conta a pagar;
- consignação pergunta “descontar do dono”;
- garantia como tipo interno, ainda sem entrada do cliente;
- ZapSign na entrega;
- conclusão libera preparação e avisa para completar anúncio.

**Arquivos novos prováveis:**

- migrations novas de parceiro/OS/storage/contrato;
- `_shared/gestao-os-{calc,status,sync,load}.ts`;
- edge `gestao-os`;
- `src/components/gestao/os/*`;
- `src/lib/gestao-os-*.ts`;
- testes Deno das funções puras.

**Arquivos existentes afetados:**

- `GestaoLucroPage.tsx`, `gestao-nav.ts`, `GestaoSidebarNav.tsx`;
- `GestaoVeiculoDrawer.tsx`;
- `GestaoTrocaFichaPage.tsx` e builders do laudo;
- `GestaoContratosTab.tsx`/helpers ZapSign apenas para novo propósito;
- loaders de lucro somente para expor origem “custo pós-venda”, sem novo cálculo.

**Migrations:** somente novas; membro/permissões, extensão segura de CHECKs e
origens operacionais, tabelas, RLS, índices, bucket e constraints de idempotência.

**Riscos:** autorização cross-tenant, dupla despesa, liberar carro com OS pendente,
alterar laudo finalizado, vazar custo/foto, divergência entre estimado e real.

**Não muda:** processor WhatsApp, atendimento do cliente, regras de lucro,
consignação e comissão.

**Testes:**

- máquina de estados e autorização;
- laudo gera itens uma vez;
- conclusão gera uma despesa/conta;
- conta paga/apagada/editada é preservada;
- consignado exige decisão explícita;
- garantia reduz lucro real via despesa;
- `em_preparacao` só vira disponível após conclusão;
- RLS cross-tenant e documentos privados;
- gestor com permissão aprova; vendedor não recebe custo;
- ZapSign/webhook idempotente.

## DESP-1 — despachantes + processos + link seguro + abertura automática

**Entregas:**

- despachante no cadastro compartilhado;
- processos/checklists/documentos/eventos/configuração;
- prazo por UF, RENAVE configurável e alerta;
- portal por token e atualização manual da loja;
- venda/compra/troca abrem processos idempotentes;
- custo → despesa + conta a pagar;
- taxa opcional → conta a receber.

**Arquivos novos prováveis:**

- migrations de config/processo/checklist/documento/token/acesso;
- `_shared/gestao-despachante-{status,prazo,sync,token}.ts`;
- edges `gestao-despachante` e `gestao-despachante-public`;
- página pública `GestaoDespachantePublicPage.tsx`;
- componentes e loaders do painel.

**Arquivos existentes afetados:**

- `App.tsx` para rota pública;
- navegação da Gestão;
- pontos transacionais de venda/compra/troca, preferencialmente via outbox;
- `giro-resumo-load.ts` e `giro-resumo-mensagem.ts`;
- financeiro para exibir origem do lançamento.

**Migrations:** somente novas, incluindo config por loja e storage privado.

**Riscos:** token encaminhado, exposição de PII, prazo legal incorreto, duplicidade
de processo/conta, falha externa bloquear venda.

**Não muda:** processor, classificação IA de documentos, lucro contábil, fluxo de
venda pelo WhatsApp.

**Testes:**

- expiração/revogação/escopo do token;
- log de acesso;
- transições loja e despachante;
- allowlist de documentos;
- venda/compra/troca abrem uma vez;
- prazo por UF e fallback 30 dias;
- cobrança on/off;
- proteções financeiras;
- resumo diário sem spam;
- RLS e acesso anon negado às tabelas/bucket.

## JARVIS-OPS — comandos do dono/gestor

**Pré-condição:** área destravada por autorização explícita após OS-1 e DESP-1
estáveis.

**Entregas:** abrir OS, mandar ao despachante, consultar status, consultar gasto por
carro e “traz o carro X”.

**Arquivos afetados:**

- `_shared/gestao-intent-pt.ts`;
- novo `_shared/gestao-ops-inbound.ts` e policy de permissões;
- `_shared/gestao-inbound.ts`;
- `_shared/gestao-auth-phone.ts`;
- snapshots/tools de consulta sem PII;
- pontos mínimos no `whatsapp-cloud-inbound-processor/index.ts`.

**Migration:** apenas se audit/RBAC adicional for necessário; não duplicar estados
de conversa em tabela de domínio.

**Riscos:** colisão com vitrine/LLM, vendedor ganhar acesso a custo, mutação sem
confirmação, duplicidade por repetição da mensagem.

**Não muda:** atendimento de cliente, fluxo de garantia do cliente, documentos,
ordem de roteamento da vitrine.

**Testes:**

- intent positivo e negativo;
- dono/gestor autorizados;
- vendedor sem custo e sem mutação;
- confirmação e idempotência;
- documento/PII ausente do snapshot;
- ordem estrutural do processor;
- falha OPS não derruba atendimento normal.

## GARANTIA-CLIENTE — abertura pelo atendimento

**Pré-condição:** área destravada separadamente, com texto jurídico/LGPD aprovado.

**Entregas:** cliente identifica venda, aceita tratamento de dados, abre ocorrência,
envia somente os anexos permitidos e acompanha status; a loja decide cobertura.

**Arquivos afetados:**

- módulo novo `_shared/gestao-garantia-cliente.ts`;
- estado do formulário de atendimento;
- processor nos ramos de cliente/mídia;
- contrato/template de garantia e ZapSign;
- opt-in/LGPD e notificações.

**Migration:** nova migration obrigatória para acrescentar à ocorrência
`canal_abertura`, `cliente_telefone_hash`, `lgpd_aceite_em`,
`lgpd_texto_versao` e `aberto_por_cliente`; tabela separada de token de
acompanhamento com hash, escopo, expiração e revogação; log append-only de acesso.
Telefone em texto claro não entra em snapshot/IA.

**Riscos:** pessoa errada acessar venda, promessa automática de cobertura, PII para
IA, colisão com lead/vitrine e prazo legal mal comunicado.

**Não muda:** aprovação financeira, regra de cobertura e custos; continuam
exclusivos da loja.

**Testes:**

- prova mínima de vínculo do cliente;
- consentimento;
- “recebido” não significa “coberto”;
- mídia pessoal não chega ao LLM;
- tenant isolation;
- rate limit/dedup;
- regressão completa da vitrine.

## INDICADORES

**Entregas:**

- tempo e custo médio de preparação por marca/modelo;
- estimado × aprovado × real;
- tempo de transferência por despachante/tipo/UF;
- custo de garantia por modelo e vendedor da venda;
- ranking de fornecedores por prazo, custo e retrabalho.

**Arquivos novos prováveis:** `_shared/gestao-ops-indicadores.ts` e testes,
`src/lib/gestao-ops-indicadores-load.ts` e
`src/components/gestao/ops/GestaoOpsIndicadoresTab.tsx`.

**Arquivos existentes afetados:** `GestaoLucroPage.tsx`, `gestao-nav.ts`,
`GestaoSidebarNav.tsx` e, se os alertas entrarem na posição executiva,
`_shared/gestao-posicao-loja.ts`.

**Migrations:** começar com views/RPCs; snapshot materializado somente se medição
mostrar necessidade.

**Riscos:** amostra pequena, comparação injusta, custos manuais incompletos e
exposição a vendedor.

**Não muda:** dados operacionais e cálculos; indicadores são derivados.

**Testes:** fixtures com cancelados, valores nulos, reabertura, mediana/média,
período e isolamento por loja.

---

## 8. Pontos exatos de alteração do processor

Nenhuma alteração em OS-1, DESP-1 ou INDICADORES.

### JARVIS-OPS

1. `whatsapp-cloud-inbound-processor/index.ts`
   - adicionar um único shortcut OPS nos blocos já existentes de gestor, dono e
     áudio;
   - manter Gestão antes da vitrine e antes do LLM;
   - envolver em `try/catch` fail-open;
   - não inserir SQL ou regra de domínio no processor.
2. `_shared/gestao-intent-pt.ts`
   - novos intents com bloqueios contra lembrete, anúncio e conversa de cliente.
3. `_shared/gestao-inbound.ts`
   - delegar a um módulo OPS; confirmação antes de qualquer mutação.
4. `_shared/gestao-auth-phone.ts`
   - resolver papel dono/gestor/vendedor, mantendo compatibilidade da função atual.
5. `_shared/gestao-consulta-snapshot.ts`
   - apenas status e totais autorizados; sem documentos, PII ou custos para
     vendedor.

Isolamento:

- lógica pura e testes fora do processor;
- mapa `(papel, intent) → permissão`;
- chave idempotente por comando;
- teste `owner-text-turn-order.test.ts`;
- testes negativos de colisão;
- feature flag por loja antes de liberar.

### GARANTIA-CLIENTE

1. processor no ramo de cliente, depois da identificação segura da intenção e antes
   do LLM;
2. ramo de mídia apenas para anexar ao protocolo já aberto;
3. estado dedicado, com TTL, sem reutilizar confirmação financeira;
4. nenhum documento/anexo no prompt ou tool payload da IA;
5. feature flag diferente de JARVIS-OPS.

Isolamento:

- módulo de estado próprio;
- resposta determinística;
- rate limit;
- vínculo venda/telefone validado;
- regressão dos fluxos de vitrine, financiamento e troca.

---

## 9. Resumo diário operacional

Acrescentar ao resumo existente, sem criar outro cron:

- transferências vencidas ou próximas do prazo;
- OS sem movimento além do limite configurado;
- garantias com ocorrência aberta;
- documentos obrigatórios pendentes;
- carros em `em_preparacao` além do prazo.

Regras:

- apenas contagens e descrições curtas; nenhum nome/CPF/documento;
- links levam ao painel autenticado;
- respeitar a política anti-spam existente;
- calcular uma vez por loja/rodada;
- não alterar o template Meta até haver necessidade de novas variáveis aprovadas.

---

## 10. Observabilidade e operação

- eventos append-only em OS e despachante;
- `created_by`, origem e correlation/idempotency key;
- falhas de automação sanitizadas na outbox;
- métricas: automações pendentes/falhas, tokens ativos, processos vencidos, sync
  financeiro com aviso;
- alertas não devem registrar conteúdo de documentos;
- telas mostram claramente quando conta/despesa foi preservada por edição humana.

Rollback por fase:

- desligar abertura automática por feature flag;
- manter leitura dos dados já criados;
- não apagar despesas/contas já sincronizadas;
- revogar tokens públicos;
- não tentar reverter uma conta já paga.

---

## 11. Perguntas em aberto

### Regras estaduais/documentais

1. Quais prazos legais por UF e tipo de processo substituem o fallback de 30 dias?
2. Em quais UFs/condições RENAVE é obrigatório, opcional ou indisponível?
3. Quais documentos são obrigatórios por tipo de processo e UF?
4. O prazo conta da venda, assinatura, pagamento ou entrega?
5. Comunicação de venda e transferência devem ser processos separados ou etapas?

### Financeiro

6. O default de “cobrar taxa do cliente” será `não`?
7. A taxa cobrada é valor fixo da loja, custo repassado ou custo + margem?
8. A conta a receber vence na venda, entrega ou conclusão da transferência?
9. Em garantia coberta, há franquia/coparticipação do cliente?
10. Custo pós-venda entra no mês da despesa ou deve haver visão por coorte da venda?

### OS e preparação

11. Quem pode aprovar orçamento e orçamento complementar: só dono ou também gestor?
12. Há limite de aprovação por gestor?
13. Uma OS pode ter mais de um fornecedor?
14. A assinatura de entrega é obrigatória em todos os tipos ou só garantia/revisão?
15. Qual o limite de dias para considerar OS ou preparação parada?
16. Se houver duas OS de preparação, qual delas libera o carro?
17. A preparação de consignado é sempre negociada item a item com o dono?

### Garantia

18. Prazos legal e contratual por categoria/idade/km do veículo.
19. Eventos que suspendem/interrompem prazo.
20. Texto e cobertura do termo de garantia revisados juridicamente.
21. Como provar vínculo do cliente no futuro fluxo WhatsApp.

### Segurança/LGPD

22. Prazo de retenção por tipo documental.
23. Quais documentos o despachante pode baixar versus apenas visualizar?
24. TTL padrão do link e possibilidade de uso único.
25. Necessidade de registrar aceite LGPD específico no portal.
26. Política para mascaramento/retenção de IP no log de acesso.

### Indicadores

27. Ranking deve usar média, mediana ou ambos?
28. Como tratar serviços refeitos/cortesia e OS canceladas?
29. Qual amostra mínima permite comparar fornecedor, modelo ou vendedor?

---

## 12. Critérios de início da construção

OS-1 só deve começar depois de:

1. TROCA-VENDA-1.1 disponível e auditado;
2. semântica de `em_preparacao` confirmada;
3. responsáveis por aprovação e assinatura definidos;
4. regra financeira de garantia/consignação confirmada.

DESP-1 só deve começar depois de:

1. default da cobrança ao cliente definido;
2. primeira matriz de prazo/documentos/RENAVE por UF aprovada;
3. TTL e retenção de documentos definidos;
4. escopo do portal externo aprovado.

JARVIS-OPS e GARANTIA-CLIENTE permanecem travados até autorização explícita.
