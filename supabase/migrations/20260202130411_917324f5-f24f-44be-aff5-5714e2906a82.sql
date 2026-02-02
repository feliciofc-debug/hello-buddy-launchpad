-- Add columns for interval-based scheduling and product rotation
ALTER TABLE campanhas_recorrentes 
  ADD COLUMN IF NOT EXISTS intervalo_minutos integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ultimo_produto_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS produtos_ids uuid[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pj_grupos_ids uuid[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS categoria_rotacao text DEFAULT NULL;

-- Add comment explaining the new columns
COMMENT ON COLUMN campanhas_recorrentes.intervalo_minutos IS 'Interval in minutes between executions (ex: 5 for every 5 min). When set, ignores horarios array.';
COMMENT ON COLUMN campanhas_recorrentes.ultimo_produto_index IS 'Index of last sent product for rotation';
COMMENT ON COLUMN campanhas_recorrentes.produtos_ids IS 'Array of product IDs for rotation (if null, uses all products from user)';
COMMENT ON COLUMN campanhas_recorrentes.pj_grupos_ids IS 'Array of PJ group IDs for sending (uses JID from pj_grupos_whatsapp)';
COMMENT ON COLUMN campanhas_recorrentes.categoria_rotacao IS 'Category filter for product rotation';