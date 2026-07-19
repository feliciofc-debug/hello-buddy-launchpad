
CREATE OR REPLACE FUNCTION public.update_billing_subscription_amount(
  p_subscription_id UUID,
  p_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admins podem alterar valores de cobrança';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  UPDATE public.billing_subscriptions
  SET amount = p_amount,
      updated_at = now()
  WHERE id = p_subscription_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_billing_subscription_amount(UUID, NUMERIC) TO authenticated;
