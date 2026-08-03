# Migração definitiva: Baileys/gateway local → Meta Cloud API oficial

Decisão registrada: **todo disparo (campanha, autopilot, convite) passa a ser 100% Meta Cloud API oficial**, com token do tenant lido de `whatsapp_config`. O gateway local (.exe / WuzAPI / Baileys), a fila `fila_atendimento_pj` e o `gateway_status` saem do caminho de envio.

Diagnóstico confirmado na auditoria: o executor `executar-campanhas-agendadas` chama `send-wuzapi-message-pj` (linha 605) e `send-wuzapi-group-message-pj` (linha 441), e o modal de campanha grava na fila via RPC `inserir_campanha_fila`. Ou seja: a campanha saía pelo correio errado — "sem erro", mas sem entrega.

Nada aqui é executado ainda. Sem deploy.

---

## Fase 1 — Disparo de campanha via Meta oficial

Novo caminho único de envio:

```text
campanhas_recorrentes / campanha manual
        ↓
executar-campanhas-agendadas  (pg_cron)
        ↓
whatsapp-cloud-send-template  (NOVA, única saída de envio)
        ↓
POST graph.facebook.com/v25.0/{phone_number_id}/messages   type=template
        ↓  token/phone_number_id do tenant (whatsapp_config, .eq user_id)
WhatsApp do contato
```

O que muda:

1. **Nova edge function `whatsapp-cloud-send-template`** — envio unitário por template aprovado, reaproveitando exatamente o padrão já validado em `enviar-convite-optin` (mesma leitura de `waba_id / phone_number_id / access_token / is_active`, mesmo endpoint, mesmo tratamento de erro).
2. **Campanha passa a exigir template aprovado** (`whatsapp_templates` com `tipo_uso = 'campanha'` e `status_meta = 'APPROVED'`). A tela de templates da Fase 2 já cobre criação/submissão/refresh; só falta permitir o `tipo_uso = campanha` na seleção.
3. **`CriarCampanhaWhatsAppModal`** deixa de gravar na fila (`inserir_campanha_fila`) e passa a: selecionar template aprovado → mapear variáveis (ex. `{{nome}}`) → mostrar preview dos destinatários elegíveis → disparar via a nova função.
4. **Opt-in obrigatório mantido e reforçado**: filtro só para `opt_in` **confirmado**, mais o filtro de STOP universal — a mesma regra do convite. Contato sem opt-in confirmado nunca entra na lista de envio (aparece no preview como bloqueado, com motivo).
5. **Travas preservadas**: `max_envios_dia` da campanha e `max_envios_dia_numero` continuam valendo; o "chip offline" (pausa após 5 falhas) é substituído por pausa em erro de token/permissão da Meta. Jitter/fila anti-bloqueio deixa de existir — na Meta oficial não é necessário.
6. **Grupos**: a Meta Cloud API **não envia para grupos de WhatsApp**. O disparo para `grupos_transmissao` / `pj_grupos_whatsapp` deixa de ter caminho oficial e será desabilitado na UI com aviso claro, em vez de falhar em silêncio. Campanha para grupo passa a ser lista de contatos individuais com opt-in.

## Fase 2 — Remoção do Baileys (lista antes de remover)

Nada é apagado antes da sua aprovação item por item. Proposta de classificação:

**A. Remover do caminho de envio (código de produção):**
- `supabase/functions/executar-campanhas-agendadas` → troca de destino (não é removida)
- `supabase/functions/send-wuzapi-message-pj`, `send-wuzapi-group-message-pj`, `send-wuzapi-message`, `send-wuzapi-message-afiliado`, `send-wuzapi-group-message`, `wuzapi-send`
- `supabase/functions/processar-fila-pj`, `processar-fila-afiliado`
- `supabase/functions/executar-envio-programado-pj`, `executar-envio-programado`, `execute-campaign`, `whatsapp-bulk-send`, `send-whatsapp-prospeccao`
- RPC `inserir_campanha_fila` (deixa de ser chamada; drop só na Fase 3)

**B. Conexão/QR/instância do gateway (fica órfão sem Baileys):**
- `criar-instancia-wuzapi-pj`, `criar-instancia-wuzapi-afiliado`, `generate-qrcode`, `get-qr-code`, `wuzapi-qrcode`, `check-connection`, `check-whatsapp-status`, `disconnect-whatsapp`, `trocar-numero-whatsapp`, `validate-whatsapp`, `validate-whatsapp-pj`, `verificar-status-wuzapi-afiliado`
- grupos via gateway: `create-whatsapp-group`, `create-whatsapp-group-pj`, `list-whatsapp-groups`, `list-whatsapp-groups-pj`, `get-group-participants`, `generate-group-invite-link`, `group-settings-pj`, `group-settings-afiliado`, `get-whatsapp-chats`

