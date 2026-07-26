import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Rocket, Plus, X, Loader2, AlertTriangle, Package, Users, List } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AutopilotWhatsAppConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoInicial?: { id: string; nome: string } | null;
  onSaved?: () => void;
}

interface ProdutoOpt { id: string; nome: string; categoria: string | null; }
interface ListaOpt { id: string; nome: string; total: number; espelho: boolean; }
interface GrupoOpt { id: string; nome: string; jid: string | null; total: number; }

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DEFAULT_CAP = 200;
const DEFAULT_TENANT_CAP = 300;

export function AutopilotWhatsAppConfig({ open, onOpenChange, produtoInicial, onSaved }: AutopilotWhatsAppConfigProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [listas, setListas] = useState<ListaOpt[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpt[]>([]);
  const [tenantCap, setTenantCap] = useState<number>(DEFAULT_TENANT_CAP);

  const [nome, setNome] = useState('');
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [listasSelecionadas, setListasSelecionadas] = useState<string[]>([]);
  const [gruposSelecionados, setGruposSelecionados] = useState<string[]>([]);
  const [frequencia, setFrequencia] = useState<'diario' | 'semanal'>('diario');
  const [horarios, setHorarios] = useState<string[]>(['10:00']);
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [maxEnviosDia, setMaxEnviosDia] = useState<number>(DEFAULT_CAP);

  useEffect(() => {
    if (!open) return;
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (produtoInicial?.id && !produtosSelecionados.includes(produtoInicial.id)) {
      setProdutosSelecionados([produtoInicial.id]);
      setNome(`Autopilot WhatsApp — ${produtoInicial.nome}`.slice(0, 80));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoInicial, open]);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [prodRes, listasRes, gruposRes, cfgRes] = await Promise.all([
        supabase.from('produtos').select('id, nome, categoria').eq('user_id', user.id).order('nome'),
        supabase.from('pj_listas_categoria').select('id, nome, total_membros, grupo_jid_espelho').eq('user_id', user.id).order('nome'),
        supabase.from('pj_grupos_whatsapp').select('id, nome, grupo_jid, participantes_count').eq('user_id', user.id).order('nome'),
        supabase.from('whatsapp_config').select('max_envios_dia_numero').eq('user_id', user.id).maybeSingle(),
      ]);

      setProdutos((prodRes.data || []).map((p: any) => ({ id: p.id, nome: p.nome, categoria: p.categoria })));
      setListas((listasRes.data || []).map((l: any) => ({
        id: l.id,
        nome: l.nome,
        total: l.total_membros || 0,
        espelho: !!l.grupo_jid_espelho,
      })));
      setGrupos((gruposRes.data || []).map((g: any) => ({
        id: g.id,
        nome: g.nome,
        jid: g.grupo_jid,
        total: g.participantes_count || 0,
      })));
      setTenantCap((cfgRes.data as any)?.max_envios_dia_numero || DEFAULT_TENANT_CAP);
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleProduto = (id: string) => {
    setProdutosSelecionados((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleLista = (id: string) => {
    setListasSelecionadas((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleGrupo = (id: string) => {
    setGruposSelecionados((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleDia = (d: number) => {
    setDiasSemana((prev) => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const addHorario = () => {
    if (horarios.length >= 10) return toast.error('Máximo 10 horários');
    setHorarios([...horarios, '14:00']);
  };
  const removeHorario = (idx: number) => {
    if (horarios.length <= 1) return;
    setHorarios(horarios.filter((_, i) => i !== idx));
  };
  const updateHorario = (idx: number, v: string) => {
    const next = [...horarios];
    next[idx] = v;
    setHorarios(next);
  };

  const canSave = useMemo(() => {
    return produtosSelecionados.length > 0
      && (listasSelecionadas.length > 0 || gruposSelecionados.length > 0)
      && horarios.length > 0
      && horarios.every(h => /^\d{2}:\d{2}$/.test(h))
      && maxEnviosDia > 0
      && (frequencia !== 'semanal' || diasSemana.length > 0);
  }, [produtosSelecionados, listasSelecionadas, gruposSelecionados, horarios, maxEnviosDia, frequencia, diasSemana]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const horariosOrdenados = [...horarios].sort();
      const [h, m] = horariosOrdenados[0].split(':').map(Number);
      const proxima = new Date();
      proxima.setHours(h, m, 0, 0);
      if (proxima.getTime() < Date.now()) proxima.setDate(proxima.getDate() + 1);

      const payload = {
        user_id: user.id,
        nome: nome || `Autopilot WhatsApp ${new Date().toLocaleDateString('pt-BR')}`,
        produto_id: produtosSelecionados[0], // NOT NULL — primeiro é o "base"
        produtos_ids: produtosSelecionados,
        ultimo_produto_index: 0,
        listas_ids: listasSelecionadas,
        pj_grupos_ids: gruposSelecionados,
        frequencia,
        horarios: horariosOrdenados,
        dias_semana: frequencia === 'semanal' ? diasSemana : [0, 1, 2, 3, 4, 5, 6],
        data_inicio: new Date().toISOString().slice(0, 10),
        mensagem_template: '', // template gerado pelo executor autopilot
        max_envios_dia: maxEnviosDia,
        autopilot: true,
        ativa: true,
        status: 'ativa',
        proxima_execucao: proxima.toISOString(),
      };

      const { error } = await supabase.from('campanhas_recorrentes').insert(payload as any);
      if (error) throw error;

      toast.success('Autopilot WhatsApp criado! 🚀');
      onSaved?.();
      onOpenChange(false);
      // reset
      setNome('');
      setProdutosSelecionados([]);
      setListasSelecionadas([]);
      setGruposSelecionados([]);
      setHorarios(['10:00']);
      setMaxEnviosDia(DEFAULT_CAP);
    } catch (err: any) {
      console.error('Erro ao salvar autopilot:', err);
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Autopilot WhatsApp
          </DialogTitle>
          <DialogDescription>
            Configure envios recorrentes automáticos por WhatsApp. Modo controlado com trava de volume.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            <Alert className="border-yellow-500/50 bg-yellow-500/5">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-sm">
                Envios em massa por número não-oficial têm risco de bloqueio. Comece com volume baixo e aumente aos poucos.
              </AlertDescription>
            </Alert>

            {/* Nome */}
            <div>
              <Label>Nome do Autopilot</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ofertas de Manhã" />
            </div>

            {/* Produtos */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" /> Produtos ({produtosSelecionados.length} selecionado{produtosSelecionados.length !== 1 ? 's' : ''})
              </Label>
              <p className="text-xs text-muted-foreground mt-1">Selecione 1 ou vários. Com mais de 1, o sistema alterna entre eles.</p>
              <div className="mt-3 max-h-48 overflow-y-auto space-y-1 border rounded p-2">
                {produtos.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">Nenhum produto cadastrado</p>}
                {produtos.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer">
                    <Checkbox checked={produtosSelecionados.includes(p.id)} onCheckedChange={() => toggleProduto(p.id)} />
                    <span className="text-sm flex-1">{p.nome}</span>
                    {p.categoria && <Badge variant="outline" className="text-xs">{p.categoria}</Badge>}
                  </label>
                ))}
              </div>
            </div>

            {/* Segmentos */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" /> Segmentos-alvo
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {listasSelecionadas.length} lista(s) + {gruposSelecionados.length} grupo(s)
              </p>

              {listas.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><List className="h-3 w-3" /> Listas</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
                    {listas.map((l) => (
                      <label key={l.id} className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer">
                        <Checkbox checked={listasSelecionadas.includes(l.id)} onCheckedChange={() => toggleLista(l.id)} />
                        <span className="text-sm flex-1">{l.nome}</span>
                        {l.espelho && <Badge variant="secondary" className="text-xs">📱 Espelho</Badge>}
                        <span className="text-xs text-muted-foreground">{l.total}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {grupos.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Grupos WhatsApp</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
                    {grupos.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer">
                        <Checkbox checked={gruposSelecionados.includes(g.id)} onCheckedChange={() => toggleGrupo(g.id)} />
                        <span className="text-sm flex-1">👥 {g.nome}</span>
                        <span className="text-xs text-muted-foreground">{g.total}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cadência */}
            <div className="p-4 bg-muted/30 rounded-lg space-y-4">
              <Label className="text-base font-semibold">Cadência</Label>

              <RadioGroup value={frequencia} onValueChange={(v: any) => setFrequencia(v)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="diario" id="freq-diario" />
                  <label htmlFor="freq-diario" className="text-sm cursor-pointer">Diário</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="semanal" id="freq-semanal" />
                  <label htmlFor="freq-semanal" className="text-sm cursor-pointer">Semanal</label>
                </div>
              </RadioGroup>

              <div>
                <Label className="text-sm">Horários</Label>
                {horarios.map((h, idx) => (
                  <div key={idx} className="flex gap-2 items-center mt-2">
                    <Input type="time" value={h} onChange={(e) => updateHorario(idx, e.target.value)} />
                    {horarios.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeHorario(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={addHorario}>
                  <Plus className="mr-2 h-4 w-4" />Adicionar Horário
                </Button>
              </div>

              {frequencia === 'semanal' && (
                <div>
                  <Label className="text-sm">Dias da Semana</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {DAY_NAMES.map((d, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant={diasSemana.includes(idx) ? 'default' : 'outline'}
                        onClick={() => toggleDia(idx)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Trava de volume */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <Label className="text-base font-semibold">Trava de volume</Label>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Máx. envios/dia (esta campanha)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxEnviosDia}
                    onChange={(e) => setMaxEnviosDia(Math.max(1, parseInt(e.target.value || '0', 10)))}
                  />
                </div>
                <div>
                  <Label className="text-sm">Teto do chip (tenant)</Label>
                  <Input value={tenantCap} disabled />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A soma diária de <b>todos os autopilots</b> respeita o teto do chip ({tenantCap}/dia). Se este limite bater, a campanha reagenda para amanhã automaticamente.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!canSave || saving} className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Ativar Autopilot
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
