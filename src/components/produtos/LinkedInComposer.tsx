import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, X, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  midia: 'foto' | 'video';
  conectado: boolean;
  onPublicado: () => void;
  initialMediaUrl?: string;
  draftId?: string;
}

interface ProdutoOpcao {
  id: string;
  nome: string | null;
}

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const LIMITE_LINKEDIN = 3000;

export default function LinkedInComposer({ midia, conectado, onPublicado, initialMediaUrl, draftId }: Props) {
  const ehFoto = midia === 'foto';

  const [texto, setTexto] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(initialMediaUrl || null);
  const [uploading, setUploading] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [agendarEm, setAgendarEm] = useState('');
  const [agendando, setAgendando] = useState(false);

  const [tema, setTema] = useState('');
  const [produtoId, setProdutoId] = useState<string>('');
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([]);
  const [gerando, setGerando] = useState(false);
  const [opcoes, setOpcoes] = useState<Record<string, string> | null>(null);

  const inputId = `linkedin-${midia}-upload`;

  useEffect(() => {
    void carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('produtos')
      .select('id, nome')
      .eq('user_id', user.id)
      .order('nome')
      .limit(200);
    setProdutos((data as ProdutoOpcao[]) || []);
  };

  const gerarCopy = async () => {
    if (!tema.trim()) return;
    setGerando(true);
    setOpcoes(null);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-post-linkedin', {
        body: { tema, produto_id: produtoId || undefined },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Erro ao gerar copy');
      setOpcoes(data.opcoes || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar copy');
    } finally {
      setGerando(false);
    }
  };

  const escolherOpcao = (valor: string) => {
    setTexto(valor);
    setOpcoes(null);
  };

  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const limite = ehFoto ? MAX_IMAGE : MAX_VIDEO;
    if (file.size > limite) {
      toast.error(`Arquivo maior que o limite de ${Math.round(limite / 1024 / 1024)}MB`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const bucket = ehFoto ? 'produto-imagens' : 'videos';
    setUploading(true);
    try {
      const path = `${user.id}/linkedin/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setMediaUrl(data.publicUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro no upload');
    } finally {
      setUploading(false);
    }
  };

  const publicar = async () => {
    if (!texto.trim() || !conectado) return;
    setPublicando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const payload = {
        user_id: user.id,
        platform: 'linkedin',
        post_text: texto,
        post_text_linkedin: texto,
        image_url: ehFoto ? mediaUrl : null,
        video_url: ehFoto ? null : mediaUrl,
        link_url: linkUrl || null,
        status: 'pendente',
      };
      const filaQuery = draftId
        ? supabase.from('social_posts_queue').update(payload).eq('id', draftId).eq('user_id', user.id)
        : supabase.from('social_posts_queue').insert(payload);
      const { data: fila, error: filaErr } = await filaQuery.select('id').single();
      if (filaErr) throw filaErr;

      const { data, error } = await supabase.functions.invoke('linkedin-publish', {
        body: {
          texto,
          image_url: ehFoto ? (mediaUrl || undefined) : undefined,
          video_url: ehFoto ? undefined : (mediaUrl || undefined),
          link_url: linkUrl || undefined,
          queue_id: fila.id,
        },
      });
      if (error) throw error;

      if (data?.success === false) {
        await supabase
          .from('social_posts_queue')
          .update({ status: 'erro', error_message: data.error })
          .eq('id', fila.id)
          .eq('user_id', user.id);
        toast.error(data.error || 'Erro ao publicar no LinkedIn');
      } else {
        toast.success('Post publicado no LinkedIn');
        setTexto('');
        setLinkUrl('');
        setMediaUrl(null);
      }

      onPublicado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setPublicando(false);
    }
  };

  const agendar = async () => {
    if (!texto.trim() || !agendarEm) return;
    const quando = new Date(agendarEm);
    if (Number.isNaN(quando.getTime())) {
      toast.error('Data de agendamento inválida');
      return;
    }
    if (quando.getTime() < Date.now()) {
      toast.error('Escolha uma data futura');
      return;
    }

    setAgendando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const payload = {
        user_id: user.id,
        platform: 'linkedin',
        post_text: texto,
        post_text_linkedin: texto,
        image_url: ehFoto ? mediaUrl : null,
        video_url: ehFoto ? null : mediaUrl,
        link_url: linkUrl || null,
        status: 'pendente',
        scheduled_at: quando.toISOString(),
      };

      const query = draftId
        ? supabase.from('social_posts_queue').update(payload).eq('id', draftId).eq('user_id', user.id)
        : supabase.from('social_posts_queue').insert(payload);
      const { error } = await query;
      if (error) throw error;

      toast.success(`Post agendado para ${quando.toLocaleString('pt-BR')}`);
      setTexto('');
      setLinkUrl('');
      setMediaUrl(null);
      setAgendarEm('');
      onPublicado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao agendar');
    } finally {
      setAgendando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {ehFoto ? 'Novo post com imagem' : 'Novo post com vídeo'}
        </CardTitle>
        <CardDescription>
          O link entra no fim do post, antes das hashtags.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gerar copy com IA */}
        <div className="space-y-3 rounded-md border p-3">
          <Label className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Gerar copy com IA
          </Label>
          <Textarea
            rows={3}
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Sobre o que é o post? Ex: por que tanta gente confunde consórcio com financiamento"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Produto para contexto (opcional)</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome || 'Sem nome'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={gerarCopy} disabled={!tema.trim() || gerando}>
                {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Gerar 3 opções
              </Button>
            </div>
          </div>

          {opcoes && (
            <div className="space-y-2">
              {(['A', 'B', 'C'] as const).map((letra) =>
                opcoes[letra] ? (
                  <button
                    key={letra}
                    type="button"
                    onClick={() => escolherOpcao(opcoes[letra])}
                    className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors"
                  >
                    <span className="text-xs font-semibold text-primary">Opção {letra}</span>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{opcoes[letra]}</p>
                  </button>
                ) : null,
              )}
            </div>
          )}
        </div>

        <div>
          <Label>Texto do post</Label>
          <Textarea
            rows={8}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={!conectado}
            placeholder="Escreva o post..."
          />
          <p className="mt-1 text-xs text-muted-foreground text-right">
            {texto.length}/{LIMITE_LINKEDIN}
          </p>
        </div>

        <div>
          <Label>Link (opcional)</Label>
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            disabled={!conectado}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <Label>{ehFoto ? 'Imagem (até 8MB)' : 'Vídeo (até 100MB)'}</Label>
          <input
            id={inputId}
            type="file"
            accept={ehFoto ? 'image/png,image/jpeg' : 'video/mp4,video/quicktime'}
            className="hidden"
            onChange={onArquivo}
            disabled={!conectado || uploading}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={!conectado || uploading}
            onClick={() => document.getElementById(inputId)?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {ehFoto ? 'Escolher imagem' : 'Escolher vídeo'}
          </Button>
        </div>

        {mediaUrl && (
          <div className="space-y-2">
            {ehFoto ? (
              <img src={mediaUrl} alt="Prévia da imagem do post" className="max-h-64 rounded-md border" />
            ) : (
              <video src={mediaUrl} controls className="max-h-64 rounded-md border w-full" />
            )}
            <Button variant="ghost" size="sm" onClick={() => setMediaUrl(null)}>
              <X className="h-4 w-4 mr-1" /> Remover
            </Button>
          </div>
        )}

        <Button onClick={publicar} disabled={!conectado || !texto.trim() || publicando || uploading}>
          {publicando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Publicar no LinkedIn
        </Button>
      </CardContent>
    </Card>
  );
}
