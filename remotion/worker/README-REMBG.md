# Recorte de fundo na VPS (rembg) — custo zero por foto

O worker usa o rembg **em série** com o render: primeiro recorta a foto do produto,
depois chama o Remotion. Nunca em paralelo — o Chromium do Remotion já consome a CPU.

Se o recorte falhar, o vídeo continua saindo: o template cai no fallback
de fundo desfocado da própria foto.

## 1. Instalar (uma vez)

```bash
sudo apt-get update && sudo apt-get install -y python3-venv python3-pip
python3 -m venv /opt/rembg-env && /opt/rembg-env/bin/pip install --upgrade pip
/opt/rembg-env/bin/pip install "rembg[cli]" onnxruntime
```

Baixa o modelo na primeira execução (u2netp tem ~4,5 MB, fica em `~/.u2net`).

## 2. NÃO usar o modo serviço (`rembg s`)

O `rembg s` sobe uma UI Gradio que tenta abrir Chromium. Rodando como root sem
`--no-sandbox` o Chromium falha e derruba o servidor inteiro
(`Running as root without --no-sandbox is not supported` → `curl error 52`).

O worker chama o **binário** diretamente, uma foto por vez:

```bash
/opt/rembg-env/bin/rembg i -m u2netp /tmp/teste.jpg /tmp/saida.png
```

Teste manual (deve sair um PNG RGBA válido, exit code 0):

```bash
/opt/rembg-env/bin/rembg i -m u2netp /tmp/foto.jpg /tmp/recorte.png && file /tmp/recorte.png
```

## 3. Variáveis no `.env` do worker (`/opt/amz/remotion/.env`)

```
REMBG_BIN=/opt/rembg-env/bin/rembg
REMBG_MODELO=u2netp
REMBG_TIMEOUT_MS=90000
```

Depois: `pm2 restart amz-motion`.

## 4. Números esperados

- `u2netp` (padrão): ~15 s por foto na primeira execução (baixa o modelo), poucos
  segundos depois disso; leve em RAM.
- `isnet-general-use`: mais preciso, bem mais pesado (~170 MB de modelo e mais CPU).
  Só trocar se a qualidade do recorte não bastar.
- Um vídeo de produto inteiro (recorte + render) fica em 1 a 4 min.

## 5. Limites conhecidos

- Cabelo, vidro e produto sobre fundo branco estourado podem sair com borda.
  A sombra e o reflexo do template disfarçam a maioria dos casos.
- Fotos acima de 15 MB são ignoradas pelo recorte (fallback automático).
- PNG recortado acima de 8 MB também cai no fallback, para não inflar as props do render.
