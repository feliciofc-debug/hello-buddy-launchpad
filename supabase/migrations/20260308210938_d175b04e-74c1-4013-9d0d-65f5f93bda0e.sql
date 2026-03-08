-- Remove the global unique constraint on whatsapp
ALTER TABLE public.cadastros DROP CONSTRAINT cadastros_whatsapp_unique;

-- Add a unique constraint scoped to user_id + whatsapp
ALTER TABLE public.cadastros ADD CONSTRAINT cadastros_user_whatsapp_unique UNIQUE (user_id, whatsapp);