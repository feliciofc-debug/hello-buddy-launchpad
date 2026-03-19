
-- Drop the overly permissive service-only policy
DROP POLICY IF EXISTS "pj_lista_membros_service" ON public.pj_lista_membros;

-- Allow authenticated users to SELECT members from their own lists
CREATE POLICY "Users can view members of their lists"
ON public.pj_lista_membros
FOR SELECT TO authenticated
USING (
  lista_id IN (SELECT id FROM public.pj_listas_categoria WHERE user_id = auth.uid())
);

-- Allow authenticated users to INSERT members into their own lists
CREATE POLICY "Users can add members to their lists"
ON public.pj_lista_membros
FOR INSERT TO authenticated
WITH CHECK (
  lista_id IN (SELECT id FROM public.pj_listas_categoria WHERE user_id = auth.uid())
);

-- Allow authenticated users to UPDATE members in their own lists
CREATE POLICY "Users can update members in their lists"
ON public.pj_lista_membros
FOR UPDATE TO authenticated
USING (
  lista_id IN (SELECT id FROM public.pj_listas_categoria WHERE user_id = auth.uid())
);

-- Allow authenticated users to DELETE members from their own lists
CREATE POLICY "Users can delete members from their lists"
ON public.pj_lista_membros
FOR DELETE TO authenticated
USING (
  lista_id IN (SELECT id FROM public.pj_listas_categoria WHERE user_id = auth.uid())
);

-- Keep anon access for the dispatcher
CREATE POLICY "Anon can read pj_lista_membros"
ON public.pj_lista_membros
FOR SELECT TO anon
USING (true);
