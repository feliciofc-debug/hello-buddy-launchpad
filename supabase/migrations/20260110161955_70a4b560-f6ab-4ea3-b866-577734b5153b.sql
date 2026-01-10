-- ============================================
-- NOVA FUNÇÃO: ROTAÇÃO INTELIGENTE POR CATEGORIA
-- Envia 3 produtos de cada categoria antes de mudar
-- ============================================

CREATE OR REPLACE FUNCTION public.pegar_proximo_produto_programacao(p_programacao_id uuid)
 RETURNS TABLE(produto_id uuid, titulo text, preco numeric, link_afiliado text, imagem_url text, categoria text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prog RECORD;
  v_produto RECORD;
  v_categoria_atual TEXT;
  v_produtos_na_categoria INT;
  v_proxima_categoria TEXT;
BEGIN
  -- Buscar programação
  SELECT * INTO v_prog FROM programacao_envio_afiliado WHERE id = p_programacao_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- MODO ROTATIVO COM ALTERNÂNCIA DE CATEGORIAS
  IF v_prog.modo_selecao IN ('rotativo', 'rotativo_categoria') THEN
    
    -- Verificar última categoria enviada
    SELECT h.produto_categoria INTO v_categoria_atual
    FROM historico_envio_programado h
    WHERE h.programacao_id = p_programacao_id
    ORDER BY h.enviado_at DESC
    LIMIT 1;
    
    -- Contar quantos produtos consecutivos da mesma categoria foram enviados
    SELECT COUNT(*) INTO v_produtos_na_categoria
    FROM (
      SELECT h.produto_categoria
      FROM historico_envio_programado h
      WHERE h.programacao_id = p_programacao_id
        AND h.produto_categoria = v_categoria_atual
      ORDER BY h.enviado_at DESC
      LIMIT 3
    ) sub
    WHERE sub.produto_categoria = v_categoria_atual;
    
    -- Se já enviou 3 produtos da mesma categoria, mudar para próxima
    IF v_produtos_na_categoria >= 3 OR v_categoria_atual IS NULL THEN
      
      -- Buscar próxima categoria diferente (circular)
      SELECT DISTINCT ap.categoria INTO v_proxima_categoria
      FROM afiliado_produtos ap
      WHERE ap.user_id = v_prog.user_id
        AND ap.status = 'ativo'
        AND (array_length(v_prog.categorias, 1) IS NULL 
             OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
        AND (v_categoria_atual IS NULL OR LOWER(ap.categoria) <> LOWER(v_categoria_atual))
        AND EXISTS (
          SELECT 1 FROM afiliado_produtos ap2
          WHERE ap2.user_id = v_prog.user_id
            AND ap2.status = 'ativo'
            AND LOWER(ap2.categoria) = LOWER(ap.categoria)
            AND NOT EXISTS (
              SELECT 1 FROM produtos_enviados_programacao pep 
              WHERE pep.programacao_id = p_programacao_id 
              AND pep.produto_id = ap2.id
            )
        )
      ORDER BY RANDOM()
      LIMIT 1;
      
      -- Se não encontrou categoria nova, resetar ciclo
      IF v_proxima_categoria IS NULL THEN
        DELETE FROM produtos_enviados_programacao WHERE programacao_id = p_programacao_id;
        
        SELECT DISTINCT ap.categoria INTO v_proxima_categoria
        FROM afiliado_produtos ap
        WHERE ap.user_id = v_prog.user_id
          AND ap.status = 'ativo'
          AND (array_length(v_prog.categorias, 1) IS NULL 
               OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
        ORDER BY RANDOM()
        LIMIT 1;
      END IF;
      
      v_categoria_atual := v_proxima_categoria;
    END IF;
    
    -- Buscar produto da categoria atual que ainda não foi enviado
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
      AND LOWER(ap.categoria) = LOWER(v_categoria_atual)
      AND NOT EXISTS (
        SELECT 1 FROM produtos_enviados_programacao pep 
        WHERE pep.programacao_id = p_programacao_id 
        AND pep.produto_id = ap.id
      )
    ORDER BY RANDOM()
    LIMIT 1;
    
    -- Se não encontrou na categoria, tentar qualquer produto não enviado
    IF NOT FOUND THEN
      SELECT ap.* INTO v_produto
      FROM afiliado_produtos ap
      WHERE ap.user_id = v_prog.user_id
        AND ap.status = 'ativo'
        AND (array_length(v_prog.categorias, 1) IS NULL 
             OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
        AND NOT EXISTS (
          SELECT 1 FROM produtos_enviados_programacao pep 
          WHERE pep.programacao_id = p_programacao_id 
          AND pep.produto_id = ap.id
        )
      ORDER BY RANDOM()
      LIMIT 1;
    END IF;
    
    -- Se ainda não encontrou, resetar e tentar de novo
    IF NOT FOUND THEN
      DELETE FROM produtos_enviados_programacao WHERE programacao_id = p_programacao_id;
      
      SELECT ap.* INTO v_produto
      FROM afiliado_produtos ap
      WHERE ap.user_id = v_prog.user_id
        AND ap.status = 'ativo'
        AND (array_length(v_prog.categorias, 1) IS NULL 
             OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
      ORDER BY RANDOM()
      LIMIT 1;
    END IF;
    
  ELSIF v_prog.modo_selecao = 'aleatorio' THEN
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
      AND (array_length(v_prog.categorias, 1) IS NULL 
           OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
    ORDER BY RANDOM()
    LIMIT 1;
    
  ELSIF v_prog.modo_selecao = 'preco_baixo' THEN
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
      AND (array_length(v_prog.categorias, 1) IS NULL 
           OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
      AND NOT EXISTS (
        SELECT 1 FROM produtos_enviados_programacao pep 
        WHERE pep.programacao_id = p_programacao_id 
        AND pep.produto_id = ap.id
      )
    ORDER BY ap.preco ASC NULLS LAST
    LIMIT 1;
    
  ELSIF v_prog.modo_selecao = 'mais_recente' THEN
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
      AND (array_length(v_prog.categorias, 1) IS NULL 
           OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
    ORDER BY ap.created_at DESC
    LIMIT 1;
    
  ELSE
    -- Fallback: qualquer produto ativo
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      v_produto.id,
      v_produto.titulo,
      v_produto.preco,
      v_produto.link_afiliado,
      v_produto.imagem_url,
      v_produto.categoria;
  END IF;
END;
$function$;