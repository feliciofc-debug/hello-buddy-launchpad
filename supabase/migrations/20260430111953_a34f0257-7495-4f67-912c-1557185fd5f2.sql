CREATE OR REPLACE FUNCTION public.get_billing_pagamento_publico(p_subscription_id uuid)
RETURNS TABLE (
  amount numeric,
  next_billing_date date,
  status text,
  customer_name text,
  customer_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.amount,
    s.next_billing_date,
    s.status::text,
    c.name AS customer_name,
    c.email AS customer_email
  FROM public.billing_subscriptions s
  LEFT JOIN public.billing_customers c ON c.id = s.customer_id
  WHERE s.id = p_subscription_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_billing_pagamento_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_billing_pagamento_publico(uuid) TO anon, authenticated;