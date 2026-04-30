CREATE OR REPLACE FUNCTION public.get_billing_subscription_status(p_subscription_id uuid)
RETURNS TABLE (
  status text,
  last_payment_date timestamptz,
  next_billing_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.status::text,
    s.last_payment_date,
    s.next_billing_date
  FROM public.billing_subscriptions s
  WHERE s.id = p_subscription_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_billing_subscription_status(uuid) TO anon, authenticated;