// ============================================================
// IMPORTAR DO SITE — lê a identidade visual e o texto do site
// informado (cores, logo, fontes, descrição) e SEMPRE pede
// confirmação antes de aplicar. Usado no cadastro da empresa e
// na geração de vídeo (prospecção).
// ============================================================

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Globe, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type IdentidadeImportada = {
  url: string;
  nome_empresa: string;
  tagline: string;
  descricao: string;
  diferenciais: string;
  publico_alvo: string;
  segmento_sugerido: string;
  tom_de_voz: string;
  logo_url: string | null;
  logo_data_url?: string | null;
  fontes: string[];
  cores_detectadas: Array<{ hex: string; peso: number }>;
  paleta: Record<string, string>;
  texto_base: string;
  parcial: boolean;
  avisos: string[];
};

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (dados: IdentidadeImportada) => void | Promise<void>;
  /** 'empresa' mostra os campos de negócio; 'video' foca em cores/logo. */
  modo?: 'empresa' | 'video';
};

export const ImportarDoSiteModal = ({ aberto, onFechar, onConfirmar, modo = 'empresa' }: Props) => {
  const [url, setUrl] = useState('');
  const [lendo, setLendo] = useState(false);
  const [dados, setDados] = useState<IdentidadeImportada | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** leitura avançada (site montado por JavaScript) em andamento */
  const [avancada, setAvancada] = useState(false);
  const cancelado = useRef(false);

  const fechar = () => {
    cancelado.current = true;
    setDados(null);
    setUrl('');
    setAvancada(false);
    onFechar();
  };

  /** Espera o navegador da plataforma abrir o site e refinar o resultado. */
  const aguardarAvancada = async (jobId: string) => {
    setAvancada(true);
    const limite = Date.now() + 4 * 60 * 1000;
    try {
      while (!cancelado.current && Date.now() < limite) {
        await new Promise((r) => setTimeout(r, 5000));
        const { data } = await supabase.functions.invoke('site-identidade-status', {
          body: { job_id: jobId },
        });
        if (!data?.success) continue;
        if (data.status === 'concluido' && data.identidade) {
          if (cancelado.current) return;
          setDados(data.identidade as IdentidadeImportada);
          toast.success('Leitura avançada concluída — confira e ajuste o que precisar.');
          return;
        }
        if (data.status === 'erro') {
          toast.error('O site não permitiu a leitura avançada. Complete os campos à mão.');
          return;
        }
      }
    } finally {
      setAvancada(false);
    }
  };

  const ler = async () => {
    if (!url.trim()) {
      toast.error('Cole o endereço do site.');
      return;
    }
    cancelado.current = false;
    setLendo(true);
    setDados(null);
    setAvancada(false);
    try {
      const { data, error } = await supabase.functions.invoke('extrair-identidade-site', {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não foi possível ler o site.');
      setDados(data.identidade as IdentidadeImportada);
      const jobId = data?.camada_b?.job_id as string | undefined;
      if (jobId) void aguardarAvancada(jobId);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível ler o site. Preencha à mão.');
    } finally {
      setLendo(false);
    }
  };

  const setCampo = (campo: keyof IdentidadeImportada, valor: string) =>
    setDados((d) => (d ? { ...d, [campo]: valor } : d));

  const setCor = (chave: string, valor: string) =>
    setDados((d) => (d ? { ...d, paleta: { ...d.paleta, [chave]: valor } } : d));

  const confirmar = async () => {
    if (!dados) return;
    setSalvando(true);
    try {
      await onConfirmar(dados);
      fechar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => (!v ? fechar() : null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Importar do site
          </DialogTitle>
          <DialogDescription>
            Cole o endereço do site e confira o que foi encontrado. Nada é salvo antes de você confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ler(); }}
            placeholder="Ex.: zonasul.com.br"
          />
          <Button onClick={ler} disabled={lendo}>
            {lendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {lendo ? 'Lendo…' : 'Ler site'}
          </Button>
        </div>
        {lendo && (
          <p className="text-xs text-muted-foreground">
            A leitura leva até 20 segundos. Você pode continuar usando a tela.
          </p>
        )}

        {dados && (
          <div className="space-y-5">
            {dados.avisos.length > 0 && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                <p className="mb-1 flex items-center gap-2 font-medium text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle className="h-4 w-4" />
                  O site não permitiu leitura completa
                </p>
                <ul className="list-inside list-disc space-y-1 text-yellow-900/80 dark:text-yellow-200/80">
                  {dados.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
                <p className="mt-2 text-xs text-yellow-900/70 dark:text-yellow-200/70">
                  Complete os campos abaixo à mão. Nenhuma cor foi inventada.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Cores encontradas no site</Label>
              {dados.cores_detectadas.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {dados.cores_detectadas.map((c) => (
                    <span key={c.hex} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
                      <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: c.hex }} />
                      {c.hex}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma cor foi lida no código do site.</p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                {(['bg', 'bg2', 'destaque', 'destaqueSoft'] as const).map((chave) => (
                  <label key={chave} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="color"
                      value={dados.paleta[chave] || '#ffffff'}
                      onChange={(e) => setCor(chave, e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border bg-background p-1"
                      aria-label={`Cor ${chave}`}
                    />
                    {chave === 'destaque' ? 'Principal' : chave === 'destaqueSoft' ? 'Apoio' : chave === 'bg' ? 'Fundo' : 'Fundo 2'}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Nome da marca</Label>
                <Input value={dados.nome_empresa} onChange={(e) => setCampo('nome_empresa', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tipografia do site</Label>
                <Input
                  value={dados.fontes.join(', ')}
                  onChange={(e) => setDados((d) => (d ? { ...d, fontes: e.target.value.split(',').map((f) => f.trim()).filter(Boolean) } : d))}
                  placeholder="Nenhuma fonte identificada"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs">Logo encontrada</Label>
                {dados.logo_url ? (
                  <p className="truncate text-xs text-muted-foreground">{dados.logo_url}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma logo encontrada — anexe o arquivo depois.</p>
                )}
              </div>
              {(dados.logo_data_url || dados.logo_url) && (
                <img
                  src={dados.logo_data_url || dados.logo_url || ''}
                  alt="Logo do site"
                  className="h-12 max-w-[140px] rounded border bg-background object-contain p-1"
                />
              )}
            </div>

            {modo === 'empresa' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">O que o negócio faz</Label>
                  <Textarea rows={3} value={dados.descricao} onChange={(e) => setCampo('descricao', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Diferenciais</Label>
                  <Textarea rows={3} value={dados.diferenciais} onChange={(e) => setCampo('diferenciais', e.target.value)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Público-alvo</Label>
                    <Input value={dados.publico_alvo} onChange={(e) => setCampo('publico_alvo', e.target.value)} placeholder="Ex.: famílias do Rio de Janeiro" />
                  </div>
                  <div>
                    <Label className="text-xs">Tom de voz</Label>
                    <Input value={dados.tom_de_voz} onChange={(e) => setCampo('tom_de_voz', e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Segmento sugerido:
                  <Badge variant="secondary">{dados.segmento_sugerido}</Badge>
                  <span>— você pode trocar depois de confirmar.</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={fechar}>Cancelar</Button>
              <Button onClick={confirmar} disabled={salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Usar esses dados
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
