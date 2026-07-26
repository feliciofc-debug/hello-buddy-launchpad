-- Fix #2: Remove policy USING(true) that exposed all affiliate rows to anon
DROP POLICY IF EXISTS "Código de referência público para lookup" ON public.afiliados;

-- Revoke anon SELECT (defense in depth; policies are the primary gate but grants matter too)
REVOKE SELECT ON public.afiliados FROM anon;