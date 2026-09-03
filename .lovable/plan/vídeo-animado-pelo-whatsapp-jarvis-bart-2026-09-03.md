# Vídeo animado pelo WhatsApp (Jarvis/BART)

Plano técnico. Nada foi alterado no código.

## 1. Como o agente funciona hoje

Ponto de entrada em duas etapas:

- `whatsapp-cloud-webhook` — recebe o webhook da Meta, valida e repassa.
- `whatsapp-cloud-inbound-processor` (~8.300 linhas) — é o cérebro. Baixa mídia,
  transcreve áudio, monta o contexto do tenant e chama o Lovable AI Gateway
  (`/v1/chat/completions`, Gemini 2.5/3.1 conforme o tipo de turno) com um array
  `TOOLS` de function calling. Loop de até 4 rodadas: o modelo escolhe uma tool,
  `runTool(name, args, ctx)` executa, o resultado volta como mensagem `tool`.

Ele **já executa ações reais**, não só conversa: gerar/editar imagem, criar
carrossel, criar anúncio, postar e agendar nas redes (com token de confirmação),
salvar mídia na biblioteca, registrar lead, encaminhar recado ao dono, consultar
estoque/campanhas/autopilot, entregar ebook em PDF. Ou seja, vídeo motion é
**mais uma tool**, não uma nova arquitetura.

Descoberta importante: a fila já foi desenhada para esse caso. `video_motion_jobs`
tem as colunas `telefone` e `origem` ('plataforma' | 'whatsapp'), e
`video-motion-complete` já entrega o MP4 por WhatsApp
(`whatsapp-send-message` com `video_url`) quando o job tem telefone. Metade do
caminho de volta existe.

## 2. Detecção da intenção

Três camadas, na ordem:

1. **Function calling** — nova tool `criar_video_animado(tema, formato?, plataformas?)`
   com description restritiva: só para pedido explícito de vídeo animado/motion
   ("faz um vídeo sobre...", "monta um vídeo de consórcio"), nunca quando o
   usuário acabou de enviar uma foto/vídeo (aí é `salvar_midia_biblioteca`).
2. **Guarda determinística** (mesmo padrão do `detectQuoteIntent`): regex de
   intenção de vídeo sem mídia anexada força a tool, para o modelo não "conversar"
   em vez de agir.
3. **Guarda negativa** — turno com mídia nova nunca cai nessa tool (o
   `media_guard` que já existe cobre isso).

Ambíguo ("quero divulgar consórcio") → o agente pergunta uma vez: vídeo animado,
post com imagem ou carrossel. Sem tema claro (< 4 caracteres úteis) → pergunta o
tema em vez de inventar.

## 3. Identidade visual — vem do cadastro, não do chat

Já resolvido pelo backend, e é o mesmo caminho da plataforma:

- marca, site, segmento, diferenciais → `empresa_config` via `business-context.ts`
- logo → `tenant_logos` (registro ativo, `storage_path` prefixado com o `user_id`)
- cores → paleta salva do tenant; sem paleta, `PALETA_PADRAO`
- telefone/consultor → do próprio contato WhatsApp e do cadastro

Cadastro incompleto:

| Faltando | Comportamento |
|---|---|
| Logo | Renderiza com iniciais da marca e avisa "sem logo cadastrada, quer subir uma?" |
| Cores | Usa a paleta padrão e avisa |
| Nome da empresa | **Bloqueia** e pede o nome — sem marca não existe white label |
| Site | Fica vazio (já é opcional; nunca cai em amzofertas.com.br) |

## 4. Aprovação — concordo, roteiro antes do render

`video-motion-create` já tem o modo `apenas_roteiro: 1`. Fluxo:

1. Usuário pede o vídeo.
2. Agente gera o roteiro (hook, 4-6 mensagens do chat, CTA) e manda em texto,
   com a duração estimada.
