-- Tabela de conversas do Pietro
CREATE TABLE public.pietro_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  visitor_name TEXT,
  visitor_phone TEXT,
  visitor_email TEXT,
  visitor_company TEXT,
  visitor_ip TEXT,
  user_agent TEXT,
  interest_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  private_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de mensagens do Pietro
CREATE TABLE public.pietro_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.pietro_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_pietro_conversations_session ON public.pietro_conversations(session_id);
CREATE INDEX idx_pietro_conversations_created ON public.pietro_conversations(created_at DESC);
CREATE INDEX idx_pietro_messages_conversation ON public.pietro_messages(conversation_id);

-- RLS
ALTER TABLE public.pietro_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pietro_messages ENABLE ROW LEVEL SECURITY;

-- Políticas - permitir insert público (visitantes)
CREATE POLICY "Allow public insert conversations" ON public.pietro_conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert messages" ON public.pietro_messages
  FOR INSERT WITH CHECK (true);

-- Políticas - permitir update público (para atualizar status/notas)
CREATE POLICY "Allow public update conversations" ON public.pietro_conversations
  FOR UPDATE USING (true);

-- Políticas - apenas usuários autenticados podem ver
CREATE POLICY "Authenticated users can view conversations" ON public.pietro_conversations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view messages" ON public.pietro_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pietro_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pietro_messages;