-- Recriando função com SECURITY DEFINER para ignorar RLS
DROP FUNCTION IF EXISTS public.pegar_proximo_produto_programacao(uuid);

CREATE OR REPLACE FUNCTION public.pegar_proximo_produto_programacao(p_programacao_id uuid)
 RETURNS SETOF afiliado_produtos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_programacao RECORD;
  v_produto afiliado_produtos%ROWTYPE;
  v_proximo_marketplace TEXT;
  v_marketplaces_disponiveis TEXT[];
  v_contador INTEGER;
  v_ultimo_id uuid;
BEGIN
  -- Buscar configuração da programação
  SELECT * INTO v_programacao 
  FROM programacao_envio_afiliado 
  WHERE id = p_programacao_id;
  
  IF v_programacao IS NULL THEN
    RAISE EXCEPTION 'Programação não encontrada';
  END IF;
  
  -- Obter marketplaces ativos (default: todos)
  v_marketplaces_disponiveis := COALESCE(v_programacao.marketplaces_ativos, ARRAY['Amazon', 'Shopee', 'Magazine Luiza', 'Mercado Livre']);
  
  -- Lógica de rotação: 3 produtos por marketplace antes de trocar
  v_contador := COALESCE(v_programacao.produtos_no_marketplace_atual, 0);
  v_ultimo_id := COALESCE(v_programacao.ultimo_produto_id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF v_contador >= 3 OR v_programacao.ultimo_marketplace_enviado IS NULL THEN
    -- Hora de trocar de marketplace
    IF v_programacao.ultimo_marketplace_enviado IS NULL THEN
      v_proximo_marketplace := v_marketplaces_disponiveis[1];
    ELSE
      -- Encontrar próximo marketplace na lista
      FOR i IN 1..array_length(v_marketplaces_disponiveis, 1) LOOP
        IF v_marketplaces_disponiveis[i] = v_programacao.ultimo_marketplace_enviado THEN
          IF i = array_length(v_marketplaces_disponiveis, 1) THEN
            v_proximo_marketplace := v_marketplaces_disponiveis[1];
          ELSE
            v_proximo_marketplace := v_marketplaces_disponiveis[i + 1];
          END IF;
          EXIT;
        END IF;
      END LOOP;
      
      -- Se não encontrou, usar o primeiro
      IF v_proximo_marketplace IS NULL THEN
        v_proximo_marketplace := v_marketplaces_disponiveis[1];
      END IF;
    END IF;
    
    v_contador := 0;
  ELSE
    v_proximo_marketplace := COALESCE(v_programacao.ultimo_marketplace_enviado, v_marketplaces_disponiveis[1]);
  END IF;
  
  -- Buscar produto do marketplace selecionado SEM FILTRO DE CATEGORIA
  SELECT p.* INTO v_produto
  FROM afiliado_produtos p
  WHERE p.user_id = v_programacao.user_id
    AND LOWER(p.marketplace) ILIKE '%' || LOWER(v_proximo_marketplace) || '%'
    AND p.id != v_ultimo_id
  ORDER BY RANDOM()
  LIMIT 1;
  
  -- Se não encontrou produto no marketplace atual, tentar próximo
  IF v_produto IS NULL THEN
    FOR i IN 1..array_length(v_marketplaces_disponiveis, 1) LOOP
      IF v_marketplaces_disponiveis[i] != v_proximo_marketplace THEN
        SELECT p.* INTO v_produto
        FROM afiliado_produtos p
        WHERE p.user_id = v_programacao.user_id
          AND LOWER(p.marketplace) ILIKE '%' || LOWER(v_marketplaces_disponiveis[i]) || '%'
          AND p.id != v_ultimo_id
        ORDER BY RANDOM()
        LIMIT 1;
        
        IF v_produto IS NOT NULL THEN
          v_proximo_marketplace := v_marketplaces_disponiveis[i];
          v_contador := 0;
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  -- Se ainda não encontrou, buscar qualquer produto
  IF v_produto IS NULL THEN
    SELECT p.* INTO v_produto
    FROM afiliado_produtos p
    WHERE p.user_id = v_programacao.user_id
      AND p.id != v_ultimo_id
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Atualizar controle de rotação
  IF v_produto IS NOT NULL THEN
    UPDATE programacao_envio_afiliado 
    SET 
      ultimo_produto_id = v_produto.id,
      ultimo_marketplace_enviado = v_proximo_marketplace,
      produtos_no_marketplace_atual = v_contador + 1,
      updated_at = NOW()
    WHERE id = p_programacao_id;
    
    RETURN NEXT v_produto;
  END IF;
  
  RETURN;
END;
$function$;