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

## Vitrine WhatsApp (cliente final — estoque)

Fluxo tipo Magalu para quem **pergunta explicitamente** por carros no WhatsApp.
Dados **somente** de `veiculos_estoque`; nunca `produtos`.

### Quem pode usar a vitrine

| Modo | Condição |
| --- | --- |
| Revenda (produção) | `empresa_config.segmento` = revenda de automóveis (ou equivalente já usado no front) |
| Demonstração | `empresa_config.vitrine_veiculos_demo = true` em **uma conta específica** (ativada por SQL; sem tela no painel) |

Migration idempotente (no LOTE da vitrine):  
`ALTER TABLE public.empresa_config ADD COLUMN IF NOT EXISTS vitrine_veiculos_demo BOOLEAN NOT NULL DEFAULT false;`

Ativação manual (exemplo):

```sql
UPDATE public.empresa_config
SET vitrine_veiculos_demo = true
WHERE user_id = '<uuid-do-tenant>';
```

### Chave de demonstração (comportamento)

Com `vitrine_veiculos_demo = true`:

1. **Só** mensagens com **intenção explícita de ver estoque** entram na vitrine
   (lista de marcas → carrossel por marca). Exemplos de gatilho (normalizar acento/caixa):
   - “ver carros”, “quero ver os carros”, “estoque de veículos”, “carros disponíveis”,
     “o que tem na loja”, “mostrar veículos”.
2. **Qualquer outra mensagem** (FIPE, anúncio, foto, produto, saudação, dúvida geral)
   segue o **fluxo atual do Jarvis**, sem roteamento para vitrine, sem mudar prompts
   ou tools existentes.

Com `vitrine_veiculos_demo = false` (default): contas fora do segmento revenda
**nunca** entram na vitrine.

Implementação sugerida: função pura `isExplicitVehicleShowcaseRequest(text)` +
`shouldOfferVehicleShowcase(tenant)` → `(segmento revenda OR vitrine_veiculos_demo)`.
Checar **antes** de desviar o processor; se falso, `return` cedo e não alterar estado.

### Fluxo da vitrine (sem etapa de modelos)

1. Lista de **marcas** (só marcas com veículos `disponivel` no tenant).
2. Cliente escolhe a marca → enviar **todos** os carros da marca em **carrossel
   interativo** Cloud API (`interactive` carousel): card = foto principal + texto
   (marca/modelo/versão, ano, km, câmbio, cor, preço) + 2 quick_reply:
   `[📋 Ver detalhes]` · `[💬 Tenho interesse]`.
3. Se houver mais carros que o limite de cards por mensagem, blocos + botão
   **Ver mais carros**.
4. **Ver detalhes** → galeria de fotos + lista “Detalhes do veículo”; rótulo
   **Voltar às marcas** (não “Voltar aos modelos”).
5. **Tenho interesse** → handoff/consultor (fluxo de lead já existente).

Limites e fallback: validar na [documentação oficial Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-media-carousel-messages)
(2–10 cards, corpo da mensagem até 1024 chars, corpo do card até 160 chars,
janela de 24h para mensagens de sessão). Confirmar em sandbox se o carrossel de
sessão aceita 2× `quick_reply` por card; se não, fallback = card individual com
imagem + 3 botões: Fotos / Detalhes / Tenho interesse.

### Áreas travadas

FIPE, anúncio/captions, edição de imagem, vídeo e Autopilot de produtos permanecem
como hoje; a vitrine não substitui esses fluxos.
