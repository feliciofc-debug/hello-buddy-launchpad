
ALTER TABLE public.gateway_status ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "anyone_can_read_gateway" ON public.gateway_status;
CREATE POLICY "anyone_can_read_gateway" ON public.gateway_status FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_can_upsert_gateway" ON public.gateway_status;
CREATE POLICY "anon_can_upsert_gateway" ON public.gateway_status FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_can_all_gateway" ON public.gateway_status;
CREATE POLICY "auth_can_all_gateway" ON public.gateway_status FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.gateway_status TO anon;
GRANT ALL ON public.gateway_status TO authenticated;
