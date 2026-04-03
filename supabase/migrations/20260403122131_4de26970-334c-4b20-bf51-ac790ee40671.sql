
-- Tabela de clientes do billing (separada dos profiles da plataforma)
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cpf TEXT,
  phone TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  platform_login TEXT UNIQUE,
  trade_name TEXT,
  cnpj TEXT,
  responsible_name TEXT,
  responsible_cpf TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_email ON public.billing_customers (email);
CREATE INDEX IF NOT EXISTS idx_billing_customers_cnpj ON public.billing_customers (cnpj) WHERE cnpj IS NOT NULL;

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.billing_customers (id) ON DELETE CASCADE,
  mp_preapproval_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'active', 'overdue', 'cancelled')),
  current_period_start DATE,
  current_period_end DATE,
  next_billing_date DATE,
  last_payment_date TIMESTAMPTZ,
  payment_fail_count INT NOT NULL DEFAULT 0,
  last_reminder_for_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer ON public.billing_subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions (status, next_billing_date, current_period_end);

-- Tabela de transações/pagamentos
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.billing_subscriptions (id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.billing_customers (id) ON DELETE SET NULL,
  mp_payment_id TEXT UNIQUE,
  amount NUMERIC(12, 2),
  status TEXT,
  payment_date TIMESTAMPTZ,
  webhook_received BOOLEAN DEFAULT false,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_mp ON public.billing_transactions (mp_payment_id);

-- Habilitar RLS em todas
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas service_role tem acesso (backend edge functions)
CREATE POLICY "Service role full access customers" ON public.billing_customers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access subscriptions" ON public.billing_subscriptions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access transactions" ON public.billing_transactions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
