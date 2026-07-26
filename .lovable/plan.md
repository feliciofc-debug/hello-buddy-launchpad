# Fase 1 revisada — Opt-in via 2 templates Meta

Você acertou a leitura da regra. A primeira mensagem também é *business-initiated*, então também precisa ser template aprovado. Abaixo está o fluxo redondo, encaixado na Fase 1, **sem código ainda**.

---

## 1) Máquina de estados do opt-in

Campo novo em `pj_lista_membros` (e espelhado em `whatsapp_contacts` pra visão global):

```text
opt_in_status  ∈  { pendente, convite_enviado, confirmado, recusado, expirado }
opt_in_origem  text     (ex: 'convite_template', 'inbound_manual', 'retroativo_jarvis')
opt_in_em      timestamptz
convite_enviado_em     timestamptz
convite_template_id    uuid   (qual template de convite foi usado)
```

Transições:

```text
pendente ──(dispara Template 1)──▶ convite_enviado
convite_enviado ──(inbound "SIM"/aceite)──▶ confirmado
convite_enviado ──(inbound "NÃO"/"SAIR"/"PARE")──▶ recusado
convite_enviado ──(7 dias sem resposta)──▶ expirado   [pode ser reengajado 1x]
confirmado ──(inbound "SAIR"/"PARE" a qualquer momento)──▶ recusado
```

Regra dura no executor: **só dispara Template 2 (campanha) se `opt_in_status = 'confirmado'`**. Ponto.

---

## 2) Os dois templates na plataforma

Nova tabela `whatsapp_templates` (Fase 2 no plano original, mas já defino o schema aqui pra Fase 1 saber onde apontar):

```text
whatsapp_templates
├─ id, user_id, waba_id
├─ nome_meta            (nome exato submetido à Meta, snake_case)
├─ tipo_uso             ∈ { convite_optin, campanha, transacional }
├─ categoria_meta       ∈ { UTILITY, MARKETING, AUTHENTICATION }
├─ idioma               ('pt_BR')
├─ body_text            (com {{1}}, {{2}}...)
├─ header               (jsonb: text ou image)
├─ botoes               (jsonb: quick_reply "SIM"/"NÃO" no convite; url/call no campanha)
├─ variaveis_map        (jsonb: {{1}}: 'nome_contato', {{2}}: 'nome_empresa'...)
├─ status_meta          ∈ { rascunho, pendente, aprovado, rejeitado, pausado }
├─ motivo_rejeicao_meta text
└─ meta_template_id     text   (id retornado pela Meta)
```

`tipo_uso` é o pulo do gato: o executor de campanha filtra `tipo_uso='campanha'`, e a rotina de convite filtra `tipo_uso='convite_optin'`. Uma UI, dois caminhos.

**Template 1 — Convite (categoria UTILITY na Meta):**
- Body: "Olá {{1}}! Aqui é a {{2}}. Podemos te enviar nossas novidades e ofertas? Responda **SIM** para confirmar ou **NÃO** para não receber."
- Botões *quick reply*: `[SIM]` `[NÃO]` — a Meta permite e melhora conversão + facilita parsing.
- Sugestão de submeter como **UTILITY** (não Marketing) porque o conteúdo é serviço/consentimento, não oferta. Aprova mais rápido e cai em janela de serviço.

**Template 2 — Campanha (categoria MARKETING):**
- Body com variáveis do produto (`{{1}}=nome`, `{{2}}=produto`, `{{3}}=preço`).
- Header com imagem do produto.
- Botão CTA "Ver oferta" (URL).

---

## 3) Captura do "SIM" — reaproveitando o inbound-processor

**Sim, dá pra reaproveitar o `whatsapp-cloud-inbound-processor`.** Ele já recebe todo inbound do tenant. Só precisamos de um novo bloco no início do handler, **antes do fluxo do Silvester/Jarvis**:

```text
optInGate(mensagem_inbound):
  1. procura em pj_lista_membros um registro com esse telefone
     E opt_in_status='convite_enviado'
     E convite_enviado_em > now() - interval '7 days'

  2. se achou, tenta classificar a resposta:
     - button_reply id='SIM' → confirmado
     - button_reply id='NAO' → recusado
     - texto normalizado (unaccent+lower+trim) em
       {'sim','s','ok','pode','pode sim','aceito','confirmo','quero'} → confirmado
     - texto em {'nao','n','pare','sair','parar','stop','cancelar','descadastrar'} → recusado
     - qualquer outra coisa → NÃO consome o inbound, deixa fluir pro Silvester/Jarvis normalmente
       (mas mantém convite_enviado até expirar)

  3. atualiza opt_in_status, opt_in_em, opt_in_origem
  4. dispara mensagem de confirmação dentro da janela de 24h (texto livre, não é template):
     - se confirmado: "Show! Você está na lista. 🎉 Em breve novidades."
     - se recusado: "Combinado, não vamos te incomodar. Se mudar de ideia, é só chamar aqui."
  5. registra em opt_in_log (auditoria: quem, quando, canal, texto original)
```

