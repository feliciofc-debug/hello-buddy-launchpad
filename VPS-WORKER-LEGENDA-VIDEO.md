# Worker de legenda de vídeo na VPS (Contabo 38.242.146.217)

O worker **não expõe porta nenhuma**. Ele só faz chamadas de saída para a plataforma.
Sem Nginx, sem subdomínio, sem certificado.

## 1. O que ele faz

Em loop, a cada 10 segundos:

1. `POST /video-render-claim` → recebe (ou não) 1 job
2. Baixa o vídeo original pela URL assinada
3. Queima a legenda com FFmpeg
4. Sobe o MP4 pela URL de upload assinada
5. `POST /video-render-complete` com o resultado (ou o erro)

Concorrência: **1 job por vez**.

## 2. Endpoints da plataforma (já no ar)

Base: `https://jibpvpqgplmahjhswiza.supabase.co/functions/v1`

Header obrigatório em todas as chamadas: `x-render-token: <VPS_RENDER_TOKEN>`

### `POST /video-render-claim`  (body `{}`)

Sem job: `{"success":true,"job":null}`

Com job:

```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "video_download_url": "https://...assinada (1h)",
    "upload": {
      "url": "https://...signed upload url",
      "token": "...",
      "bucket": "videos",
      "path": "legendados/<user>/<job>.mp4",
      "content_type": "video/mp4"
    },
    "segmentos": [{ "start": 0.0, "end": 2.4, "text": "texto da legenda" }],
    "formato": "reels",
    "estilo": {
      "font": "DejaVu Sans", "bold": true,
      "fontsize_ratio": 0.052, "fontsize_min": 28,
      "cor_texto": "#FFFFFF", "contorno": "#000000", "contorno_ratio": 0.11,
      "caixa": true, "caixa_cor": "black@0.62", "caixa_padding_ratio": 0.35,
      "pos_y_ratio": 0.8, "max_linhas": 3, "max_chars_linha": 42
    },
    "tentativa": 1
  }
}
```

### Upload do resultado

`PUT` na `upload.url` com `Content-Type: video/mp4` e o arquivo no corpo.

### `POST /video-render-complete`

Sucesso:

```json
{ "job_id": "uuid", "success": true, "resultado_bucket": "videos", "resultado_path": "legendados/.../x.mp4", "duracao_segundos": 47.2 }
```

Erro:

```json
{ "job_id": "uuid", "success": false, "erro": "mensagem curta do ffmpeg" }
```

A plataforma cuida de retentativa (até 3), publicação nas redes e aviso ao cliente no WhatsApp.

## 3. Instalação

```bash
mkdir -p /opt/render-worker && cd /opt/render-worker
```

`.env` (600, nunca versionar):

```
API_BASE=https://jibpvpqgplmahjhswiza.supabase.co/functions/v1
RENDER_TOKEN=<mesmo valor combinado com a plataforma>
POLL_SECONDS=10
```

`docker-compose.yml`:

```yaml
services:
  render-worker:
    image: python:3.12-slim
    container_name: render-worker
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./worker.py:/app/worker.py:ro
      - ./tmp:/tmp/render
    working_dir: /app
    command: >
      bash -lc "apt-get update &&
      apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core &&
      pip install --no-cache-dir requests &&
      python -u worker.py"
    deploy:
      resources:
        limits:
          cpus: "3.0"
          memory: 3g
```

`worker.py`:

```python
import os, time, json, subprocess, tempfile, textwrap, requests

API = os.environ["API_BASE"].rstrip("/")
TOKEN = os.environ["RENDER_TOKEN"]
POLL = int(os.environ.get("POLL_SECONDS", "10"))
H = {"x-render-token": TOKEN, "Content-Type": "application/json"}

def esc(t):
    return (t.replace("\\", "\\\\").replace(":", "\\:")
             .replace("'", "\u2019").replace("%", "\\%"))

def filtros(segs, estilo, w, h):
    fs = max(int(estilo["fontsize_min"]), int(w * estilo["fontsize_ratio"]))
    y = int(h * estilo["pos_y_ratio"])
    out = []
    for s in segs[:80]:
        linhas = textwrap.wrap(s["text"].replace("\n", " "),
                               width=estilo["max_chars_linha"])[:estilo["max_linhas"]]
        for i, linha in enumerate(linhas):
            dy = y + (i - (len(linhas) - 1) / 2) * int(fs * 1.28)
            out.append(
                "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
                f":text='{esc(linha)}':fontsize={fs}:fontcolor=white"
                f":borderw={max(3, int(fs * estilo['contorno_ratio']))}:bordercolor=black"
                f":box=1:boxcolor={estilo['caixa_cor']}:boxborderw={int(fs * estilo['caixa_padding_ratio'])}"
                f":x=(w-text_w)/2:y={int(dy)}"
                f":enable='between(t,{s['start']:.2f},{s['end']:.2f})'"
            )
    return ",".join(out)

def dimensoes(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height", "-of", "json", path],
                       capture_output=True, text=True, check=True)
    st = json.loads(r.stdout)["streams"][0]
    return int(st["width"]), int(st["height"])

def processar(job):
    with tempfile.TemporaryDirectory(dir="/tmp/render") as d:
        src, dst = f"{d}/in.mp4", f"{d}/out.mp4"
        with requests.get(job["video_download_url"], stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(src, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
        w, h = dimensoes(src)
        vf = filtros(job["segmentos"], job["estilo"], w, h)
        subprocess.run(["ffmpeg", "-y", "-i", src, "-vf", vf,
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                        "-movflags", "+faststart", dst],
                       check=True, capture_output=True, text=True, timeout=1800)
        up = job["upload"]
        with open(dst, "rb") as f:
            r = requests.put(up["url"], data=f,
                             headers={"Content-Type": up["content_type"]}, timeout=1800)
            r.raise_for_status()
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                              "format=duration", "-of", "csv=p=0", dst],
                             capture_output=True, text=True).stdout.strip()
        return up["bucket"], up["path"], float(dur or 0)

os.makedirs("/tmp/render", exist_ok=True)
print("render-worker iniciado", flush=True)
while True:
    try:
        r = requests.post(f"{API}/video-render-claim", headers=H, json={}, timeout=60)
        job = (r.json() or {}).get("job")
        if not job:
            time.sleep(POLL); continue
        print("job", job["id"], flush=True)
        try:
            bucket, path, dur = processar(job)
            body = {"job_id": job["id"], "success": True, "resultado_bucket": bucket,
                    "resultado_path": path, "duracao_segundos": dur}
        except subprocess.CalledProcessError as e:
            body = {"job_id": job["id"], "success": False,
                    "erro": (e.stderr or "")[-500:] or "ffmpeg falhou"}
        except Exception as e:
            body = {"job_id": job["id"], "success": False, "erro": str(e)[:500]}
        requests.post(f"{API}/video-render-complete", headers=H, json=body, timeout=120)
    except Exception as e:
        print("loop erro:", e, flush=True)
        time.sleep(POLL)
```

Subir:

```bash
docker compose up -d && docker logs -f render-worker
```

Teste rápido de conectividade (deve devolver `{"success":true,"job":null}`):

```bash
curl -s -X POST -H "x-render-token: $RENDER_TOKEN" \
  https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/video-render-claim -d '{}'
```

Se devolver `401 token inválido`, o valor do `.env` não é o mesmo guardado na plataforma.
