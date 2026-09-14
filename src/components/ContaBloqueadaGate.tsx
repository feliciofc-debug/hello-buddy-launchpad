import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Trava global de conta encerrada/bloqueada.
 *
 * Ao detectar sessão de um usuário com profiles.acesso_bloqueado = true,
 * encerra a sessão e mostra a tela de conta encerrada em qualquer rota.
 */
export default function ContaBloqueadaGate({ children }: { children: React.ReactNode }) {
  const [bloqueado, setBloqueado] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    const verificar = async (userId?: string | null) => {
      if (!userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('acesso_bloqueado, motivo_bloqueio')
        .eq('id', userId)
        .maybeSingle();

      if (cancelado) return;
      if (data?.acesso_bloqueado) {
        setMotivo(data.motivo_bloqueio ?? null);
        setBloqueado(true);
        await supabase.auth.signOut();
      }
    };

    supabase.auth.getSession().then(({ data }) => verificar(data.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        verificar(session?.user?.id);
      }
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (bloqueado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-4 rounded-xl border border-border bg-card p-8">
          <h1 className="text-2xl font-semibold text-foreground">Acesso encerrado</h1>
          <p className="text-muted-foreground">
            Esta conta foi encerrada e não tem mais acesso à plataforma.
          </p>
          {motivo && <p className="text-sm text-muted-foreground">{motivo}</p>}
          <p className="text-sm text-muted-foreground">
            Em caso de dúvida, fale com o suporte.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
