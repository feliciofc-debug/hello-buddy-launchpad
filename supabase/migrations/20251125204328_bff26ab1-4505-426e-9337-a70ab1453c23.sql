-- Corrigir search_path da função update_whatsapp_contacts_updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_contacts_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;