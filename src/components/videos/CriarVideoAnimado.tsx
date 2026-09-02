// ============================================================
// CRIAR VÍDEO ANIMADO (motion) — template "Agente no WhatsApp".
// Fluxo: tema -> IA gera o roteiro -> usuário edita -> fila de render.
// O MP4 renderizado cai na biblioteca de vídeos (bucket videos).
// ============================================================

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Clapperboard, Wand2, Clock, Download, RefreshCw, Upload, Palette, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { validarPaleta } from '@/lib/videoPalette';

type Mensagem = { de: 'dono' | 'agente'; texto: string };

type MotionProps = {
  marca: string;
  logoUrl?: string;
  logo_path?: string;
  site?: string;
  cores: Record<string, string>;
  hook: { kicker: string; linhas: string[]; destaque?: string; sub?: string };
  chat: { titulo: string; tituloDestaque?: string; mensagens: Mensagem[] };
  cta: { frase: string; sub?: string; telefone?: string; consultor?: string };
  legendas: string[];
};

type Job = {
  id: string;
  titulo: string | null;
  status: string;
  legenda_post: string | null;
  resultado_bucket: string | null;
  resultado_path: string | null;
  duracao_segundos: number | null;
  erro_mensagem: string | null;
  created_at: string;
};


const PALETAS = {
  amz: {
    label: 'AMZ',
    cores: { bg: '#0f1720', bg2: '#1a2332', panel: '#16202c', line: '#26313f', destaque: '#FF7A1A', destaqueSoft: '#ff9e56', texto: '#f4f7fb', suave: '#93a4b8' },
  },
  ademicon: {
    label: 'Ademicon',
    cores: { bg: '#ffffff', bg2: '#fff7f8', panel: '#ffffff', line: '#ead9dc', destaque: '#c8102e', destaqueSoft: '#ed5368', texto: '#241b1d', suave: '#75666a' },
  },
  personalizada: {
    label: 'Personalizada',
    cores: { bg: '#ffffff', bg2: '#f5f5f5', panel: '#ffffff', line: '#dedede', destaque: '#c8102e', destaqueSoft: '#ed5368', texto: '#241b1d', suave: '#75666a' },
  },
} as const;

