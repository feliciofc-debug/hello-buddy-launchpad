# Isca de Ebook + Entrega Automática pelo JARVIS (multi-tenant)

## Investigação — respostas A a D

**A) Onde está o ebook hoje?**
- Bucket `ebooks` (público) existe, mas está **vazio** — nenhum arquivo dentro.
- Tabela `afiliado_ebooks` tem **1 registro** (do tenant AMZ):
  - título: "Receitas Air Fryer - 50 Receitas Deliciosas"
  - url: `.../storage/v1/object/public/ebooks/ebook-airfryer-COMPLETO.html` → **link quebrado** (arquivo não existe no bucket)
- No repositório existem 4 HTMLs em `supabase/ebooks/` (o `-COMPLETO.html` tem 16 KB; os outros 112 KB) e uma edge function `ebook-airfryer` que devolve o ebook como **HTML gerado em código**.
- Não existe **nenhum PDF** em lugar algum: nem no Storage, nem em `public/ebooks/`.

**B) É completo ou só capa?**
- O conteúdo existente **é completo** (receitas, ingredientes, passos, tabela nutricional) — mas em **HTML**, não em PDF. Ou seja: o material existe, o arquivo entregável (PDF) não.

**C) Como funcionava e por que parou?**
- Funcionava pelo **WuzAPI/Baileys**: `wuzapi-webhook-afiliados` chamava `POST /chat/send/document` apontando para `https://amzofertas.com.br/ebooks/<arquivo>.pdf`, com fallback para mandar o link em texto.
- Parou por **dois motivos somados**: (1) o WuzAPI/Baileys foi aposentado; (2) a lista de ebooks era **hardcoded no código** (mapa fixo por categoria com nomes de PDF que nunca existiram no Storage) — então mesmo antes já caía no fallback de link, e o link aponta para arquivo inexistente.
- Há 9 registros em `afiliado_ebook_deliveries` e 9 em `leads_ebooks` — histórico de tentativa, todo do módulo afiliado (desativado).

**D) O `whatsapp-send-message` suporta PDF?**
- **Hoje não.** Ele só monta `type: template`, `type: image` e `type: text`. Falta o branch `type: document` (`{ link, filename, caption }`), que a Cloud API suporta nativamente. É uma adição pequena e retrocompatível.

**Conclusão prática:** nada do caminho antigo é reaproveitável a não ser a ideia. Precisamos de PDF real, campo por tenant, e suporte a documento no envio oficial.

---

## Plano em fases (ordenado por menor custo primeiro)

### Fase 1 — Base técnica (custo baixo)
1. Adicionar suporte a **documento** no `whatsapp-send-message`: novo branch `type: document` com `link`, `filename`, `caption`. Não altera nada existente.
2. Migração: tabela `tenant_ebooks` escopada por `user_id` (nome, `arquivo_url`, `arquivo_nome`, `ativo`, `texto_convite`, timestamps) + GRANTs + RLS por `auth.uid()` e `service_role`. Nada hardcoded para o AMZ.
3. Bucket dedicado `tenant-ebooks` (privado, com URL assinada de longa duração no envio) ou reuso do `ebooks` público — decidir junto: privado é mais seguro, público é mais simples para a Cloud API baixar.

### Fase 2 — Tela do tenant (custo baixo/médio)
4. Tela simples "Meu Ebook de Presente" (dentro de Configurações do WhatsApp): upload do PDF, nome do ebook, texto do convite, chave liga/desliga. Se o tenant não configurar, a isca **não existe** para ele — feature opcional.
5. Linguagem leiga, no mesmo padrão do modal guiado ("mensagem de presente", nada de "opt-in/template").

### Fase 3 — Entrega automática ao confirmar (custo médio) — o coração
6. No `whatsapp-cloud-inbound-processor`, no ponto onde o SIM já marca `opt_in_status='confirmado'`: se o tenant tem ebook ativo, enviar o PDF como documento na janela de 24h aberta pela própria resposta + mensagem "Prontinho! 🎉 Aqui está seu ebook".
7. **Idempotência**: registrar entrega (por `user_id` + telefone + ebook) e nunca reenviar. Fallback para link se o documento falhar.

### Fase 4 — Convite com isca na base fria (custo médio)
8. Reaproveitar `enviar-convite-optin` (já existe, já respeita STOP e teto diário): o texto do template de convite passa a citar o ebook do tenant. Como template Meta é pré-aprovado, o nome do ebook entra como **variável**, não como texto fixo — assim um único template serve todos os tenants.
9. Nada muda em guardrails: pendente/expirado, cooldown de 30 dias, STOP universal, teto diário.

### Fase 5 — Cliente quente (custo médio) — maior conversão
10. No agente: quando o contato já está conversando e está `pendente`, **depois de resolver o que a pessoa quer**, oferecer o ebook em momento natural ("se quiser, salva nosso contato que te mando de presente o ebook X 🎁"). Se topar: entrega na hora + confirma opt-in.
11. **Guardrail**: oferta uma única vez por contato; quem já recebeu ou recusou nunca é abordado de novo. Regra registrada no agent-soul junto do "atender primeiro".

---

## Detalhes técnicos

- Multi-tenant em todas as camadas: token do tenant (`whatsapp_config.access_token` por `user_id`), ebook do tenant (`tenant_ebooks.user_id`), RLS por `auth.uid()`.
- Cloud API limita documento a 100 MB; PDF de ebook fica bem abaixo. A Meta baixa o arquivo pela URL — se o bucket for privado, a URL assinada precisa estar válida no instante do envio.
- O PDF do AMZ precisa ser gerado a partir do HTML existente (`ebook-airfryer-COMPLETO.html`) e subido pela própria tela da Fase 2 — sem caminho especial no código.
- Tabelas legadas (`afiliado_ebooks`, `afiliado_ebook_deliveries`, `leads_ebooks`) ficam intocadas como histórico; o novo fluxo não depende delas.

## Ordem sugerida de aprovação
Fases 1+2 juntas (destravam tudo e são baratas) → Fase 3 (entrega funcionando) → Fase 5 (converte quem já fala com você) → Fase 4 (base fria).
