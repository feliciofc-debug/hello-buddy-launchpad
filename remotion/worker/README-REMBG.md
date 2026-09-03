# Recorte de fundo na VPS (rembg) — custo zero por foto

O worker usa o rembg **em série** com o render: primeiro recorta a foto do produto,
depois chama o Remotion. Nunca em paralelo — o Chromium do Remotion já consome a CPU.

Se o serviço estiver fora do ar, o vídeo continua saindo: o template cai no fallback
de fundo desfocado da própria foto.

## 1. Instalar (uma vez)

```bash
sudo apt-get update && sudo apt-get install -y python3-venv python3-pip
python3 -m venv /opt/rembg && /opt/rembg/bin/pip install --upgrade pip
/opt/rembg/bin/pip install "rembg[cli]" onnxruntime
```

Baixa o modelo na primeira execução (~170 MB, fica em `~/.u2net`):

```bash
/opt/rembg/bin/rembg d isnet-general-use
```

## 2. Subir em MODO SERVIÇO (não recarrega o modelo a cada foto)

```bash
pm2 start /opt/rembg/bin/rembg --name rembg -- s --host 127.0.0.1 --port 7000
pm2 save
```

Só escuta em `127.0.0.1` — nenhuma porta nova exposta para a internet.

Teste:

```bash
curl -s -o /tmp/recorte.png -F "file=@/tmp/foto.jpg" \
  "http://127.0.0.1:7000/api/remove?m=isnet-general-use" && file /tmp/recorte.png
```

## 3. Variáveis no `.env` do worker (`/opt/amz/remotion/.env`)

```
REMBG_URL=http://127.0.0.1:7000
REMBG_MODELO=isnet-general-use
REMBG_TIMEOUT_MS=90000
```

Depois: `pm2 restart amz-motion`.

## 4. Números esperados

- 1,5 a 4 s por foto em CPU, 300–600 MB de RAM no processo do rembg.
- Um vídeo de produto inteiro (recorte + render) fica em 1 a 4 min.
- Alternativa mais leve/menos precisa: `REMBG_MODELO=u2netp`. Mais precisa: `isnet-general-use` (padrão).

## 5. Limites conhecidos

- Cabelo, vidro e produto sobre fundo branco estourado podem sair com borda.
  A sombra e o reflexo do template disfarçam a maioria dos casos.
- Fotos acima de 15 MB são ignoradas pelo recorte (fallback automático).
- PNG recortado acima de 8 MB também cai no fallback, para não inflar as props do render.
