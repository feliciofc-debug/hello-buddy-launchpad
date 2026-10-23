# G90-2 — Agendador do resumo diário (Giro 30-60-90)

Edge function: `giro-resumo-diario`

## Autenticação

Mesmo padrão do `vitrine-crm-tick` e do disparo interno do Monitor Jarvis: **Bearer com a service role** do Supabase.

```bash
curl -sS -X POST \
  "$SUPABASE_URL/functions/v1/giro-resumo-diario" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Sem header válido → **401**.

## Frequência sugerida

- **A cada 15 minutos** (cron no servidor).
- Cada loja só envia **uma vez por dia** (campo `resumo_ultimo_envio`), após o horário configurado em `resumo_diario_hora` (padrão **18:00** America/Sao_Paulo).

## WhatsApp (janela 24h)

- Dentro da janela: texto livre via `whatsapp-send-message`.
- Fora da janela: template transacional aprovado, se existir.
  - Nome preferido: variável de ambiente `GESTAO_GIRO_RESUMO_TEMPLATE_NOME` (padrão `gestao_giro_resumo_v1`).
  - Fallback: template `transacional` com `nome_meta` contendo `giro` e `resumo`.
- Se estiver fora da janela **e** não houver template → **não envia** (resposta `falha_envio`, motivo `fora da janela 24h`); `resumo_ultimo_envio` **não** é atualizado.

## FIPE automática

Na mesma rotina, **uma vez por mês** por loja (`fipe_auto_ultima_competencia`), roda atualização FIPE em lotes de 20 (com `skip_ids` interno), reutilizando `giro-fipe-refresh-run`.

## Ativação por loja

Painel Gestão → Giro 30-60-90 → **Configurar regras** → “Receber resumo diário no WhatsApp” + horário.

Destinatários: telefone do dono (`whatsapp_cloud_agent_config`) + gestores (`empresa_config.gestao_gestores_json`). Nunca clientes.
