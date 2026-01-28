"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Calendar, Clock, Users, Package, Pause, Play, Trash2, Edit, Send, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Programacao {
  id: string;
  grupo_jid: string;
  grupo_nome: string;
  ativo: boolean;
  pausado: boolean;
  intervalo_minutos: number;
  horario_inicio: string;
  horario_fim: string;
  dias_ativos: number[];
  categorias: string[];
  ultimo_envio: string | null;
  proximo_envio: string | null;
  total_enviados: number;
}

interface Grupo {
  id: string;
  grupo_jid: string;
  nome: string;
  participantes_count: number;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const INTERVALOS = [
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
  { value: 240, label: '4 horas' },
  { value: 360, label: '6 horas' },
  { value: 480, label: '8 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
];

export default function EnviosProgramadosPJ() {
  const [programacoes, setProgramacoes] = useState<Programacao[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  
  // Form state
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [intervalo, setIntervalo] = useState(60);
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('22:00');
  const [diasAtivos, setDiasAtivos] = useState<number[]>([1, 2, 3, 4, 5]);
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Carregar programações
    const { data: progs } = await supabase
      .from('pj_envios_programados')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setProgramacoes(progs || []);

    // Carregar grupos
    const { data: grps } = await supabase
      .from('pj_grupos_whatsapp')
      .select('*')
      .eq('user_id', user.id)
      .order('nome');

    setGrupos(grps || []);
    setLoading(false);
  };

  const syncGrupos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-whatsapp-groups-pj');
      
      if (error) throw error;
      
      if (data?.groups) {
        toast.success(`✅ ${data.groups.length} grupos sincronizados!`);
        loadData();
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar:', err);
      toast.error('Erro ao sincronizar grupos');
    } finally {
      setLoading(false);
    }
  };

  const toggleDia = (dia: number) => {
    setDiasAtivos(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia)
        : [...prev, dia].sort()
    );
  };

  const criarProgramacao = async () => {
    if (!selectedGrupo) {
      toast.error('Selecione um grupo');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const grupo = grupos.find(g => g.grupo_jid === selectedGrupo);
      
      const agora = new Date();
      const proximoEnvio = new Date(agora.getTime() + intervalo * 60 * 1000);

      const { error } = await supabase
        .from('pj_envios_programados')
        .insert({
          user_id: user.id,
          grupo_jid: selectedGrupo,
          grupo_nome: grupo?.nome || 'Grupo',
          intervalo_minutos: intervalo,
          horario_inicio: horarioInicio,
          horario_fim: horarioFim,
          dias_ativos: diasAtivos,
          categorias: categorias.length > 0 ? categorias : null,
          proximo_envio: proximoEnvio.toISOString(),
          ativo: true,
          pausado: false,
        });

      if (error) throw error;

      toast.success('✅ Programação criada!');
      setShowNewModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Erro ao criar:', err);
      toast.error('Erro ao criar programação');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedGrupo('');
    setIntervalo(60);
    setHorarioInicio('08:00');
    setHorarioFim('22:00');
    setDiasAtivos([1, 2, 3, 4, 5]);
    setCategorias([]);
  };

  const togglePausa = async (prog: Programacao) => {
    try {
      const { error } = await supabase
        .from('pj_envios_programados')
        .update({ pausado: !prog.pausado })
        .eq('id', prog.id);

      if (error) throw error;
      
      toast.success(prog.pausado ? '▶️ Retomado!' : '⏸️ Pausado!');
      loadData();
    } catch (err) {
      toast.error('Erro ao atualizar');
    }
  };

  const deletarProgramacao = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta programação?')) return;

    try {
      const { error } = await supabase
        .from('pj_envios_programados')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('🗑️ Programação excluída');
      loadData();
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };

  const formatProximoEnvio = (date: string | null) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Envios Programados</h2>
          <p className="text-sm text-muted-foreground">
            Agende envios automáticos de produtos para seus grupos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncGrupos}>
            <Users className="h-4 w-4 mr-2" />
            Sincronizar Grupos
          </Button>
          <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Programação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Programação de Envio</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Grupo */}
                <div className="space-y-2">
                  <Label>Grupo WhatsApp</Label>
                  <Select value={selectedGrupo} onValueChange={setSelectedGrupo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {grupos.map(g => (
                        <SelectItem key={g.grupo_jid} value={g.grupo_jid}>
                          {g.nome} ({g.participantes_count} membros)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {grupos.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Nenhum grupo encontrado. Clique em "Sincronizar Grupos".
                    </p>
                  )}
                </div>

                {/* Intervalo */}
                <div className="space-y-2">
                  <Label>Intervalo entre envios</Label>
                  <Select value={String(intervalo)} onValueChange={v => setIntervalo(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVALOS.map(i => (
                        <SelectItem key={i.value} value={String(i.value)}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Horários */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input 
                      type="time" 
                      value={horarioInicio}
                      onChange={e => setHorarioInicio(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input 
                      type="time" 
                      value={horarioFim}
                      onChange={e => setHorarioFim(e.target.value)}
                    />
                  </div>
                </div>

                {/* Dias da semana */}
                <div className="space-y-2">
                  <Label>Dias da semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map(dia => (
                      <Button
                        key={dia.value}
                        type="button"
                        variant={diasAtivos.includes(dia.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDia(dia.value)}
                      >
                        {dia.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={criarProgramacao} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Criar Programação
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista de programações */}
      {programacoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium">Nenhuma programação ativa</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Crie uma programação para enviar produtos automaticamente
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {programacoes.map(prog => (
            <Card key={prog.id} className={prog.pausado ? 'opacity-60' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${prog.pausado ? 'bg-muted' : 'bg-primary/10'}`}>
                      <Users className={`h-5 w-5 ${prog.pausado ? 'text-muted-foreground' : 'text-primary'}`} />
                    </div>
                    <div>
                      <h3 className="font-medium">{prog.grupo_nome}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        A cada {INTERVALOS.find(i => i.value === prog.intervalo_minutos)?.label || `${prog.intervalo_minutos}min`}
                        <span className="mx-1">•</span>
                        {prog.horario_inicio} - {prog.horario_fim}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={prog.pausado ? 'secondary' : 'default'}>
                      {prog.pausado ? 'Pausado' : 'Ativo'}
                    </Badge>
                    <Badge variant="outline">
                      {prog.total_enviados} enviados
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Próximo envio: </span>
                    <span className="font-medium">{formatProximoEnvio(prog.proximo_envio)}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePausa(prog)}
                    >
                      {prog.pausado ? (
                        <><Play className="h-4 w-4 mr-1" /> Retomar</>
                      ) : (
                        <><Pause className="h-4 w-4 mr-1" /> Pausar</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deletarProgramacao(prog.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