3. Usuário responde "pode fazer" / pede ajuste ("mais curto", "foca em imóvel").
   Ajuste = regenerar o roteiro, não enfileirar.
4. Só na aprovação o job entra na fila, com posição e tempo estimado.

Detalhe técnico obrigatório: o `pendingFormatChoice` atual é um `Map` em memória
do processor — some quando a função recicla. Para aprovação, o roteiro pendente
precisa ir para tabela (`video_motion_rascunhos` ou coluna de job em status
`aguardando_aprovacao`), com token curto e TTL de ~2h, mesmo padrão do
"pode postar {token}".

## 5. Entrega do MP4

`video-motion-complete` já faz: sucesso → grava no Storage, gera URL assinada,
chama `whatsapp-send-message` com `video_url`. A Meta aceita vídeo por link até
16 MB; nossos MP4 têm 3-6 MB, folga confortável. Se algum dia passar, fallback
`document_url` (o usuário baixa) ou link assinado em texto.

O que falta ali: a mensagem de acompanhamento por WhatsApp em falha definitiva e
a validação do MP4 antes de anunciar sucesso (parte já foi endurecida).

## 6. Controles e limites (o ponto que quebra em produção)

- **Limite por usuário**: `LIMITE_FILA_POR_USUARIO = 3` já existe em
  `video-motion-create`. Para WhatsApp eu baixaria para **1 job ativo**: o
  worker é single-thread, e um consultor pedindo 5 vídeos por áudio trava a fila
  de todos os tenants.
- **Cota diária por tenant** (ex. 5/dia), contada em `video_motion_jobs`, com
  mensagem clara ao estourar.
- **Fila justa**: hoje o claim é FIFO puro. Vale round-robin por `user_id`
  (pega o job mais antigo do tenant com menos jobs concluídos hoje) para um
  tenant não monopolizar.
- **Anti-duplicidade**: bloquear novo job com o mesmo tema do tenant nos últimos
  10 minutos (o usuário repete o pedido quando não vê resposta imediata).
- **Timeout/watchdog**: job em `processando` há mais de 15 min volta a
  `pendente` (cron), senão a fila trava se a VPS cair no meio.
- **Feedback de espera**: informar posição na fila; com 2+ jobs à frente, avisar
  que pode levar 10+ minutos.

## 7. Fases, esforço e riscos

**Fase 1 — tool de vídeo com aprovação (simples, ~1 rodada)**
Nova tool `criar_video_animado` + `confirmar_video_animado`, rascunho persistido,
chamada ao `video-motion-create` com `origem: 'whatsapp'` e `telefone`.
Bloqueio conhecido: `video-motion-create` exige JWT de usuário
(`anon.auth.getUser()`), e o processor roda com service role. Solução: extrair a
lógica para `_shared/video-motion-enfileirar.ts` e chamá-la direto do processor
(user_id já resolvido pelo número), sem tocar no contrato HTTP atual da tela.

**Fase 2 — limites e fila justa (médio)**
Limite 1 job ativo por WhatsApp, cota diária, anti-duplicidade, watchdog de
`processando` travado, mensagem de fila.

**Fase 3 — pós-entrega (opcional)**
Depois do MP4, oferecer "quer que eu poste no Instagram/Facebook?" reaproveitando
o fluxo de confirmação de postagem que já existe.

**Riscos**
- Alto: mexer no dispatcher de tools do processor (arquivo enorme, é o canal de
  produção da Ademicon e do Paulo). Mitigação: só adicionar tool e handler, sem
  reescrever fluxos existentes.
- Médio: alterar `video-motion-create` pode quebrar a tela de criação.
  Mitigação: extrair o núcleo compartilhado e manter a rota HTTP intacta.
- Médio: fila compartilhada com um worker — sem os limites da Fase 2, a Fase 1
  em produção degrada a experiência de todos.
- Baixo: custo de IA (roteiro é uma chamada Flash) e custo de render (VPS
  própria, sem custo por vídeo).
