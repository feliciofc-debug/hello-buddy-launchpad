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
import { Loader2, Package, Scissors, Clapperboard, Palette, Globe } from 'lucide-react';
import { ImportarDoSiteModal, type IdentidadeImportada } from '@/components/ImportarDoSiteModal';
import { readAmzAutoModePreference } from '@/lib/amz-auto-mode';
import { formatTelefoneBR } from '@/lib/vehicle-video-format';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { validarPaleta } from '@/lib/videoPalette';
import {
  type VehicleVideoStockRow,
  publicVehicleStockPhotos,
  vehicleVideoDisplayTitle,
  vehicleVideoPriceForOverlay,
  vehicleVideoStudioChips,
  vehicleVideoStudioTitle,
} from '@/lib/vehicle-video-source-adapter';

type ProdutoLite = {
  id: string;
  nome: string;
  preco: number | null;
  imagem_url: string | null;
  imagens: any;
  descricao: string | null;
};

const PALETA_ESTUDIO_VEICULO = {
  bg: '#F8F9FA',
  bg2: '#EEF0F2',
  panel: '#FFFFFF',
  line: '#D8DCE0',
  destaque: '#F26B1D',
  destaqueSoft: '#FF8F4D',
  texto: '#111111',
  suave: '#4B5563',
} as const;

