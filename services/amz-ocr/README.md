# AMZ OCR local

OCR privado para documentos. O serviço não persiste arquivos, não registra o
texto extraído e só aceita chamadas autenticadas por `X-OCR-Token`.

- `POST /detectar`: portão rápido; devolve somente se é documento e o tipo.
- `POST /ocr`: leitura completa; devolve o texto e métricas sem conteúdo para
  o parser local do CRLV.

## Build

```bash
docker build -t amz-ocr:doc-1 services/amz-ocr
```

## Execução

```bash
docker run --rm \
  --name amz-ocr \
  --network host \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
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

O detector reduz a imagem para 1400 px, faz uma única leitura Tesseract e nunca
devolve o texto. Ele continua separado da leitura completa para não atrasar
fotos comuns no WhatsApp.

Para fotos, a leitura completa usa PaddleOCR 3.7 em CPU com o modelo latino
como motor principal. Tesseract fica como reserva quando o Paddle não inicia
ou não encontra placa, chassi nem RENAVAM válidos. Os pesos do modelo são
baixados durante o `docker build`; a imagem enviada nunca sai do servidor.

A leitura completa:

1. limita fotos grandes a 2400 px;
2. corrige a orientação;
3. procura o maior quadrilátero e corrige a perspectiva;
4. amplia 2× entradas cujo maior lado tenha menos de 2000 px;
5. testa cor original, CLAHE, remoção do fundo colorido e limiar adaptativo;
6. escolhe a variante que contém mais campos validados pelo parser — placa,
   chassi e RENAVAM com dígito verificador.

Uma variante sem binarização agressiva é sempre mantida. O teto da requisição
é 25 segundos. Bytes, imagens intermediárias e texto ficam em memória; o
diretório temporário aponta para `tmpfs` e o serviço não possui logs de acesso.

Exemplo de resposta (sem dados do documento nas métricas):

```json
{
  "text": "...",
  "metrics": {
    "motor": "paddleocr",
    "variante_vencedora": "perspectiva_sem_fundo",
    "tempo_ms": 4380,
    "n_campos_validos": 3
  }
}
```

Para rodar os testes sintéticos reais dentro da imagem:

```bash
docker run --rm \
  -e AMZ_OCR_REAL_TESTS=1 \
  --entrypoint python \
  amz-ocr:doc-1 -m unittest -v test_detector test_ocr_engine
```

O portão reconhece somente títulos oficiais de CRLV/CRLV-e, CNH, RG, ATPV-e e
procuração de veículo, ou uma combinação institucional forte com padrão válido.
Orçamentos, DANFE/NF-e, boletos, folhetos, anúncios e pedidos de identidade
visual não são classificados como documentos protegidos.

O botão **Completar pela Molicar** da tela de conferência depende da implantação
da Edge Function `molicar-consulta` do MOLICAR-1. Sem uma conta Molicar ativa
para a loja, a leitura local e a digitação manual continuam funcionando.
