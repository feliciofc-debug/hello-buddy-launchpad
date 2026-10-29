# AMZ OCR local

OCR privado para documentos. O serviço não persiste arquivos, não registra o
texto extraído e só aceita chamadas autenticadas por `X-OCR-Token`.

- `POST /detectar`: portão rápido; devolve somente se é documento e o tipo.
  Inclui `vehicle_detected` e `vehicle_area_ratio` (detector PicoDet-S, ver abaixo).

## Detector de veículo (CPU)

| Campo | Valor |
| --- | --- |
| Modelo | **PicoDet-S 320×320 COCO** (`picodet_s_320_lcnet_postprocessed.onnx`) |
| Origem | [PaddleDetection](https://github.com/PaddlePaddle/PaddleDetection) — release oficial BOS |
| Licença | **Apache-2.0** (mesma família Paddle/PaddleOCR já usada no OCR) |
| Runtime | `onnxruntime` CPU; modelo baixado no **build** da imagem (sem rede em runtime) |
| Regra | Veículo COCO (car/bus/truck/motorcycle) ≥ **15%** da imagem → não pergunta “possível documento”, salvo evidência **forte** de texto de documento na passada rápida (≤ 3 s) |
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

Para fotos, a leitura completa usa PaddleOCR 3.7 em CPU com o detector
`PP-OCRv6_small_det` e o reconhecedor
`latin_PP-OCRv5_mobile_rec`. Tesseract fica como reserva somente quando o
Paddle não devolve texto. Os pesos são baixados durante o `docker build` e
verificados novamente sem rede como usuário não privilegiado; a imagem enviada
nunca sai do servidor.

A leitura completa:

1. aplica a orientação EXIF recebida no arquivo;
2. limita fotos grandes a 1600 px;
3. procura o maior quadrilátero e corrige a perspectiva;
4. testa cor original, CLAHE e remoção do fundo colorido;
5. remove caracteres CJK residuais da saída;
6. escolhe a variante que contém mais campos validados pelo parser — placa,
   chassi e RENAVAM com dígito verificador.

Os módulos Paddle de orientação do documento, unwarping e orientação de linhas
ficam desligados: no CRLV antigo eles não melhoraram a leitura e chegaram a
inverter páginas. Uma variante sem binarização agressiva é sempre mantida. O
teto da requisição é 40 segundos. Bytes, imagens intermediárias e texto ficam em memória; o
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
