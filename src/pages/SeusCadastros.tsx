import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Plus, Upload, Users, MessageSquare, Tag, Trash2, Edit, UserPlus, RefreshCw, Phone, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Cadastro {
  id: string;
  nome: string;
  whatsapp: string;
  email: string | null;
  empresa: string | null;
  opt_in: boolean;
  origem: string | null;
  tags: string[] | null;
  total_mensagens_enviadas: number;
  total_mensagens_recebidas: number;
  bloqueou: boolean;
  respondeu_alguma_vez: boolean;
  created_at: string;
  grupos?: { id: string; nome: string; icone: string }[];
}

interface GrupoTransmissao {
  id: string;
  nome: string;
  icone: string;
  total_membros: number;
}

export default function SeusCadastros() {
  const navigate = useNavigate();
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [grupos, setGrupos] = useState<GrupoTransmissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<string[]>([]);
  const [selectedCadastros, setSelectedCadastros] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGrupoModalOpen, setIsGrupoModalOpen] = useState(false);
  const [selectedGrupos, setSelectedGrupos] = useState<string[]>([]);
  const [novoCadastro, setNovoCadastro] = useState({ nome: '', whatsapp: '', email: '', empresa: '' });
  
  // Estado para modal de troca de número
  const [isTrocaNumeroOpen, setIsTrocaNumeroOpen] = useState(false);
  const [numeroNovo, setNumeroNovo] = useState('');
  const [processandoTroca, setProcessandoTroca] = useState(false);
  const [progressoTroca, setProgressoTroca] = useState<any>(null);

  const stats = {
    total: cadastros.length,
    comOptIn: cadastros.filter(c => c.opt_in).length,
    semOptIn: cadastros.filter(c => !c.opt_in).length,
    responderam: cadastros.filter(c => c.respondeu_alguma_vez).length,
    nuncaResponderam: cadastros.filter(c => !c.respondeu_alguma_vez).length,
    bloquearam: cadastros.filter(c => c.bloqueou).length,
  };

  useEffect(() => {
    loadCadastros();
    loadGrupos();
  }, []);

  const loadCadastros = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar cadastros do usuário E cadastros públicos (sem user_id)
      const { data, error } = await supabase
        .from('cadastros')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load grupos for each cadastro
      const cadastrosWithGrupos = await Promise.all((data || []).map(async (cadastro) => {
        const { data: membros } = await supabase
          .from('grupo_membros')
          .select('grupo_id, grupos_transmissao(id, nome, icone)')
          .eq('cadastro_id', cadastro.id);

        return {
          ...cadastro,
          grupos: membros?.map((m: any) => m.grupos_transmissao).filter(Boolean) || []
        };
      }));

      setCadastros(cadastrosWithGrupos);
    } catch (error) {
      console.error('Erro ao carregar cadastros:', error);
      toast.error('Erro ao carregar cadastros');
    } finally {
      setLoading(false);
    }
  };

  const loadGrupos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('grupos_transmissao')
        .select('*')
        .eq('user_id', user.id)
        .order('nome');

      if (error) throw error;
      setGrupos(data || []);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    }
  };

  const handleAddCadastro = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('cadastros').insert({
        user_id: user.id,
        nome: novoCadastro.nome,
        whatsapp: novoCadastro.whatsapp,
        email: novoCadastro.email || null,
        empresa: novoCadastro.empresa || null,
        origem: 'manual',
        opt_in: true
      });

      if (error) throw error;

      toast.success('Cadastro adicionado com sucesso!');
      setIsAddModalOpen(false);
      setNovoCadastro({ nome: '', whatsapp: '', email: '', empresa: '' });
      loadCadastros();
    } catch (error) {
      console.error('Erro ao adicionar cadastro:', error);
      toast.error('Erro ao adicionar cadastro');
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Excluir ${selectedCadastros.length} cadastros?`)) return;

    try {
      const { error } = await supabase
        .from('cadastros')
        .delete()
        .in('id', selectedCadastros);

      if (error) throw error;

      toast.success(`${selectedCadastros.length} cadastros excluídos`);
      setSelectedCadastros([]);
      loadCadastros();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir cadastros');
    }
  };

  const handleAddToGrupos = async () => {
    if (selectedGrupos.length === 0) {
      toast.error('Selecione pelo menos um grupo');
      return;
    }

    try {
      const inserts = selectedCadastros.flatMap(cadastroId =>
        selectedGrupos.map(grupoId => ({
          cadastro_id: cadastroId,
          grupo_id: grupoId
        }))
      );

      const { error } = await supabase
        .from('grupo_membros')
        .upsert(inserts, { onConflict: 'grupo_id,cadastro_id' });

      if (error) throw error;

      // Update member counts
      for (const grupoId of selectedGrupos) {
        const { count } = await supabase
          .from('grupo_membros')
          .select('*', { count: 'exact', head: true })
          .eq('grupo_id', grupoId);

        await supabase
          .from('grupos_transmissao')
          .update({ total_membros: count || 0 })
          .eq('id', grupoId);
      }

      toast.success(`${selectedCadastros.length} cadastros adicionados a ${selectedGrupos.length} grupos!`);
      setIsGrupoModalOpen(false);
      setSelectedGrupos([]);
      setSelectedCadastros([]);
      loadCadastros();
      loadGrupos();
    } catch (error) {
      console.error('Erro ao adicionar aos grupos:', error);
      toast.error('Erro ao adicionar aos grupos');
    }
  };

  const filteredCadastros = cadastros.filter(c => {
    const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.whatsapp.includes(search) ||
      (c.empresa?.toLowerCase().includes(search.toLowerCase()));

    let matchFiltro = true;
    switch (filtro) {
      case 'com_optin': matchFiltro = c.opt_in; break;
      case 'sem_optin': matchFiltro = !c.opt_in; break;
      case 'responderam': matchFiltro = c.respondeu_alguma_vez; break;
      case 'nunca_responderam': matchFiltro = !c.respondeu_alguma_vez; break;
      case 'bloquearam': matchFiltro = c.bloqueou; break;
    }

    let matchOrigem = filtroOrigem.length === 0 || (c.origem && filtroOrigem.includes(c.origem));

    return matchSearch && matchFiltro && matchOrigem;
  });

  const toggleSelectAll = () => {
    if (selectedCadastros.length === filteredCadastros.length) {
      setSelectedCadastros([]);
    } else {
      setSelectedCadastros(filteredCadastros.map(c => c.id));
    }
  };

  const maskWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleTrocarNumero = async () => {
    if (!numeroNovo) {
      toast.error('Digite o novo número');
      return;
    }

    const numeroLimpo = numeroNovo.replace(/\D/g, '');
    if (numeroLimpo.length < 10) {
      toast.error('Número inválido');
      return;
    }

    if (!confirm(`⚠️ ATENÇÃO!\n\nNovo número: ${numeroNovo}\n\nEsta ação irá enviar mensagem de atualização para TODOS os ${stats.comOptIn} contatos com opt-in.\n\nPode demorar alguns minutos.\n\nConfirma?`)) {
      return;
    }

    setProcessandoTroca(true);
    setProgressoTroca(null);

    try {
      const { data, error } = await supabase.functions.invoke('trocar-numero-whatsapp', {
        body: {
          numeroNovo: numeroLimpo.length < 13 ? '55' + numeroLimpo : numeroLimpo
        }
      });

      if (error) throw error;

      setProgressoTroca(data);
      toast.success(`✅ ${data.mensagensEnviadas} mensagens de atualização enviadas!`);

    } catch (error: any) {
      console.error('Erro ao trocar número:', error);
      toast.error('❌ ' + (error?.message || 'Erro ao processar'));
    } finally {
      setProcessandoTroca(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Users className="h-8 w-8 text-primary" />
                Seus Cadastros
              </h1>
              <p className="text-muted-foreground mt-1">
                {stats.total} cadastros • {stats.comOptIn} com opt-in • {stats.semOptIn} sem opt-in
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Novo Cadastro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Cadastro</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={novoCadastro.nome}
                      onChange={e => setNovoCadastro({ ...novoCadastro, nome: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <Label>WhatsApp *</Label>
                    <Input
                      value={novoCadastro.whatsapp}
                      onChange={e => setNovoCadastro({ ...novoCadastro, whatsapp: maskWhatsApp(e.target.value) })}
                      placeholder="(21) 99999-9999"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={novoCadastro.email}
                      onChange={e => setNovoCadastro({ ...novoCadastro, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label>Empresa</Label>
                    <Input
                      value={novoCadastro.empresa}
                      onChange={e => setNovoCadastro({ ...novoCadastro, empresa: e.target.value })}
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <Button onClick={handleAddCadastro} className="w-full" disabled={!novoCadastro.nome || !novoCadastro.whatsapp}>
                    Adicionar Cadastro
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/importar')}>
              <Upload className="h-4 w-4" /> Importar
            </Button>

            <Dialog open={isTrocaNumeroOpen} onOpenChange={setIsTrocaNumeroOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100">
                  <Phone className="h-4 w-4" /> Trocar Número
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" /> Trocar Número WhatsApp
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800 font-medium">⚠️ IMPORTANTE:</p>
                    <ul className="text-sm text-amber-700 mt-2 space-y-1 ml-4 list-disc">
                      <li>Faça isso ANTES de trocar no WhatsApp</li>
                      <li>Cada contato com opt-in receberá mensagem</li>
                      <li>Processo pode demorar alguns minutos</li>
                      <li>Evita banimento por número desconhecido</li>
                    </ul>
                  </div>

                  <div>
                    <Label>Novo Número (AMZ):</Label>
                    <Input
                      type="tel"
                      value={numeroNovo}
                      onChange={(e) => setNumeroNovo(maskWhatsApp(e.target.value))}
                      placeholder="(21) 99999-9999"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Digite o novo número que você vai usar
                    </p>
                  </div>

                  {progressoTroca && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 font-medium">✅ Processo concluído!</p>
                      <div className="mt-2 text-sm text-green-700 space-y-1">
                        <p>📊 Processados: {progressoTroca.processados}</p>
                        <p>📱 Mensagens enviadas: {progressoTroca.mensagensEnviadas}</p>
                        {progressoTroca.erros > 0 && (
                          <p className="text-amber-600">⚠️ Erros: {progressoTroca.erros}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setIsTrocaNumeroOpen(false);
                        setNumeroNovo('');
                        setProgressoTroca(null);
                      }}
                      disabled={processandoTroca}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                      onClick={handleTrocarNumero}
                      disabled={processandoTroca || !numeroNovo}
                    >
                      {processandoTroca ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Phone className="h-4 w-4 mr-2" />
                          Notificar Contatos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="md:col-span-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, WhatsApp ou empresa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Button variant="outline" onClick={() => { setFiltro('todos'); setFiltroOrigem([]); }}>
            🔄 Limpar filtros
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="font-semibold mb-2">FILTROS:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'todos', label: `Todos (${stats.total})` },
                    { key: 'com_optin', label: `Com opt-in (${stats.comOptIn})` },
                    { key: 'sem_optin', label: `Sem opt-in (${stats.semOptIn})` },
                    { key: 'responderam', label: `Responderam (${stats.responderam})` },
                    { key: 'nunca_responderam', label: `Nunca responderam (${stats.nuncaResponderam})` },
                    { key: 'bloquearam', label: `Bloquearam (${stats.bloquearam})` },
                  ].map(f => (
                    <Badge
                      key={f.key}
                      variant={filtro === f.key ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setFiltro(f.key)}
                    >
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">ORIGEM:</p>
                <div className="flex flex-wrap gap-2">
                  {['site_footer', 'importacao', 'manual'].map(origem => (
                    <Badge
                      key={origem}
                      variant={filtroOrigem.includes(origem) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setFiltroOrigem(prev =>
                        prev.includes(origem) ? prev.filter(o => o !== origem) : [...prev, origem]
                      )}
                    >
                      {origem === 'site_footer' ? '🌐 Site' : origem === 'importacao' ? '📤 Importação' : '✋ Manual'}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedCadastros.length > 0 && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-semibold">{selectedCadastros.length} selecionados</span>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsGrupoModalOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Adicionar a Grupo
                </Button>
                <Button size="sm" variant="outline" className="gap-2">
                  <Tag className="h-4 w-4" /> Adicionar Tag
                </Button>
                <Button size="sm" variant="outline" className="gap-2">
                  <MessageSquare className="h-4 w-4" /> Enviar Mensagem
                </Button>
                <Button size="sm" variant="destructive" className="gap-2" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Select All */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedCadastros.length === filteredCadastros.length && filteredCadastros.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">Selecionar todos ({filteredCadastros.length})</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : filteredCadastros.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhum cadastro encontrado</h3>
            <p className="text-muted-foreground">Adicione seu primeiro cadastro ou importe uma base.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCadastros.map(cadastro => (
              <Card key={cadastro.id} className={`transition-all ${selectedCadastros.includes(cadastro.id) ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedCadastros.includes(cadastro.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCadastros([...selectedCadastros, cadastro.id]);
                        } else {
                          setSelectedCadastros(selectedCadastros.filter(id => id !== cadastro.id));
                        }
                      }}
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">👤</span>
                        <span className="font-semibold">{cadastro.nome}</span>
                        {cadastro.bloqueou && <Badge variant="destructive">Bloqueou</Badge>}
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>📱 {cadastro.whatsapp}</p>
                        {cadastro.opt_in ? (
                          <p className="text-green-600">✅ Com opt-in • {cadastro.respondeu_alguma_vez ? 'Respondeu' : 'Nunca respondeu'}</p>
                        ) : (
                          <p className="text-amber-600">⚠️ Sem opt-in</p>
                        )}
                        {cadastro.empresa && <p>🏢 {cadastro.empresa}</p>}
                        {cadastro.grupos && cadastro.grupos.length > 0 && (
                          <p>📋 Grupos: {cadastro.grupos.map(g => `${g.icone} ${g.nome}`).join(', ')}</p>
                        )}
                        {cadastro.tags && cadastro.tags.length > 0 && (
                          <p>🏷️ Tags: {cadastro.tags.join(', ')}</p>
                        )}
                        <p>📊 Enviadas: {cadastro.total_mensagens_enviadas} • Recebidas: {cadastro.total_mensagens_recebidas}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1">
                        <MessageSquare className="h-3 w-3" /> Mensagem
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                        setSelectedCadastros([cadastro.id]);
                        setIsGrupoModalOpen(true);
                      }}>
                        <UserPlus className="h-3 w-3" /> Grupo
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Adicionar a Grupo */}
        <Dialog open={isGrupoModalOpen} onOpenChange={setIsGrupoModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>➕ Adicionar a Grupo de Transmissão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedCadastros.length} cadastros selecionados
              </p>

              <div className="space-y-2">
                <p className="font-semibold">Selecione um ou mais grupos:</p>
                {grupos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum grupo criado ainda.</p>
                ) : (
                  grupos.map(grupo => (
                    <div key={grupo.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedGrupos.includes(grupo.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGrupos([...selectedGrupos, grupo.id]);
                          } else {
                            setSelectedGrupos(selectedGrupos.filter(id => id !== grupo.id));
                          }
                        }}
                      />
                      <span>{grupo.icone} {grupo.nome} ({grupo.total_membros})</span>
                    </div>
                  ))
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={() => navigate('/grupos-transmissao')}>
                + Criar Novo Grupo
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsGrupoModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleAddToGrupos} disabled={selectedGrupos.length === 0}>
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
