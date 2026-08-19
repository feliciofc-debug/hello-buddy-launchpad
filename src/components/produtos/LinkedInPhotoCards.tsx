import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImagePlus, Linkedin, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import LinkedInComposer from '@/components/produtos/LinkedInComposer';

interface Props {
  conectado: boolean;
  onPublicado: () => void;
}

interface CriativoLinkedIn {
  id: string;
  image_url: string;
  post_text_linkedin: string | null;
  created_at: string | null;
}

const MAX_IMAGE = 8 * 1024 * 1024;

export default function LinkedInPhotoCards({ conectado, onPublicado }: Props) {
  const [criativos, setCriativos] = useState<CriativoLinkedIn[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [selecionado, setSelecionado] = useState<CriativoLinkedIn | null>(null);

  const carregar = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase
      .from('social_posts_queue')
      .select('id, image_url, post_text_linkedin, created_at')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .eq('status', 'rascunho')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false });

    if (error) toast.error('Não foi possível carregar os criativos do LinkedIn');
    setCriativos(((data || []) as CriativoLinkedIn[]).filter((item) => Boolean(item.image_url)));
    setCarregando(false);
  };

  useEffect(() => {
    void carregar();
  }, []);

  const inserirCriativo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE) {
      toast.error('A imagem deve ter no máximo 8MB');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEnviando(true);
    try {
      const path = `${user.id}/linkedin/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('produto-imagens')
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('produto-imagens').getPublicUrl(path);
      const { data, error } = await supabase
        .from('social_posts_queue')
        .insert({
          user_id: user.id,
          platform: 'linkedin',
          image_url: publicData.publicUrl,
          status: 'rascunho',
          produto_source: 'linkedin_criativo',
        })
        .select('id, image_url, post_text_linkedin, created_at')
        .single();
      if (error) throw error;

      setCriativos((atual) => [data as CriativoLinkedIn, ...atual]);
      toast.success('Criativo adicionado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao inserir criativo');
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('social_posts_queue')
      .update({ status: 'cancelado' })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'rascunho');
    if (error) {
      toast.error('Erro ao excluir o criativo');
      return;
    }
    setCriativos((atual) => atual.filter((item) => item.id !== id));
    toast.success('Criativo excluído');
  };

  if (carregando) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex min-h-[360px] cursor-pointer flex-col items-center justify-center gap-4 rounded-md border-2 border-dashed border-border bg-muted/20 p-6 text-center transition-colors hover:bg-muted/50">
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={inserirCriativo}
            disabled={enviando}
          />
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            {enviando ? <Loader2 className="h-8 w-8 animate-spin" /> : <ImagePlus className="h-8 w-8" />}
          </span>
          <div>
            <p className="font-semibold">Inserir criativo</p>
            <p className="mt-1 text-sm text-muted-foreground">Adicione uma foto para criar um novo card</p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            {enviando ? 'Enviando...' : <><Upload className="h-4 w-4" /> Escolher foto</>}
          </span>
        </label>

        {criativos.map((criativo) => (
          <Card key={criativo.id} className="overflow-hidden">
            <div className="aspect-square bg-muted">
              <img src={criativo.image_url} alt="Criativo para LinkedIn" className="h-full w-full object-cover" />
            </div>
            <CardContent className="space-y-3 p-4">
              <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                {criativo.post_text_linkedin || 'Criativo pronto para receber a copy do LinkedIn.'}
              </p>
              <Button className="w-full gap-2" onClick={() => setSelecionado(criativo)} disabled={!conectado}>
                <Linkedin className="h-4 w-4" /> Postar no LinkedIn
              </Button>
              <Button variant="ghost" size="sm" className="w-full gap-2 text-destructive" onClick={() => void excluir(criativo.id)}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(selecionado)} onOpenChange={(aberto) => !aberto && setSelecionado(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Linkedin className="h-5 w-5" /> Preparar publicação</DialogTitle>
          </DialogHeader>
          {selecionado && (
            <LinkedInComposer
              midia="foto"
              conectado={conectado}
              onPublicado={() => {
                setSelecionado(null);
                void carregar();
                onPublicado();
              }}
              initialMediaUrl={selecionado.image_url}
              draftId={selecionado.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}