const STATUS: Record<string, { label: string; cor: string }> = {
  pendente: { label: 'Na fila', cor: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
  processando: { label: 'Renderizando', cor: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  aguardando_aprovacao: { label: 'Aguardando aprovação', cor: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  concluido: { label: 'Pronto', cor: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  falha: { label: 'Falhou', cor: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  falha_definitiva: { label: 'Falhou', cor: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  cancelado: { label: 'Cancelado', cor: 'bg-muted text-muted-foreground' },
};

export const CriarVideoAnimado = () => {
  const [tema, setTema] = useState('');
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [props, setProps] = useState<MotionProps | null>(null);
  const [legendaPost, setLegendaPost] = useState('');
  const [duracao, setDuracao] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [subindoLogo, setSubindoLogo] = useState(false);
  const [paletaSelecionada, setPaletaSelecionada] = useState<keyof typeof PALETAS>('personalizada');
  const [cores, setCores] = useState<Record<string, string>>(PALETAS.personalizada.cores);

  const carregarMarca = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('tenant_logos')
      .select('storage_path')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .maybeSingle();
    const path = data?.storage_path;
    if (!path || !path.startsWith(`${user.id}/`)) return;
    const { data: signed } = await supabase.storage.from('tenant-logos').createSignedUrl(path, 3600);
    setLogoPath(path);
    setLogoUrl(signed?.signedUrl ?? null);
  };

  const handleLogo = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      toast.error('Use uma imagem PNG, JPEG ou WEBP de até 5MB.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubindoLogo(true);
    try {
      const nome = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
      const novoPath = `${user.id}/${Date.now()}-${nome}`;
      const { error: uploadError } = await supabase.storage.from('tenant-logos').upload(novoPath, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: deleteError } = await supabase.from('tenant_logos').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from('tenant_logos').insert({ user_id: user.id, storage_path: novoPath, file_name: file.name, mime_type: file.type, ativo: true });
      if (insertError) throw insertError;
      if (logoPath) await supabase.storage.from('tenant-logos').remove([logoPath]);
      const { data: signed } = await supabase.storage.from('tenant-logos').createSignedUrl(novoPath, 3600);
      setLogoPath(novoPath);
      setLogoUrl(signed?.signedUrl ?? null);
      toast.success('Logo do cliente anexada.');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível anexar a logo.');
    } finally {
      setSubindoLogo(false);
    }
  };

  const selecionarPaleta = (nome: keyof typeof PALETAS) => {
    setPaletaSelecionada(nome);
    setCores({ ...PALETAS[nome].cores });
    setProps((p) => (p ? { ...p, cores: { ...PALETAS[nome].cores } } : p));
  };

  const setCor = (nome: string, valor: string) => {
    setPaletaSelecionada('personalizada');
    setCores((atual) => ({ ...atual, [nome]: valor }));
    setProps((p) => (p ? { ...p, cores: { ...p.cores, [nome]: valor } } : p));
  };

  const [baixando, setBaixando] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const cancelarVideo = async (jobId: string) => {
    setCancelando(jobId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão não encontrada');

      const { data, error } = await supabase
        .from('video_motion_jobs')
        .update({ status: 'cancelado', claimed_at: null })
        .eq('id', jobId)
        .eq('user_id', user.id)
        .in('status', ['pendente', 'processando'])
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        await carregarJobs();
        toast.info('O vídeo já havia terminado ou sido cancelado.');
        return;
      }

      setJobs((atuais) => atuais.map((job) => (
        job.id === jobId ? { ...job, status: 'cancelado' } : job
      )));
      toast.success('Renderização cancelada.');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível cancelar o vídeo.');
    } finally {
      setCancelando(null);
    }
  };

  const baixarVideo = async (j: Job, url: string) => {
    setBaixando(j.id);
    try {
      let blob: Blob | null = null;
      if (j.resultado_bucket && j.resultado_path) {
        const { data } = await supabase.storage.from(j.resultado_bucket).download(j.resultado_path);
        blob = data ?? null;
      }
      if (!blob) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Não consegui baixar o arquivo');
        blob = await resp.blob();
      }
      const nome = `${(j.titulo || 'video-animado').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.mp4`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success('Vídeo salvo no seu computador');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar o vídeo');
    } finally {
      setBaixando(null);
    }
  };

  const carregarJobs = async () => {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('video_motion_jobs')
      .select('id, titulo, status, legenda_post, resultado_bucket, resultado_path, duracao_segundos, erro_mensagem, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);
    const lista = (data ?? []) as Job[];
    setJobs(lista);

    const novas: Record<string, string> = {};
    for (const j of lista) {
      if (j.resultado_bucket && j.resultado_path) {
        const { data: pub } = supabase.storage.from(j.resultado_bucket).getPublicUrl(j.resultado_path);
        if (pub?.publicUrl) novas[j.id] = pub.publicUrl;
      }
    }
    setUrls(novas);
  };

  useEffect(() => {
    carregarMarca();
    carregarJobs();
    const t = setInterval(carregarJobs, 15000);
    return () => clearInterval(t);
  }, []);

  const gerarRoteiro = async () => {
    if (tema.trim().length < 4) {
      toast.error('Descreva o tema do vídeo');
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('video-motion-create', {
        body: { tema: tema.trim(), apenas_roteiro: true, cores },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não consegui gerar o roteiro');
      setProps({ ...data.props, logoUrl: logoUrl ?? undefined, cores: { ...cores } });
      setLegendaPost(data.legenda_post || '');
      setDuracao(data.duracao_estimada ?? null);
      toast.success(data.usou_ia ? '✨ Roteiro gerado! Revise e ajuste.' : 'Roteiro base criado. Revise os textos.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar roteiro');
    } finally {
      setGerando(false);
    }
  };

  const enviarParaFila = async () => {
    if (!props) return;
    const erroPaleta = validarPaleta(props.cores);
    if (erroPaleta) {
      toast.error(erroPaleta);
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('video-motion-create', {
        body: { tema: tema.trim(), props, legenda_post: legendaPost, formato: 'reels' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não consegui enfileirar');
      toast.success(`🎬 Vídeo na fila (posição ${data.posicao_fila}). Te aviso quando ficar pronto.`);
      setProps(null);
      setTema('');
      carregarJobs();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar para a fila');
    } finally {
      setEnviando(false);
    }
  };

  const setHook = (campo: string, valor: string) =>
    setProps((p) => (p ? { ...p, hook: { ...p.hook, [campo]: valor } } : p));

  const setLinha = (i: number, valor: string) =>
    setProps((p) => {
      if (!p) return p;
      const linhas = [...p.hook.linhas];
      linhas[i] = valor;
      return { ...p, hook: { ...p.hook, linhas } };
    });

  const setMensagem = (i: number, valor: string) =>
    setProps((p) => {
      if (!p) return p;
      const mensagens = p.chat.mensagens.map((m, idx) => (idx === i ? { ...m, texto: valor } : m));
      return { ...p, chat: { ...p.chat, mensagens } };
    });

  const setLegenda = (i: number, valor: string) =>
    setProps((p) => {
      if (!p) return p;
      const legendas = [...p.legendas];
      legendas[i] = valor;
      return { ...p, legendas };
    });

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clapperboard className="h-5 w-5 text-primary" />
          Criar vídeo animado com IA
          <Badge variant="secondary" className="ml-1">sem custo de vídeo</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <Label className="font-semibold">Identidade do cliente</Label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(PALETAS) as Array<keyof typeof PALETAS>).map((nome) => (
              <Button key={nome} type="button" variant={paletaSelecionada === nome ? 'default' : 'outline'} onClick={() => selecionarPaleta(nome)} className="justify-start">
                <span className="mr-2 h-4 w-4 rounded-full border" style={{ backgroundColor: PALETAS[nome].cores.destaque }} />
                {PALETAS[nome].label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['bg', 'bg2', 'destaque', 'destaqueSoft'] as const).map((nome) => (
              <label key={nome} className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="color" value={cores[nome]} onChange={(e) => setCor(nome, e.target.value)} className="h-8 w-10 cursor-pointer rounded border bg-background p-1" aria-label={`Cor ${nome}`} />
                {nome === 'destaque' ? 'Principal' : nome === 'destaqueSoft' ? 'Apoio' : nome === 'bg' ? 'Fundo' : 'Fundo 2'}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" id="motion-logo-upload" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogo(file); e.currentTarget.value = ''; }} />
            <Button type="button" variant="outline" disabled={subindoLogo} onClick={() => document.getElementById('motion-logo-upload')?.click()}>
              {subindoLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {logoUrl ? 'Trocar logo' : 'Anexar logo do cliente'}
            </Button>
            {logoUrl && <img src={logoUrl} alt="Logo do cliente" className="h-10 max-w-[160px] rounded border bg-background object-contain p-1" />}
            <span className="text-xs text-muted-foreground">A logo e as cores escolhidas serão usadas no vídeo.</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sobre o que é o vídeo?</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex.: atendimento e orçamento pelo WhatsApp em minutos"
              onKeyDown={(e) => { if (e.key === 'Enter') gerarRoteiro(); }}
            />
            <Button onClick={gerarRoteiro} disabled={gerando} className="shrink-0">
              {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Gerar roteiro
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A IA usa os dados da sua empresa (segmento, diferenciais e produtos) para escrever os textos.
          </p>
        </div>

        {props && (
          <div className="space-y-5 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Wand2 className="h-4 w-4" /> Revise os textos
              </h4>
              {duracao ? (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" /> ~{duracao}s • 1080x1920
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Abertura (etiqueta)</Label>
                <Input value={props.hook.kicker} onChange={(e) => setHook('kicker', e.target.value)} maxLength={28} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marca no logo</Label>
                <Input
                  value={props.marca}
                  onChange={(e) => setProps((p) => (p ? { ...p, marca: e.target.value } : p))}
                  maxLength={12}
                />
              </div>
              {props.hook.linhas.map((l, i) => (
                <div key={`linha-${i}`} className="space-y-1">
                  <Label className="text-xs">Título linha {i + 1}</Label>
                  <Input value={l} onChange={(e) => setLinha(i, e.target.value)} maxLength={22} />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Destaque (laranja)</Label>
                <Input value={props.hook.destaque || ''} onChange={(e) => setHook('destaque', e.target.value)} maxLength={22} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Subtítulo</Label>
                <Textarea value={props.hook.sub || ''} onChange={(e) => setHook('sub', e.target.value)} rows={2} maxLength={90} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Conversa no celular</Label>
              {props.chat.mensagens.map((m, i) => (
                <div key={`msg-${i}`} className="flex items-start gap-2">
                  <Badge variant={m.de === 'dono' ? 'default' : 'secondary'} className="mt-2 shrink-0">
                    {m.de === 'dono' ? 'Cliente' : 'Agente'}
                  </Badge>
                  <Textarea value={m.texto} onChange={(e) => setMensagem(i, e.target.value)} rows={2} maxLength={110} />
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Fechamento</Label>
                <Input
                  value={props.cta.frase}
                  onChange={(e) => setProps((p) => (p ? { ...p, cta: { ...p.cta, frase: e.target.value } } : p))}
                  maxLength={46}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Site / contato</Label>
                <Input
                  value={props.site}
                  onChange={(e) => setProps((p) => (p ? { ...p, site: e.target.value } : p))}
                  maxLength={40}
                />
              </div>
            </div>

            {props.legendas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Legendas na tela</Label>
                {props.legendas.map((l, i) => (
                  <Input key={`leg-${i}`} value={l} onChange={(e) => setLegenda(i, e.target.value)} maxLength={64} />
                ))}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Legenda do post (para publicar)</Label>
              <Textarea value={legendaPost} onChange={(e) => setLegendaPost(e.target.value)} rows={4} />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={enviarParaFila} disabled={enviando} className="flex-1">
                {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
                Gerar vídeo
              </Button>
              <Button variant="outline" onClick={gerarRoteiro} disabled={gerando}>
                <RefreshCw className="mr-2 h-4 w-4" /> Outro roteiro
              </Button>
              <Button variant="ghost" onClick={() => setProps(null)}>Cancelar</Button>
            </div>
          </div>
        )}

        {jobs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Seus vídeos animados</Label>
              <Button variant="ghost" size="sm" onClick={carregarJobs}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((j) => {
                const st = STATUS[j.status] || STATUS.pendente;
                const url = urls[j.id];
                const emAndamento = j.status === 'pendente' || j.status === 'processando';
                return (
                  <div key={j.id} className="rounded-lg border overflow-hidden bg-background">
                    {url ? (
                      <video src={url} controls className="w-full aspect-[9/16] max-h-[260px] bg-black object-contain" />
                    ) : emAndamento ? (
                      <div className="w-full aspect-[9/16] max-h-[260px] bg-muted flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="w-full aspect-[9/16] max-h-[260px] bg-muted flex items-center justify-center">
                        <Clapperboard className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-medium line-clamp-2">{j.titulo || 'Vídeo animado'}</p>
                      <Badge className={st.cor} variant="secondary">{st.label}</Badge>
                      {j.erro_mensagem && (
                        <p className="text-xs text-destructive line-clamp-2">{j.erro_mensagem}</p>
                      )}
                      {url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={baixando === j.id}
                          onClick={() => baixarVideo(j, url)}
                        >
                          {baixando === j.id ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-3 w-3" />
                          )}
                          Salvar no computador
                        </Button>
                      )}
                      {emAndamento && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive"
                          disabled={cancelando === j.id}
                          onClick={() => cancelarVideo(j.id)}
                        >
                          {cancelando === j.id ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Ban className="mr-2 h-3 w-3" />
                          )}
                          Cancelar renderização
                        </Button>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
