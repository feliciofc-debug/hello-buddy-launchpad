-- Tabela para mapear clientes às instâncias Wuzapi
CREATE TABLE public.wuzapi_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL UNIQUE,
  wuzapi_url TEXT NOT NULL,
  wuzapi_token TEXT NOT NULL,
  port INTEGER NOT NULL,
  assigned_to_user UUID REFERENCES auth.users(id),
  is_connected BOOLEAN DEFAULT false,
  phone_number TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_wuzapi_user ON wuzapi_instances(assigned_to_user);
CREATE INDEX idx_wuzapi_available ON wuzapi_instances(assigned_to_user) 
  WHERE assigned_to_user IS NULL;

-- Enable RLS
ALTER TABLE public.wuzapi_instances ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own instance"
ON public.wuzapi_instances FOR SELECT
USING (auth.uid() = assigned_to_user OR assigned_to_user IS NULL);

CREATE POLICY "System can manage instances"
ON public.wuzapi_instances FOR ALL
USING (true);

-- Popular com as 9 instâncias disponíveis
INSERT INTO public.wuzapi_instances (instance_name, wuzapi_url, wuzapi_token, port) VALUES
('amz-01', 'http://191.252.193.73:8081', 'df150d4369eb06079077894d86056d7a', 8081),
('amz-02', 'http://191.252.193.73:8082', '493a621997e4e75bd4635568e041c620', 8082),
('amz-03', 'http://191.252.193.73:8083', '0768ab3ce099c3624c0ca6b240612063', 8083),
('amz-04', 'http://191.252.193.73:8084', 'b780fcaedb40013173fae26945eade84', 8084),
('amz-06', 'http://191.252.193.73:8086', 'b8d68a1c6dafa7080517182a546abaee', 8086),
('amz-07', 'http://191.252.193.73:8087', '061ec188d65c0b7cce39215945b4b536', 8087),
('amz-08', 'http://191.252.193.73:8088', '7fcd2cdc6231f747d58689c14058d2d0', 8088),
('amz-09', 'http://191.252.193.73:8089', '0f4194e39647baa6bf28204c81fae5e4', 8089);