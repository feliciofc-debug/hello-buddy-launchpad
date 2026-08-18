# Worker de legenda de vídeo na VPS

Especificação completa para quem for instalar. O worker **não expõe porta nenhuma**:
só faz chamadas de saída para a plataforma. Sem Nginx, sem subdomínio, sem certificado.

## 1. O que ele faz

Em loop, a cada 30 segundos:

1. `POST /video-render-claim` → recebe (ou não) 1 job
2. Baixa o vídeo original pela URL assinada
3. Queima a legenda com FFmpeg (`-threads 3`)
4. Sobe o MP4 pela URL de upload assinada
5. `POST /video-render-complete` com o resultado (ou o erro)
6. Limpa os temporários do job e varre órfãos com mais de 3 horas

Concorrência: **1 job por vez**. Teto de CPU do container: **3 de 6 vCPU**.

## 2. Endpoints da plataforma (já no ar)

Base: `https://jibpvpqgplmahjhswiza.supabase.co/functions/v1`

Header obrigatório em todas as chamadas: `x-render-token: <RENDER_TOKEN>`
Token errado ou ausente → `401 {"success":false,"error":"token inválido"}`.

### `POST /video-render-claim`  (body `{}`)

Sem job na fila:

```json
{ "success": true, "job": null }
```

Com job:

```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "video_download_url": "https://... URL assinada, validade 1h",
    "upload": {
      "url": "https://... signed upload url",
      "token": "...",
      "bucket": "videos",
      "path": "legendados/<user>/<job>.mp4",
      "content_type": "video/mp4"
    },
    "segmentos": [{ "start": 0.0, "end": 2.4, "text": "texto da legenda" }],
    "formato": "reels",
    "estilo": {
      "font": "DejaVu Sans",
      "fontfile": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "bold": true,
      "fontsize_ratio": 0.035,
      "fontsize_min": 22,
      "cor_texto": "#FFFFFF",
      "contorno": "#000000",
      "contorno_ratio": 0.07,
      "caixa": true,
      "caixa_cor": "black@0.62",
      "caixa_padding_ratio": 0.2,
      "pos_y_ratio": 0.8,
      "max_linhas": 3,
      "max_chars_linha": 20,
      "threads": 3
    },
    "tentativa": 1
  }
}
```

### Upload do resultado

`PUT` na `upload.url`, header `Content-Type: video/mp4`, arquivo no corpo.

### `POST /video-render-complete`

Sucesso:

```json
{ "job_id": "uuid", "success": true, "resultado_bucket": "videos",
  "resultado_path": "legendados/.../x.mp4", "duracao_segundos": 47.2 }
```

Erro:

```json
{ "job_id": "uuid", "success": false, "erro": "mensagem curta do ffmpeg" }
```

A plataforma cuida de retentativa (até 3), publicação nas redes e aviso ao cliente
no WhatsApp. O worker nunca precisa reenfileirar nada.

## 3. Comando FFmpeg

Fonte: **DejaVu Sans Bold** (`fonts-dejavu-core`) — licença livre, redistribuível em
imagem Docker, com acentuação completa do português (á à ã â é ê í ó õ ô ú ç).
Nunca usar fonte proprietária.

Para cada linha de cada segmento é gerado um `drawtext` com `enable=between(t,start,end)`:

```
ffmpeg -y -i in.mp4 \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:\
text='LINHA':fontsize=FS:fontcolor=white:borderw=BW:bordercolor=black:\
box=1:boxcolor=black@0.62:boxborderw=PAD:x=(w-text_w)/2:y=Y:\
enable='between(t,0.00,2.40)', ... " \
  -threads 3 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart out.mp4
```

Onde: `FS = max(fontsize_min, largura * fontsize_ratio)`,
`BW = max(3, FS * contorno_ratio)`, `PAD = FS * caixa_padding_ratio`,
`Y = altura * pos_y_ratio` deslocado por linha em `FS * 1.28`.
Cada linha é medida pela largura real da fonte com Pillow e só é aceita quando
`largura_do_texto + 2 * padding + 2 * contorno <= 84% da largura do vídeo`.
Máximo de 80 segmentos e 3 linhas por segmento.

## 4. Variáveis do `.env`

```
API_BASE=https://jibpvpqgplmahjhswiza.supabase.co/functions/v1
RENDER_TOKEN=<o mesmo valor guardado na plataforma>
POLL_SECONDS=30
TMP_DIR=/var/lib/render-worker/tmp
TMP_MAX_HORAS=3
FFMPEG_THREADS=3
```

Arquivo com permissão `600`, fora de qualquer repositório.

## 5. Instalação

