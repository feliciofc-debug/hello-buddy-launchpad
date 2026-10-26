# Modelos Meta — Cotação OS

## Recomendado: convite (`os_cotacao_convite_v1`)

Ative por loja em **Gestão → Operações → Configurar → Ativar convite de cotação
no WhatsApp**. A plataforma cria e envia o template à Meta.

- Categoria: **UTILITY**
- Idioma: **pt_BR**
- Sem cabeçalho
- Corpo:

```
Olá, {{1}}! A {{2}} tem um pedido de cotação de serviço para o veículo {{3}}. Podemos enviar os detalhes e as fotos por aqui?
```

Exemplos: `Funilaria do Zé`, `Loja AMZ Auto`, `MINI Cooper 2021`.

Botões QUICK_REPLY:

- `Sim, pode enviar`
- `Não tenho agenda`

Depois do **Sim**, já dentro da janela de atendimento, a plataforma envia o PDF,
as instruções e os botões do orçamento. Variável opcional:
`OS_COTACAO_CONVITE_TEMPLATE_NOME` (padrão `os_cotacao_convite_v1`).

## Alternativa antiga: pedido com documento (`os_cotacao_pedido_v1`)

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

Este modelo com documento fica documentado como alternativa legada. O fluxo
automático fora da janela usa o **convite** acima e só envia o PDF depois do
aceite. Sem convite aprovado, a cotação fica `pendente_modelo` com orientação
para ativá-lo em Operações → Configurar.

## Variável de ambiente

- `OS_COTACAO_TEMPLATE_NOME` — default `os_cotacao_pedido_v1`
