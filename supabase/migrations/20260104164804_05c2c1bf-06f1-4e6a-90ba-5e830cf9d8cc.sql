-- Corrigir função de classificação: TV antes de processador
CREATE OR REPLACE FUNCTION public.auto_classificar_produto_afiliado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.categoria IS NULL OR NEW.categoria = 'Outros' THEN
    NEW.categoria := CASE
      -- TV e monitores primeiro (antes de processador)
      WHEN LOWER(NEW.titulo) ~* '(smart tv|televisão|televisor|\btv\b|monitor gamer|monitor led|monitor ips)' THEN 'Tech'
      WHEN LOWER(NEW.titulo) ~* '(gamer|gaming|rgb|joystick|controle ps|ps4|ps5|xbox|nintendo|switch|headset gamer|cadeira gamer|mousepad)' THEN 'Gamer'
      WHEN LOWER(NEW.titulo) ~* '(airfryer|panela|frigideira|espátula|faca de cozinha|liquidificador|batedeira|processador de alimentos|mixer|chaleira|cafeteira|torradeira|sanduicheira|grill|forno elétrico|micro-ondas|prato|talher|copo|caneca|garrafa|térmica|marmita|forma|assadeira)' THEN 'Cozinha'
      WHEN LOWER(NEW.titulo) ~* '(sofá|mesa de jantar|cadeira escritório|estante|rack|móvel|almofada|cortina|tapete|luminária|abajur|vaso|quadro|espelho|organizador|cabide|lixeira)' THEN 'Casa'
      WHEN LOWER(NEW.titulo) ~* '(fone|headset|mouse|teclado|notebook|tablet|celular|smartphone|carregador|cabo usb|cabo hdmi|webcam|microfone|caixa de som|speaker|powerbank|pendrive|ssd|hd externo|drone|camera|projetor)' THEN 'Tech'
      WHEN LOWER(NEW.titulo) ~* '(bebê|infantil|criança|fralda|mamadeira|chupeta|berço|carrinho bebê|andador|mordedor|body|macacão bebê|sapatinho)' THEN 'Bebê'
      WHEN LOWER(NEW.titulo) ~* '(maquiagem|batom|base|rímel|sombra|blush|pincel maquiagem|esponja|skincare|hidratante|sérum|protetor solar|perfume|shampoo|condicionador|máscara capilar|esmalte|unha|cabelo|secador|chapinha|babyliss)' THEN 'Beleza'
      WHEN LOWER(NEW.titulo) ~* '(haltere|peso|barra|corda|colchonete|yoga|pilates|academia|whey|creatina|suplemento|treino|fitness|musculação|esteira|bicicleta ergométrica)' THEN 'Fitness'
      WHEN LOWER(NEW.titulo) ~* '(ferramenta|chave|parafuso|furadeira|serra|martelo|alicate|trena|nível|caixa de ferramentas|parafusadeira|broca|lixa|fita)' THEN 'Ferramentas'
      WHEN LOWER(NEW.titulo) ~* '(cachorro|gato|pet|ração|comedouro|bebedouro|coleira|guia|cama pet|brinquedo pet|arranhador|aquário|peixe)' THEN 'Pet'
      WHEN LOWER(NEW.titulo) ~* '(camiseta|calça|vestido|saia|blusa|jaqueta|casaco|tênis|sapato|sandália|bolsa|mochila|carteira|cinto|óculos|relógio|brinco|colar|pulseira)' THEN 'Moda'
      WHEN LOWER(NEW.titulo) ~* '(carro|moto|automotivo|volante|pneu|óleo|limpador|flanela|cera|polimento|suporte veicular|gps|câmera ré)' THEN 'Automotivo'
      WHEN LOWER(NEW.titulo) ~* '(decoração|enfeite|porta-retrato|vela|difusor|planta artificial|arranjo|centro de mesa)' THEN 'Decoração'
      ELSE 'Outros'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Reclassificar produtos existentes com a nova lógica
UPDATE public.afiliado_produtos SET categoria = 
  CASE
    WHEN LOWER(titulo) ~* '(smart tv|televisão|televisor|\btv\b|monitor gamer|monitor led|monitor ips)' THEN 'Tech'
    WHEN LOWER(titulo) ~* '(gamer|gaming|rgb|joystick|controle ps|ps4|ps5|xbox|nintendo|switch|headset gamer|cadeira gamer|mousepad)' THEN 'Gamer'
    WHEN LOWER(titulo) ~* '(airfryer|panela|frigideira|espátula|faca de cozinha|liquidificador|batedeira|processador de alimentos|mixer|chaleira|cafeteira|torradeira|sanduicheira|grill|forno elétrico|micro-ondas|prato|talher|copo|caneca|garrafa|térmica|marmita|forma|assadeira)' THEN 'Cozinha'
    WHEN LOWER(titulo) ~* '(sofá|mesa de jantar|cadeira escritório|estante|rack|móvel|almofada|cortina|tapete|luminária|abajur|vaso|quadro|espelho|organizador|cabide|lixeira)' THEN 'Casa'
    WHEN LOWER(titulo) ~* '(fone|headset|mouse|teclado|notebook|tablet|celular|smartphone|carregador|cabo usb|cabo hdmi|webcam|microfone|caixa de som|speaker|powerbank|pendrive|ssd|hd externo|drone|camera|projetor)' THEN 'Tech'
    WHEN LOWER(titulo) ~* '(bebê|infantil|criança|fralda|mamadeira|chupeta|berço|carrinho bebê|andador|mordedor|body|macacão bebê|sapatinho)' THEN 'Bebê'
    WHEN LOWER(titulo) ~* '(maquiagem|batom|base|rímel|sombra|blush|pincel maquiagem|esponja|skincare|hidratante|sérum|protetor solar|perfume|shampoo|condicionador|máscara capilar|esmalte|unha|cabelo|secador|chapinha|babyliss)' THEN 'Beleza'
    WHEN LOWER(titulo) ~* '(haltere|peso|barra|corda|colchonete|yoga|pilates|academia|whey|creatina|suplemento|treino|fitness|musculação|esteira|bicicleta ergométrica)' THEN 'Fitness'
    WHEN LOWER(titulo) ~* '(ferramenta|chave|parafuso|furadeira|serra|martelo|alicate|trena|nível|caixa de ferramentas|parafusadeira|broca|lixa|fita)' THEN 'Ferramentas'
    WHEN LOWER(titulo) ~* '(cachorro|gato|pet|ração|comedouro|bebedouro|coleira|guia|cama pet|brinquedo pet|arranhador|aquário|peixe)' THEN 'Pet'
    WHEN LOWER(titulo) ~* '(camiseta|calça|vestido|saia|blusa|jaqueta|casaco|tênis|sapato|sandália|bolsa|mochila|carteira|cinto|óculos|relógio|brinco|colar|pulseira)' THEN 'Moda'
    WHEN LOWER(titulo) ~* '(carro|moto|automotivo|volante|pneu|óleo|limpador|flanela|cera|polimento|suporte veicular|gps|câmera ré)' THEN 'Automotivo'
    WHEN LOWER(titulo) ~* '(decoração|enfeite|porta-retrato|vela|difusor|planta artificial|arranjo|centro de mesa)' THEN 'Decoração'
    ELSE 'Outros'
  END;