ALTER TABLE public.pj_lista_membros ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.pj_lista_membros m
SET user_id = l.user_id
FROM public.pj_listas_categoria l
WHERE m.lista_id = l.id AND m.user_id IS NULL;

CREATE OR REPLACE FUNCTION public.pj_lista_membros_set_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.lista_id IS NOT NULL THEN
    SELECT l.user_id INTO NEW.user_id FROM public.pj_listas_categoria l WHERE l.id = NEW.lista_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pj_lista_membros_user_id ON public.pj_lista_membros;
CREATE TRIGGER trg_pj_lista_membros_user_id
BEFORE INSERT OR UPDATE ON public.pj_lista_membros
FOR EACH ROW EXECUTE FUNCTION public.pj_lista_membros_set_user_id();

CREATE INDEX IF NOT EXISTS idx_pj_lista_membros_user_tel ON public.pj_lista_membros(user_id, telefone);