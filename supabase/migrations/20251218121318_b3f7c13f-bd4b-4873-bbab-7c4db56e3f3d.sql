-- Remover policies antigas e criar novas que permitem insert público
DROP POLICY IF EXISTS "Allow public insert conversations" ON public.pietro_conversations;
DROP POLICY IF EXISTS "Allow public update conversations" ON public.pietro_conversations;
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON public.pietro_conversations;
DROP POLICY IF EXISTS "Allow public insert messages" ON public.pietro_messages;
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.pietro_messages;

-- Pietro conversations - permitir insert/update público, select apenas autenticados
CREATE POLICY "Anyone can create conversations" 
ON public.pietro_conversations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update their conversation" 
ON public.pietro_conversations 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated can view all conversations" 
ON public.pietro_conversations 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Pietro messages - permitir insert público, select apenas autenticados
CREATE POLICY "Anyone can create messages" 
ON public.pietro_messages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated can view all messages" 
ON public.pietro_messages 
FOR SELECT 
USING (auth.uid() IS NOT NULL);