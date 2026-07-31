CREATE TABLE public.comexia_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mp_payment_id TEXT NOT NULL UNIQUE,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  documento TEXT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notificado BOOLEAN NOT NULL DEFAULT false,
  acesso_liberado BOOLEAN NOT NULL DEFAULT false,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.comexia_pagamentos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comexia_pagamentos TO authenticated;

ALTER TABLE public.comexia_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage comexia payments"
ON public.comexia_pagamentos
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_comexia_pagamentos_updated_at
BEFORE UPDATE ON public.comexia_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();