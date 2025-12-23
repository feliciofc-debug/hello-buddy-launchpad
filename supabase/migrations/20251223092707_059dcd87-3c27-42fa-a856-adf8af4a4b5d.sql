-- Criar bucket para backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: apenas admins podem acessar backups
CREATE POLICY "Admins podem acessar backups"
ON storage.objects
FOR ALL
USING (bucket_id = 'backups' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'backups' AND auth.uid() IS NOT NULL);

-- Tabela para log de backups
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  tabelas_backup TEXT[] DEFAULT '{}',
  arquivo_path TEXT,
  tamanho_bytes BIGINT,
  duracao_ms INTEGER,
  erro TEXT
);

-- RLS para backup_logs
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de backup"
ON public.backup_logs
FOR SELECT
USING (auth.uid() IS NOT NULL);