Ponto fino: quando o cliente clica no botão "SAIR"/"PARE" **em qualquer momento** (mesmo já `confirmado`), o mesmo gate marca `recusado` e envia confirmação. Compliance-friendly.

Segundo ponto fino: o gate roda **antes** do Silvester/Jarvis, então o "SIM" não vira uma conversa comercial acidental. Se a mensagem não bate com o gate, segue o fluxo normal.

---

## 4) Rotina de convite (novo edge function `enviar-convite-optin`)

- Roda sob demanda quando o usuário clica **"Enviar convite de opt-in"** em uma lista/segmento.
- Também roda em batch controlado (autopilot de convite) — mesmo motor de trava de volume/jitter que já existe.
- Só envia pra `opt_in_status IN ('pendente', 'expirado')`.
- Usa `whatsapp-send-message` com `template_id` de `tipo_uso='convite_optin'` e `status_meta='aprovado'`.
- Marca `opt_in_status='convite_enviado'` + `convite_enviado_em=now()`.
- **Reaproveita todas as travas atuais:** cap por número (300), jitter, dedup por telefone, kill-switch.
- Cron diário limpa expirados (`convite_enviado_em < now()-7d` → `expirado`).

---

## 5) UI da Fase 1

Página "Clientes e Segmentos" ganha:

- **Badge de opt-in por contato:** 🟢 Confirmado / 🟡 Convite enviado (há 2d) / ⚪ Pendente / 🔴 Recusado / ⏰ Expirado
- **Filtros:** "Só confirmados" / "Pendentes de convite" / "Convite expirado"
- **Ação em massa:** "Enviar convite de opt-in para X pendentes" → abre modal com preview do template 1 aprovado, contagem, e trava de volume.
- **Backfill retroativo:** botão "Marcar como confirmado quem já falou comigo no Jarvis/Silvester" — usa `whatsapp_contacts`+`pietro_conversations` como fonte, marca `opt_in_origem='retroativo_inbound'`. Isso responde à pergunta 1 do plano original: **retroativo por inbound é opt-in implícito válido** (a pessoa iniciou conversa com você — regra da Meta permite).

Preview do modal de campanha (que já existe) passa a mostrar:

```text
Destinatários totais:   1.240
Com opt-in confirmado:    312   ← serão enviados
Pendentes de convite:     680   [Enviar convite antes]
Recusados / expirados:    248   ← ignorados
```

---

## 6) O que muda no plano original

- **Fase 1 cresce um pouco:** agora inclui o schema de `whatsapp_templates` (só o schema + seed do template de convite, submissão à Meta fica na Fase 2), o edge function `enviar-convite-optin`, e o novo bloco `optInGate` no inbound-processor.
- **Fase 2** continua sendo a UI completa de gestão de templates (CRUD, submissão, sincronização de status) — mas o template de convite já vai estar cadastrado desde a Fase 1 pra você conseguir rodar convite antes mesmo da UI completa ficar pronta.
- **Fase 4 (virada do executor)** ganha uma linha só: `WHERE opt_in_status='confirmado'` no filtro de destinatários. Zero complexidade extra.
- **Fase 5** não muda.

---

## 7) Ordem sugerida dentro da Fase 1 (do mais barato pro mais caro)

1. Migração: campos de opt-in em `pj_lista_membros` + tabela `whatsapp_templates` + tabela `opt_in_log`.
2. Backfill retroativo (SQL puro, sem UI ainda) — marca quem já falou com Jarvis/Silvester como `confirmado`.
3. Bloco `optInGate` no `whatsapp-cloud-inbound-processor` — só a lógica de captura (ainda sem UI de disparo).
4. Seed manual do Template 1 de convite (uma vez, via SQL) enquanto Fase 2 não entrega o CRUD.
5. Edge function `enviar-convite-optin` + botão "Enviar convite" na UI de segmentos.
6. Badges e filtros na página "Clientes e Segmentos".
7. Preview de destinatários no modal de campanha (só o card informativo — o filtro real entra na Fase 4).

Se o crédito apertar depois do passo 3, você **já tem base limpa retroativa + captura automática de novos aceites** rodando, mesmo sem UI. É o mínimo viável blindado.

---

## 8) Três perguntas do plano original — decisões pendentes

1. **Retroativo:** confirmo tratar inbound histórico (`whatsapp_contacts` + `pietro_conversations` + `opt_ins` já existente) como `confirmado` com origem `retroativo_inbound`? **Recomendo sim** — é aderente à regra da Meta ("cliente iniciou conversa").
2. **WABA ID do AMZ:** você tem em mãos? Precisamos guardar em `whatsapp_config` (nova coluna `waba_id`) já na migração da Fase 1, mesmo que a submissão de template só role na Fase 2.
3. **Flag de roll-back** `usar_meta_oficial` por campanha: mantenho ou corte seco na Fase 4? Recomendo manter — barato e salva o dia se der ruim.

Me confirma esses 3 pontos + libera "codar Fase 1 nessa ordem", e eu executo só o autorizado.
