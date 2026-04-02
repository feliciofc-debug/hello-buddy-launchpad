
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role full access" ON public.trial_configs;

-- Recreate a proper select policy for authenticated users
DROP POLICY IF EXISTS "Users can view own trial config" ON public.trial_configs;
CREATE POLICY "Users can view own trial config"
ON public.trial_configs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow anon to also select (for login flow before full auth context)
CREATE POLICY "Anon can view trial config"
ON public.trial_configs
FOR SELECT
TO anon
USING (true);
