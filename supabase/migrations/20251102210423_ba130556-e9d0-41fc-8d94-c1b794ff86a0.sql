-- Corrigir warnings de segurança das funções

-- 1. Corrigir função update_updated_at_column (já existente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 2. Corrigir função update_clientes_updated_at
CREATE OR REPLACE FUNCTION public.update_clientes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;