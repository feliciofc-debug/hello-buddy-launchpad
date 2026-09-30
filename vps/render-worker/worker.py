import glob
import json
import os
import shutil
import subprocess
import tempfile
import time


API = os.environ.get("API_BASE", "").rstrip("/")
TOKEN = os.environ.get("RENDER_TOKEN", "")
POLL = int(os.environ.get("POLL_SECONDS", "30"))
TMP = os.environ.get("TMP_DIR", "/var/lib/render-worker/tmp")
TMP_MAX_H = float(os.environ.get("TMP_MAX_HORAS", "3"))
THREADS = os.environ.get("FFMPEG_THREADS", "3")
H = {"x-render-token": TOKEN, "Content-Type": "application/json"}


def esc(texto):
    return (texto.replace("\\", "\\\\").replace(":", "\\:")
            .replace("'", "\u2019").replace("%", "\\%"))


def filtros(segs, estilo, width, height):
    from PIL import ImageFont

    font_size = max(int(estilo["fontsize_min"]), int(width * estilo["fontsize_ratio"]))
    y = int(height * estilo["pos_y_ratio"])
    fontfile = estilo.get(
        "fontfile",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    )
    padding = min(15, int(font_size * estilo["caixa_padding_ratio"]))
    border = max(3, int(font_size * estilo["contorno_ratio"]))
    font = ImageFont.truetype(fontfile, font_size)
    max_text_width = max(1, int(width * 0.84) - 2 * padding - 2 * border)

    def wrap(text):
        lines, current = [], ""
        for word in text.replace("\n", " ").split():
            candidate = f"{current} {word}".strip()
            if current and font.getlength(candidate) > max_text_width:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        safe = []
        for line in lines:
            while font.getlength(line) > max_text_width and len(line) > 1:
                cut = len(line) - 1
                while cut > 1 and font.getlength(line[:cut]) > max_text_width:
                    cut -= 1
                safe.append(line[:cut])
                line = line[cut:]
            if line:
                safe.append(line)
        return safe[:int(estilo["max_linhas"])]

    output = []
    for segment in segs[:80]:
        lines = wrap(segment["text"])
        for index, line in enumerate(lines):
            dy = y + (index - (len(lines) - 1) / 2) * int(font_size * 1.28)
            output.append(
                f"drawtext=fontfile={fontfile}"
                f":text='{esc(line)}':fontsize={font_size}:fontcolor=white"
                f":borderw={border}:bordercolor=black"
                f":box=1:boxcolor={estilo['caixa_cor']}:boxborderw={padding}"
                f":x=(w-text_w)/2:y={int(dy)}"
                f":enable='between(t,{segment['start']:.2f},{segment['end']:.2f})'"
            )
    return ",".join(output)


def build_ffmpeg_command(src, dst, caption_filter, threads, width, height,
                         logo_path=None, logo=None):
    base = ["ffmpeg", "-y", "-i", src]
    if logo_path and logo:
        logo_width = max(1, int(width * float(logo.get("largura_ratio", 0.22))))
        margin = max(0, int(height * float(logo.get("margem_ratio", 0.04))))
        graph = (
            f"[0:v]{caption_filter}[captioned];"
            f"[1:v]scale={logo_width}:-1[brand_logo];"
            f"[captioned][brand_logo]overlay=(main_w-overlay_w)/2:{margin}:format=auto[outv]"
        )
        base += [
            "-i", logo_path,
            "-filter_complex", graph,
            "-map", "[outv]",
            "-map", "0:a?",
        ]
    else:
        base += ["-vf", caption_filter]
    return base + [
        "-threads", str(threads),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", dst,
    ]


def dimensoes(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "json", path],
        capture_output=True, text=True, check=True,
    )
    stream = json.loads(result.stdout)["streams"][0]
    return int(stream["width"]), int(stream["height"])


def download(url, path):
    import requests

    with requests.get(url, stream=True, timeout=600) as response:
        response.raise_for_status()
        with open(path, "wb") as output:
            for chunk in response.iter_content(1 << 20):
                output.write(chunk)


def limpar_orfaos():
    limite = time.time() - TMP_MAX_H * 3600
    for path in glob.glob(os.path.join(TMP, "*")):
        try:
            if os.path.getmtime(path) < limite:
                shutil.rmtree(path, ignore_errors=True) if os.path.isdir(path) else os.remove(path)
                print("orfao removido:", path, flush=True)
        except Exception:
            pass


def processar(job):
    import requests

    with tempfile.TemporaryDirectory(dir=TMP) as directory:
        src, dst = f"{directory}/in.mp4", f"{directory}/out.mp4"
        download(job["video_download_url"], src)
        width, height = dimensoes(src)
        caption_filter = filtros(job["segmentos"], job["estilo"], width, height)
        threads = str(job["estilo"].get("threads", THREADS))

        logo_path = None
        logo = job.get("logo")
        if logo:
            try:
                logo_path = f"{directory}/logo"
                download(logo["download_url"], logo_path)
            except Exception as error:
                logo_path = None
                print(f"aviso: logo não pôde ser baixada; render sem logo: {error}", flush=True)

        command = build_ffmpeg_command(
            src, dst, caption_filter, threads, width, height, logo_path, logo,
        )
        try:
            subprocess.run(
                command, check=True, capture_output=True, text=True, timeout=1800,
            )
        except subprocess.CalledProcessError as error:
            if not logo_path:
                raise
            print(
                "aviso: overlay da logo falhou; tentando render sem logo: "
                + (error.stderr or "")[-300:],
                flush=True,
            )
            if os.path.exists(dst):
                os.remove(dst)
            subprocess.run(
                build_ffmpeg_command(
                    src, dst, caption_filter, threads, width, height,
                ),
                check=True, capture_output=True, text=True, timeout=1800,
            )

        upload = job["upload"]
        with open(dst, "rb") as output:
            response = requests.put(
                upload["url"], data=output,
                headers={"Content-Type": upload["content_type"]}, timeout=1800,
            )
            response.raise_for_status()
        duration = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", dst],
            capture_output=True, text=True,
        ).stdout.strip()
        return upload["bucket"], upload["path"], float(duration or 0)


def main():
    import requests

    if not API or not TOKEN:
        raise RuntimeError("API_BASE e RENDER_TOKEN são obrigatórios")
    os.makedirs(TMP, exist_ok=True)
    print("render-worker iniciado", flush=True)
    ultima_limpeza = 0.0
    while True:
        try:
            if time.time() - ultima_limpeza > 3600:
                limpar_orfaos()
                ultima_limpeza = time.time()
            response = requests.post(
                f"{API}/video-render-claim", headers=H, json={}, timeout=60,
            )
            job = (response.json() or {}).get("job")
            if not job:
                time.sleep(POLL)
                continue
            print("job", job["id"], flush=True)
            try:
                bucket, path, duration = processar(job)
                body = {
                    "job_id": job["id"], "success": True,
                    "resultado_bucket": bucket, "resultado_path": path,
                    "duracao_segundos": duration,
                }
            except subprocess.CalledProcessError as error:
                body = {
                    "job_id": job["id"], "success": False,
                    "erro": (error.stderr or "")[-500:] or "ffmpeg falhou",
                }
            except Exception as error:
                body = {
                    "job_id": job["id"], "success": False,
                    "erro": str(error)[:500],
                }
            requests.post(
                f"{API}/video-render-complete", headers=H, json=body, timeout=120,
            )
        except Exception as error:
            print("loop erro:", error, flush=True)
            time.sleep(POLL)


if __name__ == "__main__":
    main()