```bash
mkdir -p /opt/render-worker /var/lib/render-worker/tmp && cd /opt/render-worker
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
      - /var/lib/render-worker/tmp:/var/lib/render-worker/tmp
    working_dir: /app
    command: >
      bash -lc "apt-get update &&
      apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core &&
      pip install --no-cache-dir requests pillow &&
      python -u worker.py"
    deploy:
      resources:
        limits:
          cpus: "3.0"
          memory: 3g
```

`worker.py`:

```python
import os, time, json, glob, shutil, subprocess, tempfile, requests
from PIL import ImageFont

API = os.environ["API_BASE"].rstrip("/")
TOKEN = os.environ["RENDER_TOKEN"]
POLL = int(os.environ.get("POLL_SECONDS", "30"))
TMP = os.environ.get("TMP_DIR", "/var/lib/render-worker/tmp")
TMP_MAX_H = float(os.environ.get("TMP_MAX_HORAS", "3"))
THREADS = os.environ.get("FFMPEG_THREADS", "3")
H = {"x-render-token": TOKEN, "Content-Type": "application/json"}

def esc(t):
    return (t.replace("\\", "\\\\").replace(":", "\\:")
             .replace("'", "\u2019").replace("%", "\\%"))

def filtros(segs, estilo, w, h):
    fs = max(int(estilo["fontsize_min"]), int(w * estilo["fontsize_ratio"]))
    y = int(h * estilo["pos_y_ratio"])
    fontfile = estilo.get("fontfile", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    pad = int(fs * estilo["caixa_padding_ratio"])
    borda = max(3, int(fs * estilo["contorno_ratio"]))
    # Mede a fonte de verdade. Não estima por quantidade de caracteres.
    # A caixa completa nunca pode ocupar mais de 84% do quadro.
    fonte = ImageFont.truetype(fontfile, fs)
    largura_texto_max = max(1, int(w * 0.84) - 2 * pad - 2 * borda)

    def quebrar(texto):
        linhas, atual = [], ""
        for palavra in texto.replace("\n", " ").split():
            teste = f"{atual} {palavra}".strip()
            if atual and fonte.getlength(teste) > largura_texto_max:
                linhas.append(atual)
                atual = palavra
            else:
                atual = teste
        if atual:
            linhas.append(atual)
        # Segurança para uma palavra excepcionalmente longa.
        seguras = []
        for linha in linhas:
            while fonte.getlength(linha) > largura_texto_max and len(linha) > 1:
                corte = len(linha) - 1
                while corte > 1 and fonte.getlength(linha[:corte]) > largura_texto_max:
                    corte -= 1
                seguras.append(linha[:corte])
                linha = linha[corte:]
            if linha:
                seguras.append(linha)
        return seguras[:int(estilo["max_linhas"])]

    out = []
    for s in segs[:80]:
        linhas = quebrar(s["text"])
        for i, linha in enumerate(linhas):
            dy = y + (i - (len(linhas) - 1) / 2) * int(fs * 1.28)
            out.append(
                f"drawtext=fontfile={fontfile}"
                f":text='{esc(linha)}':fontsize={fs}:fontcolor=white"
                f":borderw={borda}:bordercolor=black"
                f":box=1:boxcolor={estilo['caixa_cor']}:boxborderw={pad}"
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

def limpar_orfaos():
    """Se o worker morreu no meio de um encode, os temporários ficam para trás."""
    limite = time.time() - TMP_MAX_H * 3600
    for p in glob.glob(os.path.join(TMP, "*")):
        try:
            if os.path.getmtime(p) < limite:
                shutil.rmtree(p, ignore_errors=True) if os.path.isdir(p) else os.remove(p)
                print("orfao removido:", p, flush=True)
        except Exception:
            pass

def processar(job):
    with tempfile.TemporaryDirectory(dir=TMP) as d:
        src, dst = f"{d}/in.mp4", f"{d}/out.mp4"
        with requests.get(job["video_download_url"], stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(src, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
        w, h = dimensoes(src)
        vf = filtros(job["segmentos"], job["estilo"], w, h)
        threads = str(job["estilo"].get("threads", THREADS))
        subprocess.run(["ffmpeg", "-y", "-i", src, "-vf", vf,
                        "-threads", threads,
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

os.makedirs(TMP, exist_ok=True)
print("render-worker iniciado", flush=True)
ultima_limpeza = 0.0
while True:
    try:
        if time.time() - ultima_limpeza > 3600:
            limpar_orfaos()
            ultima_limpeza = time.time()
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

Teste de conectividade (deve devolver `{"success":true,"job":null}`):

```bash
curl -s -X POST -H "x-render-token: $RENDER_TOKEN" \
  https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/video-render-claim -d '{}'
```

`401 token inválido` = o valor do `.env` não é o mesmo guardado na plataforma.
