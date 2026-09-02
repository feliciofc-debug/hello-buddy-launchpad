import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Linkedin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import LinkedInComposer from '@/components/produtos/LinkedInComposer';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
  videoNome?: string | null;
}

export function PostarLinkedInVideoModal({ open, onOpenChange, videoUrl, videoNome }: Props) {
  const [loading, setLoading] = useState(true);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('linkedin_connections')
          .select('id, is_active')
          .eq('user_id', user.id)
          .maybeSingle();
        setConectado(Boolean(data?.is_active));
      } catch (err) {
        console.error('PostarLinkedInVideoModal:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const conectar = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-oauth-start', {
        body: { redirect_to: '/meus-produtos' },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error(data?.error || 'Não foi possível iniciar a conexão');
      window.location.href = data.auth_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao conectar LinkedIn');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-primary" /> Publicar no LinkedIn
          </DialogTitle>
          <DialogDescription>
            {videoNome ? `Vídeo: ${videoNome}` : 'Publique ou agende este vídeo no LinkedIn.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !conectado ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Linkedin className="h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              Conecte sua conta do LinkedIn para publicar este vídeo.
            </p>
            <Button onClick={conectar}>Conectar LinkedIn</Button>
          </div>
        ) : (
          <LinkedInComposer
            midia="video"
            conectado={conectado}
            initialMediaUrl={videoUrl || undefined}
            onPublicado={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
