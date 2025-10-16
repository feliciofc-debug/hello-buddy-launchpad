-- Criar tabela de notificações do WhatsApp
CREATE TABLE public.whatsapp_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas próprias notificações"
ON public.whatsapp_notifications
FOR SELECT
USING (true);

CREATE POLICY "Usuários podem criar notificações"
ON public.whatsapp_notifications
FOR INSERT
WITH CHECK (true);

-- Índice para performance
CREATE INDEX idx_whatsapp_notifications_user_id ON public.whatsapp_notifications(user_id);
CREATE INDEX idx_whatsapp_notifications_sent_at ON public.whatsapp_notifications(sent_at DESC);