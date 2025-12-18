-- Fix Pietro Eugenio dashboard visibility + public chat persistence
-- Ensure authenticated staff can read full conversation + message content,
-- while allowing public visitors to INSERT new conversations/messages.

-- 1) Conversations
ALTER TABLE public.pietro_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pietro_conversations_insert_public" ON public.pietro_conversations;
CREATE POLICY "pietro_conversations_insert_public"
ON public.pietro_conversations
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "pietro_conversations_select_authenticated" ON public.pietro_conversations;
CREATE POLICY "pietro_conversations_select_authenticated"
ON public.pietro_conversations
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "pietro_conversations_update_authenticated" ON public.pietro_conversations;
CREATE POLICY "pietro_conversations_update_authenticated"
ON public.pietro_conversations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 2) Messages
ALTER TABLE public.pietro_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pietro_messages_insert_public" ON public.pietro_messages;
CREATE POLICY "pietro_messages_insert_public"
ON public.pietro_messages
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "pietro_messages_select_authenticated" ON public.pietro_messages;
CREATE POLICY "pietro_messages_select_authenticated"
ON public.pietro_messages
FOR SELECT
TO authenticated
USING (true);

-- Optional: allow authenticated to update (notes/corrections) if ever needed
DROP POLICY IF EXISTS "pietro_messages_update_authenticated" ON public.pietro_messages;
CREATE POLICY "pietro_messages_update_authenticated"
ON public.pietro_messages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
