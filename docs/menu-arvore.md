# Árvore do menu do Jarvis

> Gerado de `jarvis-ajuda-catalogo.ts`. Não editar manualmente.
> Os dois atalhos recentes são slots do B7 e contam no limite de 10 linhas.

## Abertura

1. **📣 Marketing** — Criação, publicação, campanhas e portais de veículos.
2. **📊 Gestão** — Estoque, vendas, financeiro, documentos e clientes.
3. **🔍 Vistoria e Troca** — Avaliação, laudos, procedência e liberação para estoque.

## Marketing

ID da lista: `marketing`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Usado recentemente 1 | Última ação de Marketing usada neste WhatsApp. | Dinâmico (B7) | herdada |
| 2 | Usado recentemente 2 | Segunda ação recente de Marketing. | Dinâmico (B7) | herdada |
| 3 | Postar nas redes › | Facebook, Instagram, TikTok e LinkedIn. | Lista `marketing:postar_redes` | owner |
| 4 | Criar arte de anúncio | Monte uma arte com foto, dados e identidade da loja. | WhatsApp · mídia `generate` | owner |
| 5 | Criar carrossel | Gere cards e aprove antes de publicar no Instagram. | WhatsApp · tool `criar_carrossel` | owner |
| 6 | Criar vídeo | Crie um vídeo animado com roteiro aprovado. | WhatsApp · tool `criar_video_animado` | owner |
| 7 | Campanha Meta Ads | Monte, revise e confirme uma campanha patrocinada. | WhatsApp · handler `processMetaAdsQuestionario` | owner |
| 8 | Resultado campanhas | Veja gasto, alcance e situação dos anúncios Meta. | WhatsApp · tool `relatorio_anuncios_meta` | owner |
| 9 | Portais de veículos › | Mercado Livre, OLX e Webmotors pelo painel. | Lista `marketing:portais` | owner |
| 10 | Ajuda de Marketing | Veja exemplos de pedidos e limites de cada serviço. | WhatsApp · handler `formatarMenuJarvisAjuda` | owner |

### Postar nas redes

ID da lista: `marketing:postar_redes`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Usado recentemente 1 | Atalho recente desta lista. | Dinâmico (B7) | herdada |
| 2 | Usado recentemente 2 | Segundo atalho recente desta lista. | Dinâmico (B7) | herdada |
| 3 | Facebook | Publique foto ou vídeo no feed ou story. | WhatsApp · mídia `post` | owner |
| 4 | Instagram feed | Publique foto, vídeo ou carrossel no feed. | WhatsApp · mídia `post` | owner |
| 5 | Instagram story | Publique foto ou vídeo vertical no story. | WhatsApp · mídia `post` | owner |
| 6 | TikTok | Publique vídeo após privacidade e consentimento. | WhatsApp · mídia `post` | owner |
| 7 | LinkedIn | Prepare texto, foto ou vídeo em tom profissional. | WhatsApp · tool `publicar_linkedin` | owner |
| 8 | Agendar publicação | Agende um criativo aprovado; story fica no painel. | WhatsApp · tool `agendar_post_pendente` | owner |
| 9 | Meus agendamentos | Liste, remarque ou cancele posts futuros. | WhatsApp · tool `listar_agendamentos_posts` | owner |
| 10 | Voltar a Marketing | Retorne à lista principal de Marketing. | Lista anterior | herdada |

### Portais de veículos

ID da lista: `marketing:portais`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Usado recentemente 1 | Atalho recente desta lista. | Dinâmico (B7) | herdada |
| 2 | Usado recentemente 2 | Segundo atalho recente desta lista. | Dinâmico (B7) | herdada |
| 3 | Mercado Livre | Abra a publicação e sincronização no painel. | [link](/veiculos) + Estoque › Veículo › Mercado Livre | owner |
| 4 | OLX | Abra a publicação e sincronização no painel. | [link](/veiculos) + Estoque › Veículo › OLX | owner |
| 5 | Webmotors | Abra a publicação, estoque e histórico no painel. | [link](/veiculos) + Estoque › Veículo › Webmotors | owner |
| 6 | Voltar a Marketing | Retorne à lista principal de Marketing. | Lista anterior | herdada |

## Gestão

