// ============================================================
// CRIAR VÍDEO DE PRODUTO (foto -> vídeo vertical 1080x1920)
//
// Custo zero por vídeo: renderiza no Remotion da nossa VPS, com
// recorte de fundo opcional feito localmente (rembg).
//
// O acompanhamento (fila, download, enviar para vídeos) continua no
// card "Vídeo animado", que lista todos os jobs de render.
//
// FASE 2 (premium com IA de vídeo) NÃO está aqui de propósito: quando
// entrar, vira um segundo botão controlado por feature flag/whitelist,
// sem mexer neste fluxo padrão.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Package, Scissors, Clapperboard, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { validarPaleta } from '@/lib/videoPalette';

type ProdutoLite = {
  id: string;
  nome: string;
  preco: number | null;
  imagem_url: string | null;
  imagens: any;
  descricao: string | null;
};

const PALETAS = {
  amz: {
    label: 'AMZ',
    cores: { bg: '#0f1720', bg2: '#1a2332', panel: '#16202c', line: '#26313f', destaque: '#FF7A1A', destaqueSoft: '#ff9e56', texto: '#f4f7fb', suave: '#93a4b8' },
  },
  claro: {
    label: 'Claro',
    cores: { bg: '#ffffff', bg2: '#f6f7f9', panel: '#ffffff', line: '#e2e5ea', destaque: '#c8102e', destaqueSoft: '#ed5368', texto: '#241b1d', suave: '#6c6f76' },
  },
  personalizada: {
    label: 'Personalizada',
    cores: { bg: '#101314', bg2: '#1b2022', panel: '#171c1e', line: '#2b3235', destaque: '#00b894', destaqueSoft: '#4fd6b8', texto: '#f2f5f6', suave: '#94a1a5' },
  },
} as const;

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const CriarVideoProduto = () => {
  const [produtos, setProdutos] = useState<ProdutoLite[]>([]);
  const [produtoId, setProdutoId] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [nome, setNome] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [bullets, setBullets] = useState(['', '', '']);
  const [precoDe, setPrecoDe] = useState('');
  const [preco, setPreco] = useState('');
  const [parcelas, setParcelas] = useState('');
  const [selo, setSelo] = useState('');
  const [ctaFrase, setCtaFrase] = useState('Chame no WhatsApp.');
  const [ctaSub, setCtaSub] = useState('');
  const [telefone, setTelefone] = useState('');
  const [marca, setMarca] = useState('');
  const [recortarFundo, setRecortarFundo] = useState(true);
  const [paletaSelecionada, setPaletaSelecionada] = useState<keyof typeof PALETAS>('amz');
  const [cores, setCores] = useState<Record<string, string>>({ ...PALETAS.amz.cores });
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('produtos')
      .select('id, nome, preco, imagem_url, imagens, descricao')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setProdutos((data ?? []) as unknown as ProdutoLite[]);
  };

  useEffect(() => { carregar(); }, []);

  const produto = useMemo(() => produtos.find((p) => p.id === produtoId) ?? null, [produtos, produtoId]);

  const imagensDoProduto = (p: ProdutoLite | null): string[] => {
    if (!p) return [];
    const extras = Array.isArray(p.imagens) ? p.imagens.filter((u: unknown) => typeof u === 'string') : [];
    return [p.imagem_url, ...extras].filter(Boolean) as string[];
  };

  const selecionarProduto = (id: string) => {
    setProdutoId(id);
    const p = produtos.find((item) => item.id === id) || null;
    const imgs = imagensDoProduto(p);
    setImagemUrl(imgs[0] ?? '');
    setNome(p?.nome ?? '');
    setSubtitulo((p?.descricao ?? '').replace(/\s+/g, ' ').slice(0, 60));
    setPreco(p?.preco ? brl(p.preco) : '');
  };

  const setCor = (chave: string, valor: string) => {
    setPaletaSelecionada('personalizada');
    setCores((atual) => ({ ...atual, [chave]: valor }));
  };

  const selecionarPaleta = (chave: keyof typeof PALETAS) => {
    setPaletaSelecionada(chave);
    setCores({ ...PALETAS[chave].cores });
  };

  const enviar = async () => {
    if (!imagemUrl) {
      toast.error('Escolha um produto com foto.');
      return;
    }
    if (nome.trim().length < 2) {
      toast.error('Informe o nome do produto.');
      return;
    }
    const erroPaleta = validarPaleta(cores);
    if (erroPaleta) {
      toast.error(erroPaleta);
      return;
    }

    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('video-produto-create', {
        body: {
          imagem_url: imagemUrl,
          produto_id: produtoId || undefined,
          marca: marca.trim() || undefined,
          formato: 'reels',
          props: {
            marca: marca.trim() || undefined,
            cores,
            produto: {
              nome: nome.trim(),
              subtitulo: subtitulo.trim() || undefined,
              bullets: bullets.map((b) => b.trim()).filter(Boolean),
              precoDe: precoDe.trim() || undefined,
              preco: preco.trim() || undefined,
              parcelas: parcelas.trim() || undefined,
              selo: selo.trim() || undefined,
              recortar_fundo: recortarFundo,
            },
            cta: {
              frase: ctaFrase.trim() || 'Fale com a gente.',
              sub: ctaSub.trim() || undefined,
              telefone: telefone.trim() || undefined,
            },
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não consegui enfileirar o vídeo');
      toast.success(
        `Vídeo na fila (posição ${data.posicao_fila}). Duração estimada: ${data.duracao_estimada}s. Acompanhe em "Vídeo animado".`,
      );
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar o vídeo do produto');
    } finally {
      setEnviando(false);
    }
  };

  const imagens = imagensDoProduto(produto);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Vídeo de produto
          <Badge variant="secondary" className="ml-1">Custo zero</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Uma foto do catálogo vira um vídeo vertical 1080x1920 para Reels, Stories e TikTok.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Produto</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={produtoId}
              onChange={(e) => selecionarProduto(e.target.value)}
            >
              <option value="">Selecione um produto…</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            {produtos.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum produto cadastrado ainda. Cadastre um produto com foto na aba Produtos.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Foto usada no vídeo</Label>
            <div className="flex gap-2 flex-wrap">
              {imagens.length === 0 && (
                <span className="text-xs text-muted-foreground">Selecione um produto com foto.</span>
              )}
              {imagens.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setImagemUrl(url)}
                  className={`h-16 w-16 rounded-md overflow-hidden border-2 ${imagemUrl === url ? 'border-primary' : 'border-transparent'}`}
                >
                  <img src={url} alt="Foto do produto" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border p-3">
          <Checkbox
            id="recortar-fundo"
            checked={recortarFundo}
            onCheckedChange={(v) => setRecortarFundo(v === true)}
          />
          <div className="space-y-1">
            <Label htmlFor="recortar-fundo" className="flex items-center gap-2 cursor-pointer">
              <Scissors className="h-4 w-4" /> Recortar o fundo do produto
            </Label>
            <p className="text-xs text-muted-foreground">
              O produto sai sobre fundo da sua marca, com sombra e reflexo. Se o recorte não funcionar
              nessa foto, o vídeo continua sendo gerado com a própria foto desfocada ao fundo.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome que aparece no vídeo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={46} placeholder="Ex.: Honda Civic 2022" />
          </div>
          <div className="space-y-2">
            <Label>Linha de apoio (opcional)</Label>
            <Input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} maxLength={60} placeholder="Ex.: Automático, único dono" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Destaques (até 3)</Label>
          <div className="grid gap-2 md:grid-cols-3">
            {bullets.map((b, i) => (
              <Input
                key={i}
                value={b}
                maxLength={40}
                placeholder={['Ex.: 38.000 km', 'Ex.: Único dono', 'Ex.: Garantia de fábrica'][i]}
                onChange={(e) => setBullets((atual) => atual.map((v, j) => (j === i ? e.target.value : v)))}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Preço antigo</Label>
            <Input value={precoDe} onChange={(e) => setPrecoDe(e.target.value)} placeholder="R$ 1.290" />
          </div>
          <div className="space-y-2">
            <Label>Preço</Label>
            <Input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="899,90" />
          </div>
          <div className="space-y-2">
            <Label>Condição</Label>
            <Input value={parcelas} onChange={(e) => setParcelas(e.target.value)} placeholder="12x sem juros" />
          </div>
          <div className="space-y-2">
            <Label>Selo</Label>
            <Input value={selo} onChange={(e) => setSelo(e.target.value)} placeholder="Novidade" maxLength={20} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Chamada final</Label>
            <Input value={ctaFrase} onChange={(e) => setCtaFrase(e.target.value)} maxLength={42} />
          </div>
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input value={ctaSub} onChange={(e) => setCtaSub(e.target.value)} maxLength={50} placeholder="Estoque limitado" />
          </div>
          <div className="space-y-2">
            <Label>Telefone / WhatsApp</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(21) 99999-0000" />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Cores e marca</Label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(PALETAS) as (keyof typeof PALETAS)[]).map((chave) => (
              <Button
                key={chave}
                type="button"
                size="sm"
                variant={paletaSelecionada === chave ? 'default' : 'outline'}
                onClick={() => selecionarPaleta(chave)}
              >
                {PALETAS[chave].label}
              </Button>
            ))}
            <Input
              className="w-48"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Marca (sigla no CTA)"
              maxLength={18}
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            {['bg', 'bg2', 'destaque', 'texto'].map((chave) => (
              <label key={chave} className="flex items-center gap-2 text-xs text-muted-foreground">
                {chave}
                <input
                  type="color"
                  value={cores[chave]}
                  onChange={(e) => setCor(chave, e.target.value)}
                  className="h-8 w-10 rounded border"
                />
              </label>
            ))}
          </div>
        </div>

        <Button onClick={enviar} disabled={enviando || !imagemUrl} className="w-full">
          {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
          Gerar vídeo do produto
        </Button>
        <p className="text-xs text-muted-foreground">
          A logo ativa da sua conta é aplicada automaticamente, e a trilha padrão da empresa entra no
          áudio quando existir. O render leva de 1 a 4 minutos na fila.
        </p>
      </CardContent>
    </Card>
  );
};
