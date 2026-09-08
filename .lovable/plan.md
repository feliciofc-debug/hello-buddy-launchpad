# Identidade pela URL + Calendário editorial no Jarvis

Plano e opinião técnica. Nada foi alterado no sistema.

## Resumo da recomendação

Fazer **primeiro a extração de identidade pela URL**. Motivos: dor imediata e recorrente (prospecção — você garimpou o vermelho do Zona Sul à mão), esforço menor, resultado verificável na hora, e alimenta o que já existe (cores do vídeo, cadastro da empresa, base do Jarvis). O calendário editorial é mais valioso a longo prazo, mas depende de confiança e de regras de frequência — se errar o tom, vira spam no WhatsApp do cliente, e isso é caro de recuperar.

---

## 1. Extração de identidade pela URL

### Abordagem recomendada: híbrida, em duas camadas

**Camada A — leitura do site (barata, roda sempre)**
- Buscar o HTML da URL e os arquivos de CSS ligados a ela.
- Cores: coletar todos os valores de cor do CSS e de estilos inline, com **peso por onde aparecem** (cor de fundo do topo, botões, cabeçalho e links valem mais que uma borda qualquer), depois agrupar tons parecidos e devolver as 5 principais. Frequência pura erra: devolve cinza de borda como cor de marca.
- Logo: nesta ordem — `og:image` da marca, `<link rel="icon">` de maior resolução, `<img>` dentro do cabeçalho com "logo" no nome/alt, `apple-touch-icon`.
- Tipografia: `font-family` aplicada ao corpo e aos títulos + fontes do Google Fonts declaradas.
- Texto: título, meta descrição, tagline do topo e os primeiros blocos de texto.

**Camada B — leitura visual (quando a A não basta)**
- Abrir a página num navegador sem interface na VPS (Playwright, que já está disponível), tirar uma captura da parte de cima e, com ela, resolver dois problemas de uma vez: **SPA que não entrega nada sem JavaScript** e **conferência das cores como o olho vê** (gradiente, imagem de fundo, banner).
- A captura vai junto com o texto para o modelo de IA, que devolve: tom de voz, segmento, proposta de valor, resumo do negócio e confirmação/correção das cores.

Ou seja: as cores nascem do código (exatas, sem alucinação), e a IA cuida do que é interpretação (tom, segmento, valor). Não invertemos isso — pedir hexadecimal para a IA a partir de imagem dá cor "parecida", e depois o vídeo sai fora da marca.

### SPA e sites que bloqueiam
- Regra: se o HTML vier com pouco texto útil ou sem CSS de marca, sobe para a Camada B automaticamente.
- Site que recusa o acesso (bloqueio de robô, login, Cloudflare): mostramos o que conseguimos e abrimos os campos para ajuste manual, dizendo com clareza que o site não deixou ler. Nunca inventar cor.
- Prazo máximo de espera por site: 20s; nada trava a tela.

### Custo
- Camada A: zero (só requisição de rede).
- Camada B: navegador na VPS já paga (zero) + **uma** chamada de IA por análise, com a imagem reduzida. Fica na faixa de fração de centavo por site. Guardamos o resultado por domínio, então reanalisar o mesmo cliente não custa nada.

### Onde entra no produto
- Botão "Importar do site" no cadastro da empresa: cola a URL → mostra paleta, logo, fontes e textos → você aprova/edita → salva.
- No gerador de vídeo: preset "Marca do cliente (do site)" ao lado de "Personalizada".
- No Jarvis pelo WhatsApp: "faz um vídeo pro zonasul.com.br" → ele lê o site, monta a paleta e já mostra no roteiro de aprovação ("Paleta: fundo branco, destaque vermelho #e30613"), que é exatamente o encaixe com o que ficou pronto ontem.
- A logo encontrada entra como logo do vídeo daquele pedido (resolve a ressalva que ficou aberta).

### Esforço
- Leitura de site + extração de cores/logo/fontes: ~1 dia.
- Camada visual com navegador na VPS + análise por IA: ~1 dia.
- Tela de importação com aprovação e edição: ~meio dia.
- Encaixe no vídeo e no Jarvis: ~meio dia.
Total: **~3 dias**, entregável em fatias (a Camada A sozinha já resolve a maioria dos sites).

### Riscos honestos
- Site em imagem única ou muito estilizado devolve paleta pobre — por isso a tela de aprovação é obrigatória, não opcional.
- Logo em PNG com fundo branco: aproveitamos o rembg que já roda na VPS para deixar transparente.
- Usar a marca de terceiro em material de prospecção é prática comum, mas convém marcar essas peças como "demonstração" internamente.