ID da lista: `gestao`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Usado recentemente 1 | Última ação de Gestão usada neste WhatsApp. | Dinâmico (B7) | herdada |
| 2 | Usado recentemente 2 | Segunda ação recente de Gestão. | Dinâmico (B7) | herdada |
| 3 | ⚡ Urgentes do dia | Veja só o que pede decisão hoje. Some quando estiver vazio. | WhatsApp · handler `buildGestaoFechamentoDia` | owner, manager |
| 4 | Estoque › | Consulte carros, giro, custos, lucro e despesas. | Lista `gestao:estoque` | owner, manager, seller |
| 5 | Vendas › | Registre e analise compras, vendas e equipe. | Lista `gestao:vendas` | owner, manager |
| 6 | Financeiro › | Veja DRE, contas, recebíveis e conciliação. | Lista `gestao:financeiro` | owner, manager |
| 7 | Oficina e cotações › | Acompanhe OS e cotações no painel. | Lista `gestao:oficina_cotacoes` | owner, manager |
| 8 | Documentos › | Guarde CRLV no WhatsApp e organize no painel. | Lista `gestao:documentos` | owner, manager |
| 9 | Clientes e leads › | Consulte números, contatos e abra o CRM. | Lista `gestao:clientes_leads` | owner, manager, seller |
| 10 | Ajuda de Gestão | Veja exemplos de comandos de gestão. | WhatsApp · handler `formatarMenuJarvisAjuda` | owner, manager |

### Estoque

ID da lista: `gestao:estoque`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Resumo do estoque | Quantidade, valor investido e situação dos carros. | WhatsApp · tool `consultar_estoque` | owner, manager, seller |
| 2 | Buscar veículo | Procure por modelo, placa ou situação. | WhatsApp · tool `consultar_estoque` | owner, manager, seller |
| 3 | Vendidos no mês | Veja quantos veículos foram vendidos no período. | WhatsApp · handler `tryProcessOwnerVehicleStockInbound` | owner, manager, seller |
| 4 | Lucro do veículo | Consulte lucro e margem de um carro. | WhatsApp · intent `lucro_veiculo` | owner, manager, seller |
| 5 | Despesas do veículo | Liste os gastos lançados em um carro. | WhatsApp · intent `despesas_veiculo` | owner, manager, seller |
| 6 | Giro do estoque | Veja carros parados e custo de esperar. | [link](/gestao/lucro?aba=giro) + Gestão › Giro 30-60-90 | owner, manager, seller |
| 7 | Abrir estoque | Gerencie cadastros, preços e status no painel. | [link](/veiculos) + Estoque › Veículos | owner, manager, seller |
| 8 | Voltar a Gestão | Retorne à lista principal de Gestão. | Lista anterior | herdada |

### Vendas

ID da lista: `gestao:vendas`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Registrar compra | Prepare a compra e confirme antes de salvar. | WhatsApp · intent `compra` | owner, manager |
| 2 | Registrar venda | Prepare a venda e confirme antes de salvar. | WhatsApp · intent `venda` | owner, manager |
| 3 | Lançar despesa | Classifique o gasto e confirme antes de salvar. | WhatsApp · intent `despesa` | owner, manager |
| 4 | Desfazer lançamento | Desfaça o último lançamento elegível em até 24h. | WhatsApp · intent `desfazer` | owner, manager |
| 5 | Analisar uma venda | Veja o raio-X financeiro de uma venda. | WhatsApp · intent `venda_raiox` | owner, manager |
| 6 | Piores negócios | Veja os piores resultados do mês. | WhatsApp · intent `piores_negocios_mes` | owner, manager |
| 7 | Equipe e comissões | Consulte ranking, metas, vendas e comissões. | WhatsApp · handler `formatarMenuJarvisAjuda` | owner, manager |
| 8 | Voltar a Gestão | Retorne à lista principal de Gestão. | Lista anterior | herdada |

### Financeiro

ID da lista: `gestao:financeiro`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | DRE do mês | Receba o demonstrativo do resultado no WhatsApp. | WhatsApp · intent `dre_whatsapp` | owner, manager |
| 2 | Lucro da loja | Consulte o resultado líquido do mês. | WhatsApp · intent `lucro_loja_mes` | owner, manager |
| 3 | Contas da semana | Veja contas a pagar e receber nos próximos dias. | WhatsApp · intent `contas_semana` | owner, manager |
| 4 | Valores a receber | Consulte recebimentos que seguem em aberto. | WhatsApp · intent `a_receber` | owner, manager |
| 5 | Falta conciliar | Veja quantidade e valor ainda não conciliados. | WhatsApp · intent `conciliacao_pendente` | owner, manager |
| 6 | Relatório contador | Gere um link seguro do pacote mensal. | WhatsApp · intent `pacote_contador` | owner, manager |
| 7 | Notas e contratos | Consulte NF-e e contratos; emita com confirmação. | WhatsApp · handler `formatarMenuJarvisAjuda` | owner, manager |
| 8 | Voltar a Gestão | Retorne à lista principal de Gestão. | Lista anterior | herdada |

