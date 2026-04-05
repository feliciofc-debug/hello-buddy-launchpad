import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  link?: string | null;
  link_marketplace?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
}

export function PublicarSimultaneoModal({ open, onOpenChange, produto }: Props) {
  const link = produto.link || produto.link_marketplace || '';
  const precoFormatado = produto.preco ? `R$ ${produto.preco.toFixed(2).replace('.', ',')}` : '';
  
  const textoInicial = [
    `🔥 ${produto.nome}`,
    produto.descricao ? `\n${produto.descricao}` : '',
    precoFormatado ? `\n💰 ${precoFormatado}` : '',
    link ? `\n\n🔗 Compre aqui: ${link}` : '',
  ].filter(Boolean).join('');

  const [texto, setTexto] = useState(textoInicial);
  const [facebook, setFacebook] = useState(true);
  const [instagram, setInstagram] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  // Reset on open
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setTexto(textoInicial);
      setFacebook(true);
      setInstagram(true);
      setPublicando(false);
      setResultado(null);
    }
    onOpenChange(v);
  };

  const handlePublicar = async () => {
    if (!facebook && !instagram) {
      toast.error('Selecione pelo menos uma rede');
      return;
    }
    if (!texto.trim()) {
      toast.error('O texto não pode estar vazio');
      return;
    }

    setPublicando(true);
    setResultado(null);
    const resultados: string[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Você precisa estar logado'); setPublicando(false); return; }

      const imagemUrl = produto.imagem_url || null;
      const promises: Promise<void>[] = [];

      if (facebook) {
        promises.push((async () => {
          try {
            await supabase.from('social_posts_queue' as any).insert({
              user_id: user.id, platform: 'facebook', page_id: '855785300949909',
              post_text: texto, image_url: imagemUrl, status: 'pendente',
            } as any);
            const { error } = await supabase.functions.invoke('meta-publish-post', {
              body: { message: texto, page_id: '855785300949909', user_id: user.id, image_url: imagemUrl || undefined },
            });
            if (error) throw error;
            resultados.push('✅ Facebook OK');
          } catch (err: any) {
            resultados.push('❌ Facebook falhou');
          }
        })());
      }

      if (instagram) {
        if (!imagemUrl) {
          resultados.push('⚠️ Instagram pulado (sem imagem)');
        } else {
          promises.push((async () => {
            try {
              await supabase.from('social_posts_queue' as any).insert({
                user_id: user.id, platform: 'instagram', page_id: '855785300949909',
                post_text: texto, image_url: imagemUrl, status: 'pendente',
              } as any);
              const { data: pubData, error } = await supabase.functions.invoke('meta-publish-instagram', {
                body: { caption: texto, image_url: imagemUrl, user_id: user.id },
              });
              if (error) throw error;
              if (!pubData?.success) throw new Error(pubData?.error);
              resultados.push('✅ Instagram OK');
            } catch (err: any) {
              resultados.push('❌ Instagram falhou');
            }
          })());
        }
      }

      await Promise.all(promises);
      const msg = resultados.join(' | ');
      setResultado(msg);
      if (resultados.every(r => r.startsWith('✅'))) {
        toast.success(msg);
      } else {
        toast.warning(msg);
      }
    } catch (err: any) {
      toast.error('Erro ao publicar');
    } finally {
      setPublicando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🚀 Publicar agora — {produto.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {produto.imagem_url && (
            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-48 object-cover rounded-lg" />
          )}

          <div>
            <Label className="mb-1 block text-sm font-medium">Texto do post</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              disabled={publicando}
            />
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox id="fb" checked={facebook} onCheckedChange={(v) => setFacebook(!!v)} disabled={publicando} />
              <Label htmlFor="fb">Facebook</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ig" checked={instagram} onCheckedChange={(v) => setInstagram(!!v)} disabled={publicando} />
              <Label htmlFor="ig">Instagram</Label>
            </div>
          </div>

          {resultado && (
            <div className="p-3 rounded-lg bg-muted text-sm font-medium">{resultado}</div>
          )}

          <div className="flex gap-3 justify-end">
            {resultado ? (
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            ) : (
              <Button onClick={handlePublicar} disabled={publicando} className="bg-gradient-to-r from-blue-600 to-pink-600 hover:from-blue-700 hover:to-pink-700 text-white">
                {publicando ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando...</>
                ) : (
                  <>🚀 Publicar agora</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
