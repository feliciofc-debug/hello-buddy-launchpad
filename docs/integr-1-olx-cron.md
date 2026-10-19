# INTEG-1 — Cron OLX (status pós-publicação)

A edge `olx-vehicle-sync` aceita:

1. **Batch (cron):** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` — processa todos os `olx_vehicle_listing` com `status = pendente`.
2. **Por veículo (usuário):** JWT do lojista + body `{ "veiculo_id": "<uuid>" }`.

## Crontab sugerido (a cada 15 min)

Substitua `SUPABASE_URL` e `SERVICE_ROLE_KEY` pelos valores do projeto (não commitar chaves):

```cron
*/15 * * * * curl -sS -X POST "$SUPABASE_URL/functions/v1/olx-vehicle-sync" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' >> /var/log/amz-olx-sync.log 2>&1
```

Equivalente ao tick do ML (`ml-notifications-process` / reconcile), mantém `pendente` → `publicado` + `olx_url` ou `erro` + `last_error`.