**C. Webhooks do gateway (substituídos por `whatsapp-cloud-webhook`):**
- `wuzapi-webhook`, `wuzapi-webhook-pj`, `wuzapi-webhook-afiliados`, `wuzapi-webhook-cobranca`, `wuzapi-webhook-debug`

**D. Diagnóstico/teste (lixo puro):**
- `diagnostico-wuzapi`, `diagnostico-portas-wuzapi`, `test-wuzapi-direct`, `test-wuzapi-check-formats`, `verificar-contabo-wuzapi`, `corrigir-webhook-contabo`, `verificar-webhook-wuzapi`
- `scripts/install-wuzapi*.sh`, `scripts/install-locaweb.sh`

**E. Frontend a remover ou desativar:**
- Painéis do gateway: `src/pages/GatewayWhatsApp.tsx`, `src/pages/AdminWuzapiInstancias.tsx`, `src/pages/OnboardingWhatsApp.tsx`, `src/pages/SophiaDispatcher.tsx` + `src/components/sophia/*` (GatewayStatusCard, FilaContadores, HistoricoEnvios, CampanhasList, IniciarCampanhaModal)
- Debug/teste: `DiagnosticoWuzapi`, `TestarEnvioWuzapi`, `TestarWuzapiDireto`, `TestarFilaAntiBloqueioModal`, `LogsEnvioWuzapi`, `WhatsAppDebugPanel`, `WhatsAppDiagnostics`, `DebugPayloads`, `TesteEnvioImagemDebug`
- Conexão por QR: `WhatsAppConnection`, `WhatsAppConnectionPJ`, `AfiliadoWhatsAppConnection` → substituídos pelo `ConectarWhatsAppCloud` (já existente)
- Rotas correspondentes em `src/App.tsx`

Entrego essa lista com contagem de referências por arquivo antes de encostar em qualquer um. Fluxos de afiliado seguem desativados por política e só entram na remoção como limpeza.

## Fase 3 — Limpeza de segurança e tabelas órfãs

Depois que nada mais escreve nessas tabelas:
1. Fechar `anon` em `fila_atendimento_pj` (4.588 linhas) e `gateway_status` (1 linha) — resolve os 2 fixes de segurança adiados.
2. Arquivar/dropar as órfãs: `fila_atendimento_pj`, `fila_atendimento_afiliado`, `gateway_status`, `wuzapi_instances`, `wuzapi_tokens_afiliados`, `logs_envio` do gateway. Proposta: primeiro revogar `anon` (imediato, reversível), dropar só num segundo momento com sua autorização.
3. Remover jobs `pg_cron` que chamam `processar-fila-*` e `executar-envio-programado*`.
4. Drop da RPC `inserir_campanha_fila` por último.

## Fase 4 — Confirmação de não-regressão do JARVIS/Silvester

O atendimento **já é Meta oficial** e não é tocado. Ele roda por:
`whatsapp-cloud-webhook` → `whatsapp_cloud_inbound_queue` → `whatsapp-cloud-inbound-processor` → Graph API.

Nenhum item das listas A–E faz parte desse caminho. Checagem explícita antes de remover: `whatsapp-cloud-inbound-processor` e `_shared/amz-context.ts` mencionam "wuzapi" apenas em comentário/legado — confirmo linha por linha e mostro o resultado antes de qualquer remoção. O `optInGate`, o reconhecimento dos números do dono e o encaminhamento de recado ficam intactos.

---

## Ordem de execução proposta

1. Fase 1 (nova função de envio + executor + modal + gate de opt-in) — validar com 1 envio real de template aprovado
2. Confirmar entrega real, e só então Fase 2 (remoção, em lotes, com lista aprovada)
3. Fase 3 (segurança/RLS primeiro, drops depois)
4. Fase 4 como checagem obrigatória antes de cada lote da Fase 2

## Detalhes técnicos

- Endpoint único: `POST https://graph.facebook.com/v25.0/{phone_number_id}/messages`, `type: "template"`, `template.name = whatsapp_templates.nome_meta`, `language.code = idioma` (default `pt_BR`).
- Credenciais sempre por tenant: `whatsapp_config` filtrado por `user_id` (regra de isolamento já vigente). Nunca fallback para conta admin.
- Erros da Meta seguem a convenção do projeto: HTTP 200 com `{ success: false, motivo }`, sem estourar o executor.
- `historico_envios` / `whatsapp_bulk_sends` continuam registrando, passando a gravar `canal = 'meta_cloud'` e `template_id`.
- Limitação a assumir: sem template aprovado não existe campanha. Texto livre em massa não é possível na Meta — só dentro da janela de 24h de conversa iniciada pelo cliente (que é o caso do atendimento, já coberto).