---

## 2. Calendário editorial proativo no Jarvis

### Como definir as datas
Três níveis, do genérico ao pessoal:
1. **Base fixa nacional**: Natal, Ano Novo, Carnaval, Páscoa, Dia das Mães/Pais/Namorados/Crianças, Black Friday, Consumidor, Trabalhador, festas de junho, volta às aulas.
2. **Datas por segmento**, ligadas ao segmento que já existe no cadastro: supermercado (Páscoa, ceia, feirão de carnes), academia (verão, janeiro), pet (Dia do Animal), consórcio (13º, início de ano, planejamento), blindagem (fim de ano/segurança), imóveis (fim de ano/IPTU).
3. **Datas do próprio cliente**: aniversário da empresa, promoções recorrentes, campanhas que ele já rodou. Preenchidas pelo próprio uso.

A base é uma tabela simples com data, abrangência, segmentos e antecedência ideal — não precisa de IA para saber quando é o Dia das Mães.

### Controle de frequência (a parte que decide o sucesso)
- **No máximo 1 sugestão proativa por semana** e **4 por mês** por cliente.
- Só entre 9h e 18h, dias úteis, horário de São Paulo.
- Antecedência por tipo: datas grandes 21 dias, médias 10, pequenas 5.
- Se o cliente ignorar duas sugestões seguidas, o Jarvis espalha (passa a mensal). Ignorar quatro: desliga e só volta se ele pedir.
- "Não quero mais isso" desliga na hora, por cliente.
- Nunca sugerir quando houver conversa ativa em andamento nem enquanto uma campanha estiver rodando.
- Ligado por cliente, com chave em "Minha Empresa" — e desligado por padrão até você validar o tom com um ou dois clientes.

### Créditos de IA
Uma sugestão = uma chamada de texto que devolve 4 ideias de post curtas. Custo por sugestão na casa de centavos, teto de 4 por mês por cliente. Imagem e vídeo só se ele aceitar — aí entra na cota que já existe. Ou seja: a parte proativa é barata; o gasto real só acontece quando o cliente diz "quero ver".

### Esforço
- Tabela de datas + regras por segmento: ~meio dia.
- Rotina diária que decide quem recebe o quê, com todos os limites: ~1 dia.
- Redação das sugestões e o "quer ver?" virando geração de conteúdo: ~1 dia.
- Painel de acompanhamento (quem recebeu, quem aceitou): ~meio dia.
Total: **~3 dias**, mas com uma semana de observação antes de ligar para todos.

---

## 3. Minhas ideias

**Vale muito, e é quase de graça com o que já existe:**
1. **Prospecção em lote pela URL**: lista de sites → um vídeo na marca de cada um → tudo pronto para você mandar. Multiplica o que você fez manualmente com o Zona Sul.
2. **Antes/depois na proposta**: mostrar ao prospect o post dele hoje e a versão feita pela plataforma. Vende melhor que qualquer explicação.
3. **Vigia de marca**: reanalisar o site do cliente a cada 30 dias e avisar se ele trocou logo/cores, para o material não sair desatualizado.
4. **Kit de marca exportável**: uma página com paleta, fontes, logo e tom de voz do cliente. Entregável percebido como valioso, custo zero.
5. **Reaproveitamento entre redes**: um vídeo aprovado gera automaticamente as variações de formato para as 5 redes. Puramente técnico, sem IA, e economiza tempo real.

**Não vale copiar:**
1. **Geração de imagem própria** — perder para o DeepMind é garantido e não é nosso diferencial. Nosso valor é publicar, atender e vender pelo WhatsApp.
2. **Editor visual estilo Canva** — meses de trabalho para competir com produto grátis e consagrado.
3. **Análise de concorrência automática** — parece inteligente, entrega genérico, e ninguém decide nada com aquilo.
4. **"Business DNA" totalmente automático sem revisão** — no Pomelli é demonstração; no seu negócio, uma cor errada vira vídeo errado na frente do cliente. Aprovação humana sempre.
5. **Score/notas de marca** — vaidade, não decisão.

---

## Ordem sugerida
1. Extração pela URL, Camada A + tela de aprovação (uso imediato em prospecção).
2. Camada visual com navegador na VPS (cobre SPA e sites difíceis).
3. Encaixe no Jarvis: "vídeo pro site X" já na marca do cliente.
4. Calendário editorial, ligado primeiro só para você e um cliente piloto.
