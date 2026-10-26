# AMZ OCR local

OCR privado para documentos. O serviço não persiste arquivos, não registra o texto
extraído e só aceita chamadas autenticadas por `X-OCR-Token`.

## Build

```bash
docker build -t amz-ocr:doc-1 services/amz-ocr
```

## Execução

```bash
docker run --rm \
  --name amz-ocr \
  --network host \
  -e AMZ_OCR_TOKEN='troque-por-um-segredo-forte' \
  amz-ocr:doc-1
```

O Uvicorn escuta somente em `127.0.0.1:3011`. Configure as Edge Functions com:

```text
AMZ_OCR_URL=http://127.0.0.1:3011/ocr
AMZ_OCR_TOKEN=<mesmo segredo>
DOC_COFRE_KEY=<32 bytes em base64>
```

Exemplo de chamada local:

```bash
curl --fail --max-time 30 \
  -H "X-OCR-Token: $AMZ_OCR_TOKEN" \
  -H "Content-Type: image/jpeg" \
  --data-binary @imagem-sintetica.jpg \
  http://127.0.0.1:3011/ocr
```

Formatos: PDF, JPEG, PNG, WebP, HEIC e HEIF; limite de 15 MB.
