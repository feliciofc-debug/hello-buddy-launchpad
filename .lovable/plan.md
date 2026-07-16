# Silvester — Dossiê Inteligente do Cliente (Fase 1)

Vou transformar o Silvester num **coletor proativo de dossiê** para consórcio: ele conversa naturalmente, vai puxando dados do cliente, recebe qualquer imagem/PDF que chegar, extrai o conteúdo com IA (Gemini Vision) e monta uma ficha pronta pro Marcelo assinar a proposta.

---

## O que o Silvester passa a fazer

**Coleta proativa de dados** (desde a primeira mensagem, sem travar atendimento):
- Nome completo, CPF, data de nascimento, estado civil, profissão, renda mensal
- Endereço, e-mail, melhor telefone
- Interesse: tipo de bem (auto / imóvel / serviço / moto / caminhão), valor de carta desejado, prazo, se topa dar lance
- Faz uma pergunta por vez, de forma leve — nunca dispara questionário

**Recebe QUALQUER imagem/PDF** que o cliente enviar:
- RG, CNH, comprovante de residência, comprovante de renda, holerite, IR
- Foto do bem desejado, print de simulação de outro consórcio, qualquer coisa
- Salva no Storage privado (`silvester-docs/{cliente}/{arquivo}`)
- Roda **Gemini Vision** pra classificar o tipo do documento e extrair os campos
- Preenche automaticamente a ficha do cliente com o que extraiu
- Marca cada doc: ✅ validado, ⚠️ ilegível, ou 📄 outro (imagem que não é doc)
- Avisa o cliente com naturalidade: *"Recebi seu RG, tudo certo — CPF confere ✅"*

**Notifica o Marcelo em 2 momentos**:
- 🟡 **Parcial** — assim que tiver ficha básica + 1 documento validado → *"Novo dossiê iniciado: Fulano, quer carta 80k auto, já mandou RG"*
- 🟢 **Completo** — quando todos os 4 docs base (RG/CNH, residência, renda, IR) chegarem → *"Dossiê completo do Fulano pronto pra proposta"*

---

## Novidades pro Marcelo

**Nova aba `/dossies` no painel** (linkada do menu do dono):
- Lista de dossiês (parciais e completos), etiqueta 🟡/🟢
- Card por cliente: nome, telefone, foto do rosto (se veio no RG), campos extraídos editáveis
- Miniaturas de cada documento anexado + texto que o OCR extraiu
- Botão **"Baixar tudo (.zip)"** — junta os documentos originais para anexar na proposta Ademicon
- Botão **"Copiar ficha"** — ficha formatada pronta pra colar no sistema Ademicon
- Marcador de status: `Coletando` / `Aguardando proposta` / `Proposta enviada` / `Fechado`

---

## Estrutura técnica

**Nova tabela `silvester_dossies`** (uma linha por conversa/cliente):
- Campos da ficha (nome, cpf, rg, nascimento, estado_civil, profissao, renda, endereço, email)
- Campos do interesse (bem, valor_carta, prazo, aceita_lance)
- `status`, `completeness_score` (0-100), `parcial_notified_at`, `completo_notified_at`
- RLS: só o dono do agente (user_id) vê

**Nova tabela `silvester_documentos`**:
- FK para `silvester_dossies`
- `tipo` (rg, cnh, comprovante_residencia, comprovante_renda, ir, foto_bem, outro)
- `storage_path`, `ocr_texto`, `dados_extraidos` (JSONB), `status_validacao`
- `wamid` original da mensagem WhatsApp

**Novo bucket privado `silvester-docs`** com RLS por user_id.

**Novas edge functions**:
- `silvester-extract-document` — recebe media_url do WhatsApp, baixa, salva no Storage, chama Gemini Vision (`google/gemini-3.1-pro-preview`) com prompt de classificação+extração, atualiza o dossiê
- `silvester-notify-owner` — dispara o recado 🟡/🟢 pro Marcelo via `encaminhar_recado_ao_dono` já existente

**Alterações no `whatsapp-cloud-inbound-processor`**:
- Detectar mídia de imagem/PDF → chamar `silvester-extract-document` em background
- Nova ferramenta `atualizar_dossie_cliente(campo, valor)` que o LLM chama quando o cliente informa nome/cpf/renda/etc na conversa
- Nova ferramenta `pedir_proximo_documento()` que retorna qual doc pedir a seguir (baseado no que falta no dossiê)
- Expandir o `ownerHintBlock` com instruções de coleta proativa

**Nova rota `/dossies`** (`src/pages/Dossies.tsx`) + card no menu do dono.

---

## Fase 2 (futura, fora deste plano)

Quando quiser, integramos com API/portal Ademicon pra calcular parcela real e criar proposta em rascunho — a fundação de dados já vai estar pronta.

---

## Ordem de execução

1. Migration: tabelas + bucket + RLS
2. Edge function `silvester-extract-document` + prompt de Vision
3. Atualizar `whatsapp-cloud-inbound-processor` (detecção de mídia + novas tools + coleta proativa)
4. Página `/dossies` com lista, cards, download .zip e copiar ficha
5. Testar com uma imagem de RG e ver o dossiê montar

Confirma pra eu ir?