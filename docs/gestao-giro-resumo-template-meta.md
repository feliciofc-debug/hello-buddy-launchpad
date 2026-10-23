# Template WhatsApp — resumo diário Giro (G90-2.1)

Cadastre **por número / WABA da loja** na Meta Business Manager. Categoria recomendada: **UTILITY**.

## Nome do template

`gestao_giro_resumo_v1` (ou o valor de `GESTAO_GIRO_RESUMO_TEMPLATE_NOME` no ambiente).

## Corpo (texto fixo + 5 variáveis)

Use exatamente este texto no corpo da mensagem (placeholders `{{1}}` … `{{5}}`):

```
📊 Resumo do estoque de {{1}}: {{2}} carros, {{3}} exigem atenção. O estoque parado custou R$ {{4}} hoje e o risco projetado em 30 dias é de R$ {{5}}. Veja os detalhes no painel da Gestão.
```

## Regras das variáveis (Meta)

- **Uma linha cada** — o sistema envia valores **sem** `\n`, `\t` nem sequências de 4+ espaços.
- **{{1}}** — data do resumo (ex.: `23/10/26`)
- **{{2}}** — total de carros no estoque
- **{{3}}** — quantidade em atenção + risco + decisão
- **{{4}}** — custo financeiro do dia (formato pt-BR, ex.: `1.240,50` ou `—`)
- **{{5}}** — risco projetado 30 dias (mesmo formato)

Não use um único placeholder com o resumo completo (com quebras de linha); a Meta costuma reprovar.

## Aprovação no app

Após a Meta aprovar, registre o template na tabela `whatsapp_templates` da loja com `status_meta = aprovado` e `nome_meta` igual ao cadastro.