### Oficina e cotações

ID da lista: `gestao:oficina_cotacoes`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Abrir operações | Veja ordens de serviço no painel. | [link](/gestao/operacoes) + Gestão › Operações | owner, manager |
| 2 | Cotações recebidas | Escolha propostas recebidas na OS pelo painel. | [link](/gestao/operacoes) + Gestão › Operações › OS › Cotações | owner, manager |
| 3 | Parceiros | Cadastre e gerencie oficinas parceiras no painel. | [link](/gestao/parceiros) + Gestão › Parceiros | owner, manager |
| 4 | Voltar a Gestão | Retorne à lista principal de Gestão. | Lista anterior | herdada |

### Documentos

ID da lista: `gestao:documentos`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Guardar CRLV | Envie o documento; o portão local protege e lê. | WhatsApp · handler `verificarDocumentoNoPortao` | owner, manager |
| 2 | Abrir cofre | Consulte documentos guardados no painel. | [link](/veiculos) + Estoque › Veículo › Documentos | owner, manager |
| 3 | Vincular ao estoque | Vincule um CRLV guardado a um veículo. | [link](/veiculos) + Estoque › Veículo › Documentos | owner, manager |
| 4 | Notas e contratos | Consulte documentos fiscais e comerciais. | [link](/gestao/lucro?aba=notas) + Gestão › Notas e contratos | owner, manager |
| 5 | Voltar a Gestão | Retorne à lista principal de Gestão. | Lista anterior | herdada |

### Clientes e leads

ID da lista: `gestao:clientes_leads`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Resumo de leads | Veja clientes ativos, novos e total de leads. | WhatsApp · tool `consultar_clientes_leads` | owner, manager, seller |
| 2 | Contatos comerciais | Liste contatos e envie uma mensagem autorizada. | WhatsApp · tool `enviar_mensagem_contato_comercial` | owner, manager, seller |
| 3 | Abrir CRM | Acompanhe clientes, etapas e retornos no painel. | [link](/leads-funil) + Clientes › Funil de leads | owner, manager, seller |
| 4 | Leads sem retorno | Veja prioridades no fechamento e abra o CRM. | WhatsApp · handler `buildGestaoFechamentoDia` | owner, manager, seller |
| 5 | Voltar a Gestão | Retorne à lista principal de Gestão. | Lista anterior | herdada |

## Vistoria e Troca

ID da lista: `vistoria_troca`

| # | Título | Descrição | Destino | Audiências |
|---:|---|---|---|---|
| 1 | Usado recentemente 1 | Última ação de Vistoria e Troca usada. | Dinâmico (B7) | herdada |
| 2 | Usado recentemente 2 | Segunda ação recente desta lista. | Dinâmico (B7) | herdada |
| 3 | Nova vistoria/troca | Abra uma nova ficha de avaliação no painel. | [link](/gestao/trocas) + Gestão › Trocas › Nova ficha | owner, manager, seller |
| 4 | Trocas e laudos | Veja avaliadas, resumo, fotos e laudo em PDF. | WhatsApp · handler `tryProcessGestaoTrocaWhatsAppInbound` | owner, manager, seller |
| 5 | Preço de troca | Consulte a referência Molicar no painel. | [link](/gestao/trocas) + Gestão › Trocas › Ficha › Preço Molicar | owner, manager, seller |
| 6 | Consultar procedência | Informe a placa, revise o preço e confirme a consulta. | WhatsApp · handler `tryProcessVeiculoProcedenciaInbound` | owner, manager, seller |
| 7 | Liberar para estoque | Revise a troca e informe o preço no painel. | [link](/gestao/trocas) + Gestão › Trocas › Ficha › Liberar para estoque | owner, manager, seller |
| 8 | Ajuda de troca | Veja como avaliar, consultar e liberar uma troca. | WhatsApp · handler `formatarMenuJarvisAjuda` | owner, manager, seller |

## Notas de capacidade

- **Abrir cofre:** A pasta digital é aberta dentro do veículo selecionado.
- **TikTok:** TikTok aceita somente vídeo neste fluxo.
- **Nova vistoria/troca:** Criação por WhatsApp fica para o TROCA-WPP-1.
- **Consultar procedência:** Este fluxo usa Consultar Placa, não Molicar.
