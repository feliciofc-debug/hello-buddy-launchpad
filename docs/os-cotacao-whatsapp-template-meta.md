# Modelo Meta — Pedido de cotação OS (`os_cotacao_pedido_v1`)

Cadastre na Meta Business Manager como template **UTILITY**, nome interno sugerido: `os_cotacao_pedido_v1` (ou defina `OS_COTACAO_TEMPLATE_NOME` no ambiente).

## Cabeçalho

- Tipo: **Documento** (PDF do pedido de cotação anexado no envio)

## Corpo (4 variáveis, sem quebra de linha dentro de cada variável)

1. `{{1}}` — Nome da loja (até 60 caracteres)
2. `{{2}}` — Número da OS (ex.: `OS 15`)
3. `{{3}}` — Veículo resumido (marca/modelo, até 60 caracteres)
4. `{{4}}` — Nome do parceiro (até 40 caracteres)

### Texto sugerido do corpo

```
Olá! {{4}}, a {{1}} enviou um pedido de cotação ({{2}}) para o veículo {{3}}. Abra o PDF em anexo e responda com valor e prazo pelo WhatsApp (botão Enviar orçamento, texto, PDF/foto ou áudio).
```

## Botões (quick reply — opcional na Meta)

Se a política do template permitir, inclua:

- `Enviar orçamento`
- `Não tenho agenda`

> Dentro da janela de 24h a plataforma envia botões interativos nativos; fora da janela depende do template aprovado.

## Comportamento fora da janela 24h

- Com template **aprovado**: envio UTILITY + documento.
- **Sem** template aprovado: a cotação fica com `envio_whatsapp_status = pendente_modelo` e motivo `envio pendente: modelo não aprovado`; o PDF fica salvo em `gestao_os_documento` para envio manual.

## Variável de ambiente

- `OS_COTACAO_TEMPLATE_NOME` — default `os_cotacao_pedido_v1`
