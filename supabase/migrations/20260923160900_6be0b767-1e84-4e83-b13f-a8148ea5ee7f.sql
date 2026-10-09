BEGIN;

SET LOCAL ROLE supabase_admin;

-- Estes dados do titular não são requisitos operacionais. Em especial, CPF
-- deve ser coletado somente quando houver uma finalidade legítima específica.
ALTER TABLE public.profiles
  ALTER COLUMN whatsapp DROP NOT NULL,
  ALTER COLUMN cpf DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_cadastro_to_whatsapp_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  clean_phone text;
  contact_owner_id uuid;
  configured_amz_tenant_id text;
BEGIN
  clean_phone := regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g');

  IF length(clean_phone) <= 11 THEN
    clean_phone := '55' || clean_phone;
  END IF;

  contact_owner_id := NEW.user_id;

  IF contact_owner_id IS NULL THEN
    configured_amz_tenant_id :=
      NULLIF(current_setting('app.amz_tenant_id', true), '');

    IF configured_amz_tenant_id IS NULL THEN
      RAISE EXCEPTION
        'app.amz_tenant_id must be configured when cadastros.user_id is null'
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      contact_owner_id := configured_amz_tenant_id::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION
          'app.amz_tenant_id must contain a valid UUID'
          USING ERRCODE = '22023';
    END;
  END IF;

  INSERT INTO public.whatsapp_contacts (
    phone,
    nome,
    notes,
    user_id,
    created_at
  ) VALUES (
    clean_phone,
    NEW.nome,
    'Origem: ' || COALESCE(NEW.origem, 'opt-in'),
    contact_owner_id,
    NEW.created_at
  )
  ON CONFLICT (phone, user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    updated_at = now();

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.sync_cadastro_to_whatsapp_contacts()
  OWNER TO supabase_admin;

COMMENT ON FUNCTION public.sync_cadastro_to_whatsapp_contacts() IS
  'Sincroniza cadastros por tenant; usa app.amz_tenant_id somente para linhas legadas sem user_id.';

NOTIFY pgrst, 'reload schema';

COMMIT;
