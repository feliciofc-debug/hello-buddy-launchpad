
# Fase 2 — Bloco A: Gestão de Templates Meta

Escopo isolado: só cadastro/submissão/status de templates. **Não** toca em opt-in gate, executor de campanha, agente. Sem deploy até OK.

---

## 1) Arquivos a criar / editar

**Novos:**
- `src/pages/pj/WhatsAppTemplatesPJ.tsx` — tela de listagem + modal de criação.
- `src/components/pj/TemplateFormModal.tsx` — form controlado (nome, idioma, categoria, tipo_uso, body, botões).
- `supabase/functions/whatsapp-template-submit/index.ts` — submete à Meta (POST `/{waba_id}/message_templates`).
- `supabase/functions/whatsapp-template-refresh/index.ts` — puxa status atual da Meta (GET `/{waba_id}/message_templates?name=...`).

**Editados:**
- `src/App.tsx` — rota `/pj/whatsapp-templates`.
- `src/pages/DashboardMetricas.tsx` — item de menu "Templates WhatsApp" (id `whatsapp-templates`, filho lógico do bloco WhatsApp).
- `supabase/functions/whatsapp-cloud-webhook/index.ts` — captura webhook `message_template_status_update` e sincroniza `status_meta` + `motivo_rejeicao_meta` (assinatura Meta permite: campo `message_template_status_update` na subscription do WABA).

---

## 2) Chamadas à Meta Cloud API

Todas usam **token do tenant** lido de `whatsapp_config` via `user_id` (nunca env global). Graph version `v25.0` (mesmo padrão do `get-meta-public-config`).

### 2.1 Submeter template — `whatsapp-template-submit`
Input (JSON, JWT do usuário obrigatório):
```json
{ "template_id": "<uuid em whatsapp_templates>" }
```

Passos:
1. `auth.getUser()` do JWT → `user_id`.
2. Lê `whatsapp_templates` where `id = template_id AND user_id = user.id`. Se `status_meta != 'rascunho'` → 400.
3. Lê `whatsapp_config` where `user_id = user.id`. Extrai `waba_id`, `access_token`.
4. Monta body:
```json
{
  "name": "<nome_meta>",
  "language": "<idioma>",
  "category": "<UTILITY|MARKETING|AUTHENTICATION>",
  "components": [
    { "type": "BODY", "text": "<body_text>" },
    // se tipo_uso='convite_optin': BOTÕES quick reply
    { "type": "BUTTONS", "buttons": [
        { "type": "QUICK_REPLY", "text": "SIM" },
        { "type": "QUICK_REPLY", "text": "NÃO" }
    ]},
    // se header definido: { "type":"HEADER","format":"TEXT|IMAGE", ... }
  ]
}
```
5. `POST https://graph.facebook.com/v25.0/{waba_id}/message_templates` com `Authorization: Bearer {access_token}`.
6. Sucesso → grava `meta_template_id`, `status_meta='pendente'`, `motivo_rejeicao_meta=null`.
7. Erro (Graph API) → retorna HTTP 200 com `{success:false, error, error_user_msg}` (padrão do projeto p/ erros Meta).

Sobre os IDs de botão: a Meta usa `payload` opcional em quick reply; convencionamos que o **inbound** interpreta pelo texto ("SIM"/"NÃO") — o `optInGate` já cobre isso via normalização de texto e também os `OPTIN_SIM`/`OPTIN_NAO` (payload será setado no envio, não no template).

### 2.2 Refresh manual — `whatsapp-template-refresh`
Input:
```json
{ "template_id": "<uuid>" }   // ou { "user_id_all": true } p/ sync em massa
```
1. Lê template + `waba_id` + `access_token` do tenant.
2. `GET https://graph.facebook.com/v25.0/{waba_id}/message_templates?name={nome_meta}&language={idioma}` (Bearer token).
3. Atualiza `status_meta` (`APPROVED→aprovado`, `PENDING→pendente`, `REJECTED→rejeitado`, `PAUSED→pausado`) e `motivo_rejeicao_meta` (se `rejected_reason`).

