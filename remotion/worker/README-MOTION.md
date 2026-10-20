# Worker de vídeos animados (Remotion) — instalação na VPS

Renderiza os jobs da fila `video_motion_jobs`. Só faz chamadas de saída — nenhuma porta é aberta.

## 1. Dependências

```bash
sudo apt-get update && sudo apt-get install -y chromium ffmpeg
node -v   # precisa ser 20+
```

## 2. Código

```bash
cd /opt && git clone <repo> amz && cd amz/remotion && npm install
```

## 3. Variáveis (`/opt/amz/remotion/.env`)

```
SUPABASE_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1
VPS_RENDER_TOKEN=<mesmo valor do secret no backend>
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

## 4. Subir

```bash
cd /opt/amz/remotion
pm2 start worker/worker-motion.mjs --name amz-motion --node-args="--env-file=.env"
pm2 save
```

## 5. Teste manual (sem fila)

```bash
node scripts/render-template.mjs template-agente /tmp/props.json /tmp/saida.mp4
node scripts/render-template.mjs template-veiculo-estudio /tmp/props-veiculo.json /tmp/veiculo.mp4
```

### Deploy após mudança visual (ex.: VIDEO-AUTO-2)

A composição é renderizada **na VPS**, não nas Edge Functions:

1. `git pull` em `/opt/amz` (ou caminho do clone `remotion/`).
2. `cd remotion && npm install` (se dependências mudaram).
3. `pm2 restart amz-motion` — o worker chama `scripts/render-template.mjs`, que faz **bundle** de `remotion/src/index.ts` a cada job (composição `template-veiculo-estudio` registrada em `Root.tsx`).

**Edge Functions** a atualizar no Supabase:
- `video-produto-create` (template/props/logo)
- `video-motion-claim` / `video-motion-complete` (etapa ao claim/concluir)
- **`video-motion-progress`** (worker reporta `progresso_pct` + `etapa` a cada ~10% do Remotion)
- Migration `progresso_pct`, `etapa`, `progresso_atualizado_em` em `video_motion_jobs`

O render reporta progresso via `render-template.mjs` (`onProgress`) e o worker via `worker-motion.mjs` (preparando/enviando).

**Frontend** (Vite): deploy normal para identidade/logo na aba Vídeos.

## Notas

- Um render de ~20s leva 1–3 min com `concurrency: 1`. A fila é justa por cliente (round-robin).
- Limite de 3 vídeos simultâneos por cliente, imposto em `video-motion-create`.
- O worker nunca publica: `video-motion-complete` só entrega o MP4 e, quando há plataformas, deixa `aguardando_aprovacao`.
