import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_DOMAINS = ['@atombrasildigital.com'];

export interface BillingAccessState {
  loading: boolean;
  active: boolean;
  expiresAt: string | null;
  customerName: string | null;
  subscriptionStatus: string | null;
  refetch: () => Promise<void>;
}

// Session-level cache: 1 chamada por sessão
type CacheEntry = {
  active: boolean;
  expiresAt: string | null;
  customerName: string | null;
  subscriptionStatus: string | null;
};
const sessionCache = new Map<string, CacheEntry>();

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return ADMIN_DOMAINS.some((d) => lower.endsWith(d));
}

export function useBillingAccess(): BillingAccessState {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const emailRef = useRef<string | null>(null);

  const validate = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email ?? null;
      emailRef.current = email;

      // Admin bypass
      if (isAdminEmail(email)) {
        setActive(true);
        setExpiresAt(null);
        setCustomerName(null);
        setSubscriptionStatus('admin');
        setLoading(false);
        return;
      }

      if (!email) {
        // Sem usuário: fail-open (não bloqueia)
        setActive(true);
        setLoading(false);
        return;
      }

      // Cache por sessão
      if (!force && sessionCache.has(email)) {
        const c = sessionCache.get(email)!;
        setActive(c.active);
        setExpiresAt(c.expiresAt);
        setCustomerName(c.customerName);
        setSubscriptionStatus(c.subscriptionStatus);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('billing-validate-access', {
        body: { email, platform_login: email },
      });

      if (error) throw error;

      // FAIL-OPEN se cliente NÃO ESTÁ no sistema de billing presencial.
      // Só bloqueia clientes que TÊM subscription e estão inadimplentes.
      // Sem subscription = paga por outra via (B2B, parceiro, trial, etc.) → libera.
      const hasSubscription = !!data?.subscription_status;
      const isActive = hasSubscription ? data?.active === true : true;

      const result: CacheEntry = {
        active: isActive,
        expiresAt: data?.expires_at ?? null,
        customerName: data?.customer_name ?? null,
        subscriptionStatus: data?.subscription_status ?? null,
      };

      sessionCache.set(email, result);
      setActive(result.active);
      setExpiresAt(result.expiresAt);
      setCustomerName(result.customerName);
      setSubscriptionStatus(result.subscriptionStatus);
    } catch (err) {
      // Fail-open: erro de rede / edge function offline / JSON malformado
      console.error('[useBillingAccess] fail-open:', err);
      setActive(true);
      setExpiresAt(null);
      setCustomerName(null);
      setSubscriptionStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    if (emailRef.current) sessionCache.delete(emailRef.current);
    await validate(true);
  }, [validate]);

  useEffect(() => {
    validate(false);
  }, [validate]);

  return { loading, active, expiresAt, customerName, subscriptionStatus, refetch };
}
