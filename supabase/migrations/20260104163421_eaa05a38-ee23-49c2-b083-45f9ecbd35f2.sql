-- Adicionar campo categoria na tabela de produtos
ALTER TABLE public.afiliado_produtos 
ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Outros';

-- Criar índice para busca por categoria
CREATE INDEX IF NOT EXISTS idx_afiliado_produtos_categoria 
ON public.afiliado_produtos(categoria);

-- Função para auto-classificar produtos baseado no título
CREATE OR REPLACE FUNCTION public.auto_classificar_produto_afiliado()
RETURNS TRIGGER AS $$
BEGIN
  -- Só classifica se categoria não foi definida manualmente
  IF NEW.categoria IS NULL OR NEW.categoria = 'Outros' THEN
    NEW.categoria := CASE
      WHEN LOWER(NEW.titulo) ~* '(airfryer|panela|frigideira|espátula|faca|cozinha|liquidificador|batedeira|processador|mixer|chaleira|cafeteira|torradeira|sanduicheira|grill|forno|micro-ondas|prato|talher|copo|caneca|garrafa|térmica|marmita|forma|assadeira)' THEN 'Cozinha'
      WHEN LOWER(NEW.titulo) ~* '(sofá|mesa|cadeira|estante|rack|móvel|almofada|cortina|tapete|luminária|abajur|vaso|quadro|espelho|organizador|caixa|porta|cabide|lixeira)' THEN 'Casa'
      WHEN LOWER(NEW.titulo) ~* '(fone|headset|mouse|teclado|monitor|notebook|tablet|celular|smartphone|carregador|cabo|usb|hdmi|webcam|microfone|caixa de som|speaker|powerbank|pendrive|ssd|hd)' THEN 'Tech'
      WHEN LOWER(NEW.titulo) ~* '(gamer|gaming|rgb|joystick|controle|ps4|ps5|xbox|nintendo|switch|headset gamer|cadeira gamer|mousepad)' THEN 'Gamer'
      WHEN LOWER(NEW.titulo) ~* '(bebê|infantil|criança|fralda|mamadeira|chupeta|berço|carrinho|andador|mordedor|body|macacão|sapatinho)' THEN 'Bebê'
      WHEN LOWER(NEW.titulo) ~* '(maquiagem|batom|base|rímel|sombra|blush|pincel|esponja|skincare|hidratante|sérum|protetor|perfume|shampoo|condicionador|máscara|esmalte|unha|cabelo|secador|chapinha|babyliss)' THEN 'Beleza'
      WHEN LOWER(NEW.titulo) ~* '(haltere|peso|barra|corda|colchonete|yoga|pilates|academia|whey|creatina|suplemento|treino|fitness|musculação|esteira|bicicleta ergométrica)' THEN 'Fitness'
      WHEN LOWER(NEW.titulo) ~* '(ferramenta|chave|parafuso|furadeira|serra|martelo|alicate|trena|nível|caixa de ferramentas|parafusadeira|broca|lixa|fita)' THEN 'Ferramentas'
      WHEN LOWER(NEW.titulo) ~* '(cachorro|gato|pet|ração|comedouro|bebedouro|coleira|guia|cama pet|brinquedo pet|arranhador|aquário|peixe)' THEN 'Pet'
      WHEN LOWER(NEW.titulo) ~* '(camiseta|calça|vestido|saia|blusa|jaqueta|casaco|tênis|sapato|sandália|bolsa|mochila|carteira|cinto|óculos|relógio|brinco|colar|pulseira)' THEN 'Moda'
      WHEN LOWER(NEW.titulo) ~* '(carro|moto|automotivo|volante|pneu|óleo|limpador|flanela|cera|polimento|suporte veicular|gps|câmera ré)' THEN 'Automotivo'
      WHEN LOWER(NEW.titulo) ~* '(decoração|enfeite|quadro|porta-retrato|vela|difusor|planta artificial|arranjo|centro de mesa)' THEN 'Decoração'
      ELSE 'Outros'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-classificar na inserção/atualização
DROP TRIGGER IF EXISTS trigger_auto_classificar_produto ON public.afiliado_produtos;
CREATE TRIGGER trigger_auto_classificar_produto
BEFORE INSERT OR UPDATE ON public.afiliado_produtos
FOR EACH ROW
EXECUTE FUNCTION public.auto_classificar_produto_afiliado();

-- Classificar produtos existentes
UPDATE public.afiliado_produtos SET categoria = 
  CASE
    WHEN LOWER(titulo) ~* '(airfryer|panela|frigideira|espátula|faca|cozinha|liquidificador|batedeira|processador|mixer|chaleira|cafeteira|torradeira|sanduicheira|grill|forno|micro-ondas|prato|talher|copo|caneca|garrafa|térmica|marmita|forma|assadeira)' THEN 'Cozinha'
    WHEN LOWER(titulo) ~* '(sofá|mesa|cadeira|estante|rack|móvel|almofada|cortina|tapete|luminária|abajur|vaso|quadro|espelho|organizador|caixa|porta|cabide|lixeira)' THEN 'Casa'
    WHEN LOWER(titulo) ~* '(fone|headset|mouse|teclado|monitor|notebook|tablet|celular|smartphone|carregador|cabo|usb|hdmi|webcam|microfone|caixa de som|speaker|powerbank|pendrive|ssd|hd)' THEN 'Tech'
    WHEN LOWER(titulo) ~* '(gamer|gaming|rgb|joystick|controle|ps4|ps5|xbox|nintendo|switch|headset gamer|cadeira gamer|mousepad)' THEN 'Gamer'
    WHEN LOWER(titulo) ~* '(bebê|infantil|criança|fralda|mamadeira|chupeta|berço|carrinho|andador|mordedor|body|macacão|sapatinho)' THEN 'Bebê'
    WHEN LOWER(titulo) ~* '(maquiagem|batom|base|rímel|sombra|blush|pincel|esponja|skincare|hidratante|sérum|protetor|perfume|shampoo|condicionador|máscara|esmalte|unha|cabelo|secador|chapinha|babyliss)' THEN 'Beleza'
    WHEN LOWER(titulo) ~* '(haltere|peso|barra|corda|colchonete|yoga|pilates|academia|whey|creatina|suplemento|treino|fitness|musculação|esteira|bicicleta ergométrica)' THEN 'Fitness'
    WHEN LOWER(titulo) ~* '(ferramenta|chave|parafuso|furadeira|serra|martelo|alicate|trena|nível|caixa de ferramentas|parafusadeira|broca|lixa|fita)' THEN 'Ferramentas'
    WHEN LOWER(titulo) ~* '(cachorro|gato|pet|ração|comedouro|bebedouro|coleira|guia|cama pet|brinquedo pet|arranhador|aquário|peixe)' THEN 'Pet'
    WHEN LOWER(titulo) ~* '(camiseta|calça|vestido|saia|blusa|jaqueta|casaco|tênis|sapato|sandália|bolsa|mochila|carteira|cinto|óculos|relógio|brinco|colar|pulseira)' THEN 'Moda'
    WHEN LOWER(titulo) ~* '(carro|moto|automotivo|volante|pneu|óleo|limpador|flanela|cera|polimento|suporte veicular|gps|câmera ré)' THEN 'Automotivo'
    WHEN LOWER(titulo) ~* '(decoração|enfeite|quadro|porta-retrato|vela|difusor|planta artificial|arranjo|centro de mesa)' THEN 'Decoração'
    ELSE 'Outros'
  END
WHERE categoria IS NULL OR categoria = 'Outros';