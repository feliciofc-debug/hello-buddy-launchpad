-- Atualizar função para 22 categorias Amazon exatas
CREATE OR REPLACE FUNCTION public.auto_classificar_produto_afiliado()
RETURNS trigger AS $$
DECLARE
  titulo_lower TEXT;
BEGIN
  -- Se categoria já veio válida da extensão, manter exatamente como veio
  IF NEW.categoria IS NOT NULL AND NEW.categoria IN (
    'Alimentos e Bebidas', 'Automotivo', 'Bebês', 'Beleza', 'Brinquedos e Jogos',
    'Casa', 'Construção', 'Cozinha', 'Cuidados Pessoais e Limpeza', 'Eletrodomésticos',
    'Eletrônicos e Celulares', 'Esportes e Aventura', 'Ferramentas e Construção',
    'Informática', 'Jardim e Piscina', 'Livros', 'eBooks', 'Moda', 'Móveis',
    'Papelaria e Escritório', 'Pet Shop', 'Video Games'
  ) THEN
    RETURN NEW;
  END IF;

  -- Fallback: auto-classificar baseado em palavras-chave
  titulo_lower := unaccent(lower(COALESCE(NEW.titulo, '')));
  
  -- Bebês (prioridade alta)
  IF titulo_lower ~* '(bebê|bebe|infantil|mamadeira|fralda|berço|carrinho bebê|chupeta|enxoval)' THEN
    NEW.categoria := 'Bebês';
  -- Eletrônicos e Celulares
  ELSIF titulo_lower ~* '(celular|smartphone|iphone|samsung galaxy|tablet|ipad|fone|airpod|smartwatch|carregador|powerbank)' THEN
    NEW.categoria := 'Eletrônicos e Celulares';
  -- Informática
  ELSIF titulo_lower ~* '(notebook|laptop|computador|pc gamer|monitor|teclado|mouse|ssd|hd externo|webcam|impressora)' THEN
    NEW.categoria := 'Informática';
  -- Video Games
  ELSIF titulo_lower ~* '(playstation|ps5|ps4|xbox|nintendo|switch|controle gamer|headset gamer|jogo ps|jogo xbox)' THEN
    NEW.categoria := 'Video Games';
  -- Eletrodomésticos
  ELSIF titulo_lower ~* '(geladeira|refrigerador|fogão|máquina lavar|lavadora|secadora|microondas|air fryer|airfryer|liquidificador|batedeira|aspirador|ventilador|ar condicionado)' THEN
    NEW.categoria := 'Eletrodomésticos';
  -- Cozinha
  ELSIF titulo_lower ~* '(panela|frigideira|forma|assadeira|jogo de panelas|faqueiro|talheres|prato|copo|caneca|garrafa térmica|tupperware)' THEN
    NEW.categoria := 'Cozinha';
  -- Alimentos e Bebidas
  ELSIF titulo_lower ~* '(alimento|bebida|café|chá|suplemento|whey|proteína|vitamina|granola|cereal|biscoito|chocolate)' THEN
    NEW.categoria := 'Alimentos e Bebidas';
  -- Beleza
  ELSIF titulo_lower ~* '(maquiagem|batom|rímel|base|corretivo|perfume|hidratante facial|sérum|skincare|chapinha|secador cabelo|prancha)' THEN
    NEW.categoria := 'Beleza';
  -- Cuidados Pessoais e Limpeza
  ELSIF titulo_lower ~* '(shampoo|condicionador|sabonete|desodorante|escova dental|pasta dental|barbeador|depilador|limpeza|detergente|desinfetante)' THEN
    NEW.categoria := 'Cuidados Pessoais e Limpeza';
  -- Pet Shop
  ELSIF titulo_lower ~* '(cachorro|gato|pet|ração|comedouro|bebedouro pet|coleira|casinha pet|brinquedo pet|aquário|peixe)' THEN
    NEW.categoria := 'Pet Shop';
  -- Esportes e Aventura
  ELSIF titulo_lower ~* '(academia|fitness|musculação|bicicleta|bike|esteira|haltere|tênis corrida|mochila camping|barraca|saco dormir)' THEN
    NEW.categoria := 'Esportes e Aventura';
  -- Moda
  ELSIF titulo_lower ~* '(camisa|camiseta|calça|vestido|saia|blusa|jaqueta|tênis|sapato|bolsa|carteira|relógio|óculos)' THEN
    NEW.categoria := 'Moda';
  -- Móveis
  ELSIF titulo_lower ~* '(sofá|poltrona|mesa|cadeira|estante|rack|cama|colchão|guarda-roupa|armário|escrivaninha)' THEN
    NEW.categoria := 'Móveis';
  -- Brinquedos e Jogos
  ELSIF titulo_lower ~* '(brinquedo|boneca|lego|carrinho|jogo tabuleiro|quebra-cabeça|puzzle|pelúcia|nerf|hot wheels)' THEN
    NEW.categoria := 'Brinquedos e Jogos';
  -- Ferramentas e Construção
  ELSIF titulo_lower ~* '(furadeira|parafusadeira|serra|martelo|chave|ferramenta|caixa ferramentas|trena|nível|broca)' THEN
    NEW.categoria := 'Ferramentas e Construção';
  -- Jardim e Piscina
  ELSIF titulo_lower ~* '(jardim|jardinagem|vaso|planta|mangueira|cortador grama|piscina|filtro piscina|cloro|rede piscina)' THEN
    NEW.categoria := 'Jardim e Piscina';
  -- Papelaria e Escritório
  ELSIF titulo_lower ~* '(caderno|caneta|lápis|papel|fichário|agenda|post-it|grampeador|calculadora|organizador mesa)' THEN
    NEW.categoria := 'Papelaria e Escritório';
  -- Livros
  ELSIF titulo_lower ~* '(livro|romance|biografia|autoajuda|best seller|capa dura|edição|literatura)' THEN
    NEW.categoria := 'Livros';
  -- eBooks
  ELSIF titulo_lower ~* '(ebook|kindle|e-book|livro digital)' THEN
    NEW.categoria := 'eBooks';
  -- Automotivo
  ELSIF titulo_lower ~* '(carro|automotivo|pneu|óleo motor|acessório carro|gps|câmera ré|som automotivo|tapete carro)' THEN
    NEW.categoria := 'Automotivo';
  -- Construção
  ELSIF titulo_lower ~* '(cimento|tijolo|tinta|pintura|torneira|chuveiro|vaso sanitário|piso|azulejo|porta|janela)' THEN
    NEW.categoria := 'Construção';
  -- Casa (default)
  ELSE
    NEW.categoria := 'Casa';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;