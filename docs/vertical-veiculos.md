# Vertical de veículos

Este documento é a referência obrigatória para qualquer mudança relacionada a
veículos. Automóveis não são produtos do catálogo geral.

## Limites da arquitetura

- A conta usa `profiles.tipo = empresa`, como os demais tenants empresariais.
- `empresa_config.segmento` define o tom e troca somente o menu `produtos` por
  `veiculos` quando o negócio é uma revenda de automóveis.
- O tipo legado `revenda_veiculos` continua aceito apenas por compatibilidade e
  recebe o mesmo menu de veículos.
- `public.veiculos_estoque` é o único estoque de veículos.
- A tabela `public.produtos` nunca recebe automóveis.
- O especialista de veículos do Jarvis, em
  `supabase/functions/_shared/vertical-vehicle`, lê somente
  `veiculos_estoque` e nunca lê produtos.
- O especialista geral lê somente produtos e nunca lê `veiculos_estoque`.
- A memória e os estados de conversa das duas verticais permanecem separados.
- FIPE, anúncio, carrossel, identificação por foto e repasse continuam na
  vertical de veículos existente.

## Convenção de nomes

- Banco, rotas e telas em português começam com `veiculos_`.
- Módulos de código em inglês começam com `vehicle-`.
- Não criar nomes genéricos que possam misturar veículos e produtos.

## Tipo, menu e segmento

| Conceito | Responsabilidade |
| --- | --- |
| `profiles.tipo = empresa` | Identifica a conta como tenant empresarial |
| `client_menu_config` | Define os menus-base da plataforma |
| `empresa_config.segmento` | Define voz e troca Produtos por Veículos para revendas |
| `profiles.tipo = revenda_veiculos` | Compatibilidade com contas legadas |
| `veiculos_estoque` | Guarda a ficha e as fotos dos veículos do tenant |

## Build de produção do front

Versão validada: Node.js `22.14.0` e npm `10.9.7`.

Na raiz do projeto:

```bash
npm ci
npm run build
install -d /opt/amz-front/dist
rsync -a --delete dist/ /opt/amz-front/dist/
```

O Supabase e o armazenamento são configurados em `public/config.json` em tempo
de execução. As variáveis `VITE_*` lidas pelo front são opcionais e têm estes
nomes (nunca registrar seus valores neste documento):

- `VITE_TIKTOK_ENV`
- `VITE_WUZAPI_URL`
- `VITE_WUZAPI_TOKEN`
- `VITE_WUZAPI_INSTANCE_ID`
