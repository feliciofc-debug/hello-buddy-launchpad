-- Habilitar extensão unaccent
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- Função para auto-classificar produtos de afiliado com 20 categorias Amazon
CREATE OR REPLACE FUNCTION public.auto_classificar_produto_afiliado(p_titulo TEXT, p_categoria TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  titulo_lower TEXT;
BEGIN
  -- Se categoria já veio preenchida, retorna ela (extensão enviou)
  IF p_categoria IS NOT NULL AND p_categoria != '' THEN
    RETURN p_categoria;
  END IF;
  
  -- Normaliza título para busca (com unaccent para remover acentos)
  titulo_lower := lower(unaccent(COALESCE(p_titulo, '')));
  
  -- 1. AUTOMOTIVO
  IF titulo_lower ~* '(carro|moto|automotivo|veiculo|pneu|oleo|motor|freio|farol|retrovisor|volante|cambio|embreagem|suspensao|escapamento|bateria carro|limpador para-brisa|gps carro|suporte celular carro|organizador carro|aspirador carro|capa banco|tapete carro|alarme|som automotivo)' THEN
    RETURN 'Automotivo';
  END IF;
  
  -- 2. BEBÊ (antes de outros para prioridade)
  IF titulo_lower ~* '(bebe|infantil|crianca|mamadeira|fralda|berco|carrinho bebe|chupeta|babador|mordedor|mamae|gestante|enxoval|body|macacao bebe|macacao baby|sapatinho bebe|naninha|mobile berco|cadeirinha|bebe conforto)' THEN
    RETURN 'Bebê';
  END IF;
  
  -- 3. BELEZA
  IF titulo_lower ~* '(maquiagem|batom|rimel|sombra|blush|base|corretivo|po facial|primer|delineador|mascara cilios|esmalte|unha|skincare|serum|hidratante facial|protetor solar|creme anti|acido hialuronico|retinol|vitamina c rosto|limpeza facial|tonico|demaquilante|perfume|colonia|eau de|fragrance|cabelo|shampoo|condicionador|mascara capilar|leave-in|finalizador|chapinha|babyliss|secador|prancha|escova secadora)' THEN
    RETURN 'Beleza';
  END IF;
  
  -- 4. BRINQUEDOS
  IF titulo_lower ~* '(brinquedo|boneca|boneco|lego|playmobil|nerf|hot wheels|barbie|puzzle|quebra-cabeca|jogo tabuleiro|uno|cartas|massinha|play-doh|slime|piao|patinete|triciclo|bicicleta infantil|pelucia|action figure|dinossauro brinquedo|carrinho brinquedo|pista|blocos montar)' THEN
    RETURN 'Brinquedos';
  END IF;
  
  -- 5. COZINHA (refinado - antes de Casa)
  IF titulo_lower ~* '(panela|frigideira|cacarola|wok|grill|forma|assadeira|travessa|refratario|prato|tigela|bowl|copo|caneca|xicara|talher|faca cozinha|garfo|colher|espatula|concha|escumadeira|pegador|abridor|saca-rolha|descascador|ralador|cortador|processador de alimentos|liquidificador|batedeira|mixer|air fryer|airfryer|fritadeira|microondas|torradeira|cafeteira|espremedor|centrifuga|panela pressao|chaleira|leiteira|bule|garrafa termica|jarra|tupperware|pote hermetico|organizador cozinha|escorredor|lixeira cozinha|tabua corte|avental|luva cozinha|pano prato|porta tempero|saleiro|acucareiro|fruteira|porta guardanapo)' THEN
    RETURN 'Cozinha';
  END IF;
  
  -- 6. CASA (genérico - captura resto de itens domésticos)
  IF titulo_lower ~* '(decoracao|almofada|cortina|tapete|luminaria|abajur|lustre|quadro|espelho|vaso|porta retrato|porta-retrato|relogio parede|organizador|cesto|caixa organizadora|cabide|prateleira|estante|nicho|suporte|gancho|adesivo parede|papel parede|roupa cama|lencol|edredom|cobertor|manta|fronha|colcha|travesseiro|toalha banho|toalha rosto|tapete banheiro|cortina box|saboneteira|porta escova|lixeira banheiro|difusor|aromatizador|vela aromatica|incenso|umidificador|purificador|desumidificador|aquecedor|climatizador)' THEN
    RETURN 'Casa';
  END IF;
  
  -- 7. CUIDADOS PESSOAIS
  IF titulo_lower ~* '(desodorante|sabonete|shampoo corpo|hidratante corpo|creme corpo|locao|esfoliante|depilador|barbeador|gilete|espuma barbear|pos-barba|escova dente|pasta dente|fio dental|enxaguante bucal|antisseptico|absorvente|protetor diario|cotonete|algodao|lixa|cortador unha|pinca|espelho maquiagem|necessaire|bolsa higiene)' THEN
    RETURN 'Cuidados Pessoais';
  END IF;
  
  -- 8. ELETRODOMÉSTICOS
  IF titulo_lower ~* '(geladeira|refrigerador|freezer|fogao|cooktop|forno eletrico|lava-loucas|lava loucas|maquina lavar|lavadora|secadora|tanquinho|ferro passar|aspirador po|robo aspirador|vaporizador|ventilador|ar condicionado|ar-condicionado|exaustor|coifa|depurador|aquecedor agua|boiler|purificador agua|filtro agua|bebedouro|adega|wine cooler)' THEN
    RETURN 'Eletrodomésticos';
  END IF;
  
  -- 9. ELETRÔNICOS
  IF titulo_lower ~* '(tv\b|televisao|smart tv|monitor|projetor|soundbar|home theater|caixa som|speaker|bluetooth speaker|fone ouvido|headphone|earbuds|airpods|headset|microfone|webcam|camera|gopro|drone|gimbal|tripe|ring light|estabilizador|nobreak|filtro linha|regua energia|carregador|powerbank|power bank|cabo usb|cabo hdmi|adaptador|hub usb|pendrive|hd externo|ssd externo|leitor cartao)' THEN
    RETURN 'Eletrônicos';
  END IF;
  
  -- 10. ESPORTE
  IF titulo_lower ~* '(esporte|fitness|academia|musculacao|haltere|anilha|barra|banco supino|esteira|bicicleta ergometrica|eliptico|corda pular|colchonete|tapete yoga|yoga|pilates|faixa elastica|rolo massagem|foam roller|luva treino|cinto lombar|munhequeira|joelheira|caneleira|tenis corrida|tenis academia|roupa academia|legging|top fitness|shorts treino|squeeze|garrafa agua esporte|suplemento|whey|creatina|bcaa|pre-treino|bola futebol|bola basquete|bola volei|raquete|rede|goleira|natacao|oculos natacao|touca|prancha|skate|patins|capacete)' THEN
    RETURN 'Esporte';
  END IF;
  
  -- 11. FERRAMENTAS
  IF titulo_lower ~* '(ferramenta|furadeira|parafusadeira|serra|esmerilhadeira|lixadeira|plaina|tupia|compressor|solda|soprador|pistola calor|chave|alicate|martelo|serrote|formao|trena|nivel|esquadro|prumo|paquimetro|multimetro|broca|disco corte|lixa ferramenta|serra copo|ponta phillips|bit|soquete|catraca|torquimetro|caixa ferramentas|maleta ferramentas|organizador ferramentas|bancada|morsa|grampo|sargento|epi|oculos protecao|luva protecao|capacete obra|protetor auricular|mascara solda)' THEN
    RETURN 'Ferramentas';
  END IF;
  
  -- 12. INFORMÁTICA (alta prioridade - antes de Eletrônicos genérico)
  IF titulo_lower ~* '(computador|pc\b|notebook|laptop|desktop|all-in-one|macbook|chromebook|tablet|ipad|processador|cpu|placa mae|memoria ram|ssd|hd interno|placa video|gpu|fonte pc|gabinete pc|cooler|water cooler|ventoinha|pasta termica|teclado|mouse|mousepad|monitor pc|suporte monitor|braco monitor|hub|dock station|switch rede|roteador|modem|repetidor|extensor|access point|cabo rede|cabo ethernet|impressora|multifuncional|scanner|cartucho|toner|papel a4|software|antivirus|windows|office)' THEN
    RETURN 'Informática';
  END IF;
  
  -- 13. JARDIM
  IF titulo_lower ~* '(jardim|jardinagem|planta|vaso planta|cachepot|suporte planta|terra|substrato|adubo|fertilizante|semente|muda|regador|mangueira|esguicho|irrigacao|aspersor|tesoura poda|podador|serrote poda|rastelo|enxada|pa jardim|ancinho|carrinho mao|luva jardinagem|avental jardinagem|joelheira jardim|cerca|gradil|trelica|pergolado|deck|churrasqueira|grelha|espeto|carvao|acendedor|tocha|lampiao|rede descanso|espreguicadeira|guarda-sol|ombrelone|piscina|inflavel|boia|lona|tela sombrite)' THEN
    RETURN 'Jardim';
  END IF;
  
  -- 14. LIVROS
  IF titulo_lower ~* '(livro|romance|ficcao|biografia|autoajuda|auto-ajuda|best seller|bestseller|literatura|poesia|conto|cronica|thriller|suspense|terror|fantasia|sci-fi|ficcao cientifica|historia|filosofia|psicologia|sociologia|economia|administracao|marketing|empreendedorismo|investimento|financas|culinaria|receita|gastronomia|viagem|guia turistico|arte|fotografia|design|arquitetura|musica|cinema|quadrinho|hq|manga|gibi|enciclopedia|dicionario|atlas|almanaque)' THEN
    RETURN 'Livros';
  END IF;
  
  -- 15. EBOOKS
  IF titulo_lower ~* '(ebook|e-book|kindle|digital|pdf download|curso online|audiobook|audio book|audiolivro)' THEN
    RETURN 'eBooks';
  END IF;
  
  -- 16. MODA
  IF titulo_lower ~* '(roupa|camiseta|camisa|blusa|regata|polo|moletom|casaco|jaqueta|blazer|colete|cardigan|sueter|calca|jeans|bermuda|shorts|saia|vestido|macacao|lingerie|sutia|calcinha|cueca|boxer|pijama|camisola|roupao|biquini|maio|sunga|chinelo|sandalia|tenis casual|sapato|sapatenis|bota|mocassim|oxford|scarpin|salto|rasteira|bolsa|mochila|carteira|cinto|chapeu|bone|gorro|cachecol|lenco|echarpe|gravata|oculos sol|relogio|pulseira|colar|brinco|anel|alianca|joia|bijuteria|acessorio)' THEN
    RETURN 'Moda';
  END IF;
  
  -- 17. MÓVEIS
  IF titulo_lower ~* '(movel|sofa|poltrona|puff|pufe|cadeira|banco|banqueta|mesa|escrivaninha|rack|painel tv|estante|guarda-roupa|guarda roupa|armario|comoda|criado-mudo|criado mudo|sapateira|cabeceira|cama|beliche|berco movel|colchao|base cama|bi-cama|bicama|mesa jantar|mesa centro|aparador|buffet|cristaleira|bar|adega movel|cadeira escritorio|mesa escritorio|gaveteiro|arquivo|estante livros)' THEN
    RETURN 'Móveis';
  END IF;
  
  -- 18. ESCRITÓRIO
  IF titulo_lower ~* '(escritorio|papelaria|caneta|lapis|lapiseira|borracha|apontador|marca-texto|corretivo|grampeador|grampo|furador|clips|clipe|elastico|cola|tesoura|estilete|regua|esquadro|compasso|transferidor|caderno|agenda|fichario|pasta|envelope|etiqueta|post-it|bloco notas|papel|folha|sulfite|cartolina|papel craft|impressora papel|cartucho tinta|toner|calculadora|porta caneta|organizador mesa|bandeja documento|arquivo morto|caixa arquivo|quadro branco|flipchart|marcador quadro|apagador|mural|cortica|painel recado|calendario|carimbo|almofada carimbo|lacre|malote|plastificadora|guilhotina|encadernadora|fragmentadora)' THEN
    RETURN 'Escritório';
  END IF;
  
  -- 19. PET
  IF titulo_lower ~* '(pet|cachorro|cao|gato|filhote|racao|petisco|snack pet|osso|brinquedo pet|bolinha pet|mordedor pet|corda pet|coleira|guia|peitoral|focinheira|comedouro|bebedouro pet|fonte agua pet|cama pet|casinha|toca pet|arranhador|tapete higienico|fralda pet|shampoo pet|condicionador pet|escova pet|pente pet|cortador unha pet|limpa orelha|colirio pet|antipulga|carrapato|vermifugo|suplemento pet|caixa transporte|bolsa transporte|mochila pet|portao pet|cerca pet|aquario|terrario|gaiola|viveiro)' THEN
    RETURN 'Pet';
  END IF;
  
  -- 20. VIDEO GAME
  IF titulo_lower ~* '(video game|videogame|playstation|ps4|ps5|xbox|nintendo|switch|console|controle game|joystick|gamepad|headset gamer|teclado gamer|mouse gamer|mousepad gamer|cadeira gamer|mesa gamer|monitor gamer|pc gamer|placa video gamer|jogo|game|gamer|streaming|captura|elgato|volante game|pedal game|arcade|fliperama|retro game|emulador|vr|realidade virtual|oculos vr)' THEN
    RETURN 'Video Game';
  END IF;
  
  -- DEFAULT: Casa (se nada encontrado)
  RETURN 'Casa';
END;
$$;