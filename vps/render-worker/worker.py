import os, time, json, glob, shutil, subprocess, tempfile, textwrap, requests

API = os.environ["API_BASE"].rstrip("/")
TOKEN = os.environ["RENDER_TOKEN"]
POLL = int(os.environ.get("POLL_SECONDS", "30"))
TMP = os.environ.get("TMP_DIR", "/var/lib/render-worker/tmp")
TMP_MAX_H = float(os.environ.get("TMP_MAX_HORAS", "3"))
THREADS = os.environ.get("FFMPEG_THREADS", "3")
H = {"x-render-token": TOKEN, "Content-Type": "application/json"}

def esc(t):
    return (t.replace("\\", "\\\\").replace(":", "\\:")
             .replace("'", "\u2019").replace("%", "\\\\%"))

def filtros(segs, estilo, w, h):
    fs = max(int(estilo["fontsize_min"]), int(w * estilo["fontsize_ratio"]))
    y = int(h * estilo["pos_y_ratio"])
    fontfile = estilo.get("fontfile", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    out = []
    for s in segs[:80]:
        linhas = textwrap.wrap(s["text"].replace("\n", " "),
                               width=estilo["max_chars_linha"])[:estilo["max_linhas"]]
        for i, linha in enumerate(linhas):
            dy = y + (i - (len(linhas) - 1) / 2) * int(fs * 1.28)
            out.append(
                f"drawtext=fontfile={fontfile}"
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

def alvo_meta(formato):
    return (1080, 1920) if str(formato or "").lower() in ("story", "reels") else (1080, 1350)

def filtro_meta(vf, target_w, target_h):
    base = (
        f"scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
        f"crop={target_w}:{target_h},setsar=1"
    )
    return f"{base},{vf}" if vf else base

def metadados_saida(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,width,height:format=duration,size",
         "-of", "json", path],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(r.stdout)
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    fmt = data.get("format", {})
    return {
        "width": int(video.get("width") or 0),
        "height": int(video.get("height") or 0),
        "video_codec": video.get("codec_name"),
        "audio_codec": audio.get("codec_name") if audio else None,
        "has_audio": audio is not None,
        "duration_seconds": float(fmt.get("duration") or 0),
        "size_bytes": int(fmt.get("size") or os.path.getsize(path)),
    }

def comando_ffmpeg(src, dst, vf, threads, w, h, logo_path=None, logo=None):
    # Sem logo: comando identico ao anterior. Com logo: mesma passada da legenda.
    cmd = ["ffmpeg", "-y", "-i", src]
    if logo_path and logo:
        # Logo no canto superior ESQUERDO: ate 38% da largura e 14% da altura.
        lw = max(2, int(w * 0.38)); lh = max(2, int(h * 0.14))
        mx = int(w * 0.05); my = int(h * 0.04)
        grafo = (f"[0:v]{vf}[leg];"
                 f"[1:v]scale=w={lw}:h={lh}:force_original_aspect_ratio=decrease[logo];"
                 f"[leg][logo]overlay={mx}:{my}:format=auto[outv]")
        cmd += ["-i", logo_path, "-filter_complex", grafo, "-map", "[outv]", "-map", "0:a?"]
    else:
        cmd += ["-vf", vf]
    return cmd + ["-threads", threads,
                  "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                  "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                  "-movflags", "+faststart", dst]

def baixar_logo_url(url, path):
    if not url:
        return None
    try:
        with requests.get(url, stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(path, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
        return path
    except Exception as e:
        print("aviso: logo nao baixada; video segue sem logo:", e, flush=True)
        return None

def baixar_logo(logo, d, src=None):
    if not logo:
        return None
    url = logo.get("download_url")
    return baixar_logo_url(url, f"{d}/logo")

def limpar_orfaos():
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
        target_w, target_h = alvo_meta(job.get("formato"))
        vf = filtro_meta(
            filtros(job["segmentos"], job["estilo"], target_w, target_h),
            target_w,
            target_h,
        )
        threads = str(job["estilo"].get("threads", THREADS))
        logo = job.get("logo")
        logo_path = baixar_logo(logo, d, src)
        if logo and not logo_path:
            raise RuntimeError("logo de vídeo não pôde ser baixada")
        subprocess.run(
            comando_ffmpeg(
                src, dst, vf, threads, target_w, target_h, logo_path, logo
            ),
            check=True, capture_output=True, text=True, timeout=1800,
        )
        up = job["upload"]
        with open(dst, "rb") as f:
            r = requests.put(up["url"], data=f,
                             headers={"Content-Type": up["content_type"]}, timeout=1800)
            r.raise_for_status()
        return up["bucket"], up["path"], metadados_saida(dst)

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
            bucket, path, output = processar(job)
            body = {"job_id": job["id"], "success": True, "resultado_bucket": bucket,
                    "resultado_path": path,
                    "duracao_segundos": output["duration_seconds"],
                    "video_output": output}
        except subprocess.CalledProcessError as e:
            body = {"job_id": job["id"], "success": False,
                    "erro": (e.stderr or "")[-500:] or "ffmpeg falhou"}
        except Exception as e:
            body = {"job_id": job["id"], "success": False, "erro": str(e)[:500]}
        requests.post(f"{API}/video-render-complete", headers=H, json=body, timeout=120)
    except Exception as e:
        print("loop erro:", e, flush=True)
        time.sleep(POLL)