### 2.3 Webhook automático (bônus, dá pra fazer sim)
No `whatsapp-cloud-webhook`, hoje o loop lê `change.value.messages`. Adicionar antes disso um branch:
```
if (change.field === "message_template_status_update") {
  const v = change.value;
  // v: { event: "APPROVED|REJECTED|PAUSED", message_template_id, message_template_name, message_template_language, reason? }
  await supabase.from("whatsapp_templates")
    .update({ status_meta: mapStatus(v.event), motivo_rejeicao_meta: v.reason ?? null })
    .eq("meta_template_id", String(v.message_template_id));
  continue;
}
```
Requer que na config do webhook na Meta, o campo `message_template_status_update` esteja marcado (além de `messages`). Se não estiver, o botão "Atualizar status" cobre — os dois convivem.

---

## 3) UI — `/pj/whatsapp-templates`

Tabela com colunas: Nome · Tipo (Convite/Campanha) · Categoria · Idioma · Status (badge colorido) · Meta ID · Ações.

Badges:
- `rascunho` cinza · `pendente` amarelo · `aprovado` verde · `rejeitado` vermelho (tooltip com `motivo_rejeicao_meta`) · `pausado` laranja.

Ações por linha:
- **Editar** (só se `rascunho`) → abre `TemplateFormModal`.
- **Submeter à Meta** (só se `rascunho`) → chama `whatsapp-template-submit`.
- **Atualizar status** (se `pendente|aprovado|pausado`) → chama `whatsapp-template-refresh`.
- **Duplicar** (qualquer status) → cria novo `rascunho`.

Botão global "**Atualizar todos**" → refresh em massa.

Modal `TemplateFormModal`:
- Nome Meta (snake_case, valida `/^[a-z0-9_]+$/`)
- Idioma (default `pt_BR`)
- **Tipo de uso** (radio): `Convite (opt-in)` / `Campanha`
- Categoria (auto: convite → `UTILITY`, campanha → `MARKETING`; editável)
- Body text (textarea, com dica de `{{1}}`, `{{2}}`)
- Preview lateral do WhatsApp
- Se convite: mostra "Botões: [SIM] [NÃO] (adicionados automaticamente)" desabilitado
- Se campanha: header opcional (texto ou imagem URL) + botão CTA URL opcional

---

## 4) Guardrails já embutidos

- Token sempre lido de `whatsapp_config.access_token` por `user_id` do JWT. Nunca `Deno.env`.
- Se `waba_id` ou `access_token` faltarem no tenant → 400 com mensagem clara "Conecte o WhatsApp Cloud antes de cadastrar templates".
- `whatsapp_template_submit` só aceita `rascunho`. Reenvio depois de rejeitado exige duplicar.
- RLS de `whatsapp_templates` já criada na Fase 1 — nada de novo.

---

## 5) Como valida antes de aprovar Bloco B/C

1. Cria um template convite `convite_optin_amz_v1` (UTILITY, pt_BR, corpo "Olá {{1}}! ... SIM/NÃO").
2. Submete → vê `status_meta='pendente'` e `meta_template_id` gravado.
3. Espera aprovação da Meta (minutos) → webhook OU botão "Atualizar" muda para `aprovado`.
4. Só depois disso Bloco B (`enviar-convite-optin`) tem base p/ trabalhar.

---

## 6) Fora do escopo do Bloco A (fica pra depois)

- Edge function `enviar-convite-optin` (Bloco B).
- Botão "Enviar convite" na tela de segmentos + contadores (Bloco C).
- Envio de campanha via template Meta (Fase 4).

Aprova o Bloco A que eu já aplico os arquivos e mando pra revisão sem deployar. Deploy só no seu OK final.
