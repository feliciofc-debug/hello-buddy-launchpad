# AMZ OCR local

OCR privado para documentos. O serviço não persiste arquivos, não registra o
texto extraído e só aceita chamadas autenticadas por `X-OCR-Token`.

- `POST /detectar`: portão rápido; devolve somente se é documento e o tipo.
- `POST /ocr`: leitura completa; devolve o texto para o parser local do CRLV.

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

O detector reduz a imagem para 1400 px, faz uma única leitura e nunca devolve o
texto. A leitura completa limita o maior lado a 2400 px e usa a orientação
detectada pelo Tesseract; os quatro giros só são testados quando essa orientação
falha.

O portão reconhece somente títulos oficiais de CRLV/CRLV-e, CNH, RG, ATPV-e e
procuração de veículo, ou uma combinação institucional forte com padrão válido.
Orçamentos, DANFE/NF-e, boletos, folhetos, anúncios e pedidos de identidade
visual não são classificados como documentos protegidos.
