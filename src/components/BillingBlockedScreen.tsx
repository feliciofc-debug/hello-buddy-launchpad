import { useNavigate } from 'react-router-dom';
import { Lock, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  expiresAt: string | null;
  customerName: string | null;
  subscriptionStatus: string | null;
  refetch: () => Promise<void>;
}

function formatDateBR(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return '—';
  }
}

export default function BillingBlockedScreen({
  expiresAt,
  customerName,
  refetch,
}: Props) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate('/login');
    }
  };

  const nome = customerName?.trim() || 'cliente';
  const dataFmt = formatDateBR(expiresAt);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-destructive/15 via-orange-500/10 to-destructive/20 flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </header>

      {/* Card central */}
      <main className="flex-1 flex items-center justify-center px-4 pb-10">
        <div className="w-full max-w-[500px] bg-card text-card-foreground rounded-2xl shadow-2xl border border-border p-8 md:p-10 text-center">
          <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="w-10 h-10 text-destructive" strokeWidth={2.5} />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Acesso suspenso
          </h1>

          <p className="text-base text-muted-foreground mb-2">
            Olá, <span className="font-semibold text-foreground">{nome}</span>.
          </p>
          <p className="text-base text-muted-foreground mb-6">
            Sua assinatura venceu em{' '}
            <span className="font-semibold text-foreground">{dataFmt}</span>.
          </p>

          <p className="text-sm text-muted-foreground mb-8">
            Para reativar seu acesso, escolha um plano abaixo.
          </p>

          <Button
            size="lg"
            className="w-full mb-3 text-base font-semibold"
            onClick={() => navigate('/planos')}
          >
            Ver Planos e Pagar
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full mb-6 text-muted-foreground"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Já paguei? Atualizar status
          </Button>

          <p className="text-xs text-muted-foreground">
            Dúvidas? WhatsApp:{' '}
            <span className="font-medium text-foreground">(21) 96752-0706</span>
          </p>
        </div>
      </main>
    </div>
  );
}