const PALETAS = {
  estudio: {
    label: 'Estúdio',
    cores: { ...PALETA_ESTUDIO_VEICULO },
  },
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

export type CriarVideoProdutoProps = {
  entitySource?: 'produto' | 'veiculo';
  fixedVeiculoId?: string;
  lojaNome?: string;
  onVeiculoJobQueued?: (jobId: string) => void;
};

export const CriarVideoProduto = ({
  entitySource = 'produto',
  fixedVeiculoId,
  lojaNome = '',
  onVeiculoJobQueued,
}: CriarVideoProdutoProps = {}) => {
  const isVeiculo = entitySource === 'veiculo';
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
  const [paletaSelecionada, setPaletaSelecionada] = useState<keyof typeof PALETAS>(
    isVeiculo ? 'estudio' : 'amz',
  );
  const [cores, setCores] = useState<Record<string, string>>(
    isVeiculo ? { ...PALETAS.estudio.cores } : { ...PALETAS.amz.cores },
  );
  const [enviando, setEnviando] = useState(false);
  const [veiculos, setVeiculos] = useState<VehicleVideoStockRow[]>([]);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [identidadeCliente, setIdentidadeCliente] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [subindoLogo, setSubindoLogo] = useState(false);

  const carregar = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (isVeiculo) {
      const { data } = await supabase
        .from('veiculos_estoque')
        .select(
          'id, marca, modelo, versao, ano_fabricacao, ano_modelo, km, cambio, cor, combustivel, opcionais, caracteristicas, descricao, preco, fotos, status',
        )
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      const lista = ((data ?? []) as VehicleVideoStockRow[]).filter(
        (v) => publicVehicleStockPhotos(v).length > 0 && v.status !== 'vendido',
      );
      setVeiculos(lista);
      if (fixedVeiculoId && lista.some((v) => v.id === fixedVeiculoId)) {
        selecionarVeiculo(fixedVeiculoId, lista);
      }
      return;
    }
    const { data } = await supabase
      .from('produtos')
      .select('id, nome, preco, imagem_url, imagens, descricao')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setProdutos((data ?? []) as unknown as ProdutoLite[]);
  };

  const selecionarVeiculo = (id: string, lista = veiculos) => {
    setProdutoId(id);
    const v = lista.find((item) => item.id === id) || null;
    const imgs = publicVehicleStockPhotos(v ?? { fotos: [] });
    setImagemUrl(imgs[0] ?? '');
    if (v) {
      const { nome, subtitulo: sub } = vehicleVideoStudioTitle(v);
      setNome(nome);
      setSubtitulo(sub);
      const chips = vehicleVideoStudioChips(v);
      setBullets([chips[0] ?? '', chips[1] ?? '', chips[2] ?? '', chips[3] ?? '']);
    } else {
      setNome('');
      setSubtitulo('');
      setBullets(['', '', '']);
    }
    setMarca(lojaNome.trim());
    const { precoLabel } = v ? vehicleVideoPriceForOverlay(v) : { precoLabel: null };
    setPreco(precoLabel ? precoLabel.replace(/^R\$\s*/, '') : '');
    setPrecoDe('');
    setCtaFrase('Chama no WhatsApp');
  };

  const handleLogo = async (file: File, opcoes?: { definirComoMarca?: boolean }) => {
    const definirComoMarca = opcoes?.definirComoMarca !== false;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      toast.error('Use uma imagem PNG, JPEG ou WEBP de até 5MB.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubindoLogo(true);
    try {
      const nomeArq = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
      const novoPath = definirComoMarca
        ? `${user.id}/incoming/${Date.now()}-${nomeArq}`
        : `${user.id}/video-site/${Date.now()}-${nomeArq}`;
      const { error: uploadError } = await supabase.storage.from('tenant-logos').upload(novoPath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      let selectedPath = novoPath;
      if (definirComoMarca) {
        const { data: managed, error: manageError } = await supabase.functions.invoke('manage-tenant-logo', {
          body: {
            action: 'set',
            storage_path: novoPath,
            file_name: file.name,
            mime_type: file.type,
            variant: 'default',
          },
        });
        if (manageError || !managed?.ok) {
          await supabase.storage.from('tenant-logos').remove([novoPath]);
          throw manageError || new Error(managed?.error || 'Falha ao processar a logo');
        }
        const videoLogo = managed.logos?.find((item: { variant?: string }) => item.variant === 'video');
        const defaultLogo = managed.logos?.find((item: { variant?: string }) => item.variant === 'default');
        selectedPath = videoLogo?.storage_path || defaultLogo?.storage_path;
        if (!selectedPath) throw new Error('Logo processada sem arquivo');
      }

      const { data: signed } = await supabase.storage.from('tenant-logos').createSignedUrl(selectedPath, 3600);
      setLogoPath(selectedPath);
      setLogoUrl(signed?.signedUrl ?? null);
      toast.success(definirComoMarca ? 'Logo da loja anexada.' : 'Logo aplicada a este vídeo.');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível anexar a logo.');
    } finally {
      setSubindoLogo(false);
    }
  };

  const aplicarIdentidadeDoSite = async (d: IdentidadeImportada) => {
    setIdentidadeCliente(true);
    const novas = { ...PALETA_ESTUDIO_VEICULO, ...d.paleta };
    setPaletaSelecionada('estudio');
    setCores(novas);
    if (d.nome_empresa) setMarca(d.nome_empresa);
    const fonte = d.logo_data_url || null;
    if (fonte) {
      try {
        const resp = await fetch(fonte);
        const blob = await resp.blob();
        const tipo = blob.type || 'image/png';
        const ext = tipo.split('/')[1]?.replace('svg+xml', 'svg') || 'png';
        await handleLogo(new File([blob], `logo-site.${ext}`, { type: tipo }), { definirComoMarca: false });
      } catch {
        toast.info('Não consegui aplicar a logo do site. Anexe o arquivo manualmente.');
      }
    }
    toast.success('Identidade do site aplicada ao vídeo do veículo.');
  };

  const carregarContatoLoja = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: profile }, { data: empresa }] = await Promise.all([
      supabase.from('profiles').select('whatsapp, nome_fantasia, nome').eq('id', user.id).maybeSingle(),
      supabase.from('empresa_config').select('site_url, identidade_site').eq('user_id', user.id).maybeSingle(),
    ]);
    const p = profile as { whatsapp?: string; nome_fantasia?: string; nome?: string } | null;
    if (p?.whatsapp && !telefone.trim()) {
      setTelefone(formatTelefoneBR(String(p.whatsapp)));
    }
    if (isVeiculo && !marca.trim()) {
      setMarca(String(p?.nome_fantasia || p?.nome || lojaNome || '').trim());
    }
    const site = (empresa as { site_url?: string } | null)?.site_url;
    if (site && isVeiculo) {
      // site fica disponível para próximos envios via props se necessário
    }
  };

  useEffect(() => { carregar(); }, [isVeiculo, fixedVeiculoId]);

  useEffect(() => {
    if (isVeiculo) void carregarContatoLoja();
  }, [isVeiculo]);

  useEffect(() => {
    if (!isVeiculo || !readAmzAutoModePreference() || logoPath) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/amz-auto-mark-512.png');
        if (!resp.ok || cancelled) return;
        const blob = await resp.blob();
        await handleLogo(new File([blob], 'amz-auto-mark-512.png', { type: blob.type || 'image/png' }), {
          definirComoMarca: false,
        });
      } catch {
        /* opcional */
      }
    })();
    return () => { cancelled = true; };
  }, [isVeiculo]);

  useEffect(() => {
    if (isVeiculo && fixedVeiculoId && veiculos.length) {
      selecionarVeiculo(fixedVeiculoId, veiculos);
    }
  }, [fixedVeiculoId, isVeiculo, veiculos]);

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
      toast.error(isVeiculo ? 'Escolha um veículo com foto.' : 'Escolha um produto com foto.');
      return;
    }
    if (nome.trim().length < 2) {
      toast.error(isVeiculo ? 'Informe marca e modelo do veículo.' : 'Informe o nome do produto.');
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
          produto_id: isVeiculo ? undefined : (produtoId || undefined),
          veiculo_id: isVeiculo ? (produtoId || undefined) : undefined,
          marca: marca.trim() || undefined,
          formato: 'reels',
          logo_path: isVeiculo ? logoPath : undefined,
          sem_logo_tenant: isVeiculo ? identidadeCliente : undefined,
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
      if (isVeiculo && data?.job_id && onVeiculoJobQueued) {
        onVeiculoJobQueued(String(data.job_id));
      }
      toast.success(
        isVeiculo
          ? `Vídeo na fila (posição ${data.posicao_fila}). Leva cerca de 3 a 5 minutos — acompanhe o card acima.`
          : `Vídeo na fila (posição ${data.posicao_fila}). Duração estimada: ${data.duracao_estimada}s. Acompanhe em "Vídeo animado".`,
      );
    } catch (e: any) {
      toast.error(e?.message || (isVeiculo ? 'Erro ao criar o vídeo do veículo' : 'Erro ao criar o vídeo do produto'));
    } finally {
      setEnviando(false);
    }
  };

  const veiculoSel = isVeiculo ? veiculos.find((v) => v.id === produtoId) ?? null : null;
  const imagens = isVeiculo
    ? publicVehicleStockPhotos(veiculoSel ?? { fotos: [] })
    : imagensDoProduto(produto);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          {isVeiculo ? 'Vídeo do veículo (foto + recorte)' : 'Vídeo de produto'}
          <Badge variant="secondary" className="ml-1">Custo zero</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isVeiculo
            ? 'Uma foto do estoque vira vídeo vertical com recorte de fundo, textos do carro e logo da loja.'
            : 'Uma foto do catálogo vira um vídeo vertical 1080x1920 para Reels, Stories e TikTok.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{isVeiculo ? 'Veículo' : 'Produto'}</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={produtoId}
              onChange={(e) => (isVeiculo ? selecionarVeiculo(e.target.value) : selecionarProduto(e.target.value))}
            >
              <option value="">{isVeiculo ? 'Selecione um veículo…' : 'Selecione um produto…'}</option>
              {isVeiculo
                ? veiculos.map((v) => (
                  <option key={v.id} value={v.id}>{vehicleVideoDisplayTitle(v)}</option>
                ))
                : produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
            </select>
            {!isVeiculo && produtos.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum produto cadastrado ainda. Cadastre um produto com foto na aba Produtos.
              </p>
            )}
            {isVeiculo && veiculos.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum veículo com foto pública no estoque.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Foto usada no vídeo</Label>
            <div className="flex gap-2 flex-wrap">
              {imagens.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {isVeiculo ? 'Escolha um veículo com foto.' : 'Selecione um produto com foto.'}
                </span>
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
              <Scissors className="h-4 w-4" />
              {isVeiculo ? 'Recortar o fundo do veículo' : 'Recortar o fundo do produto'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isVeiculo
                ? 'Fundo cinza-claro de estúdio, cor real do carro preservada (sem brilho laranja). Sombra e reflexo neutros sob o veículo.'
                : 'O produto sai sobre fundo da sua marca, com sombra e reflexo. Se o recorte não funcionar nessa foto, o vídeo continua sendo gerado com a própria foto desfocada ao fundo.'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome que aparece no vídeo</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={isVeiculo ? 56 : 46}
              placeholder={isVeiculo ? 'Ex.: Range Rover Evoque' : 'Ex.: Honda Civic 2022'}
            />
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
          <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> {isVeiculo ? 'Identidade da loja' : 'Cores e marca'}</Label>
          {isVeiculo && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={paletaSelecionada === 'estudio' ? 'default' : 'outline'}
                  onClick={() => selecionarPaleta('estudio')}
                >
                  Estúdio (padrão)
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setImportarAberto(true)}>
                  <Globe className="mr-2 h-4 w-4" />
                  Buscar identidade pelo site
                </Button>
              </div>
              <ImportarDoSiteModal
                aberto={importarAberto}
                onFechar={() => setImportarAberto(false)}
                modo="video"
                onConfirmar={aplicarIdentidadeDoSite}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  className="max-w-xs"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Nome da loja no vídeo"
                  maxLength={40}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Cor da marca
                  <input
                    type="color"
                    value={cores.destaque}
                    onChange={(e) => setCor('destaque', e.target.value)}
                    className="h-8 w-10 rounded border"
                    aria-label="Cor principal"
                  />
                </label>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo da loja" className="h-10 max-w-[120px] object-contain rounded border bg-white p-1" />
                ) : null}
                <Button type="button" size="sm" variant="outline" disabled={subindoLogo} asChild>
                  <label className="cursor-pointer">
                    {subindoLogo ? 'Enviando…' : 'Anexar logo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleLogo(f, { definirComoMarca: !identidadeCliente });
                      }}
                    />
                  </label>
                </Button>
              </div>
            </div>
          )}
          {!isVeiculo && (
            <>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(PALETAS) as (keyof typeof PALETAS)[]).filter((k) => k !== 'estudio').map((chave) => (
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
            </>
          )}
        </div>

        <Button onClick={enviar} disabled={enviando || !imagemUrl} className="w-full">
          {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
          {isVeiculo ? 'Gerar vídeo do veículo' : 'Gerar vídeo do produto'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {isVeiculo
            ? 'Template estúdio (fundo claro). Logo da loja no topo e no final; trilha padrão quando existir. Render ~3–5 min.'
            : 'A logo ativa da sua conta é aplicada automaticamente, e a trilha padrão da empresa entra no áudio quando existir. O render leva de 1 a 4 minutos na fila.'}
        </p>
      </CardContent>
    </Card>
  );
};
