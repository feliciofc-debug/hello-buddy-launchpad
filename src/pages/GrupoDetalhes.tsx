import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, ArrowLeft, Users, MessageSquare, UserMinus, UserPlus, Edit, Trash2, BarChart3 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

interface Cadastro {
  id: string;
  nome: string;
  whatsapp: string;
  email: string | null;
  empresa: string | null;
  opt_in: boolean;
  total_mensagens_enviadas: number;
  total_mensagens_recebidas: number;
  respondeu_alguma_vez: boolean;
  adicionado_em?: string;
}

interface GrupoTransmissao {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  total_membros: number;
}

export default function GrupoDetalhes() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [grupo, setGrupo] = useState<GrupoTransmissao | null>(null);
  const [membros, setMembros] = useState<Cadastro[]>([]);
  const [cadastrosDisponiveis, setCadastrosDisponiveis] = useState<Cadastro[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMembros, setSelectedMembros] = useState<string[]>([]);
  const [isAddMembrosOpen, setIsAddMembrosOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [searchAdd, setSearchAdd] = useState('');

  useEffect(() => {
    if (id) {
      loadGrupo();
      loadMembros();
    }
  }, [id]);

  const loadGrupo = async () => {
    try {
      const { data, error } = await supabase
        .from('grupos_transmissao')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGrupo(data);
    } catch (error) {
      console.error('Erro ao carregar grupo:', error);
      toast.error('Grupo não encontrado');
      navigate('/grupos-transmissao');
    }
  };

  const loadMembros = async () => {
    try {
      const { data, error } = await supabase
        .from('grupo_membros')
        .select(`
          adicionado_em,
          cadastros (
            id, nome, whatsapp, email, empresa, opt_in,
            total_mensagens_enviadas, total_mensagens_recebidas, respondeu_alguma_vez
          )
        `)
        .eq('grupo_id', id);

      if (error) throw error;

      const membrosData = (data || [])
        .filter((m: any) => m.cadastros)
        .map((m: any) => ({
          ...m.cadastros,
          adicionado_em: m.adicionado_em
        }));

      setMembros(membrosData);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCadastrosDisponiveis = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('cadastros')
        .select('id, nome, whatsapp, email, empresa, opt_in, total_mensagens_enviadas, total_mensagens_recebidas, respondeu_alguma_vez')
        .eq('user_id', user.id)
        .order('nome');

      if (error) throw error;

      // Filter out those already in the group
      const membroIds = membros.map(m => m.id);
      const disponiveis = (data || []).filter(c => !membroIds.includes(c.id));
      setCadastrosDisponiveis(disponiveis);
    } catch (error) {
      console.error('Erro ao carregar cadastros:', error);
    }
  };

  const handleRemoverMembro = async (cadastroId: string) => {
    try {
      const { error } = await supabase
        .from('grupo_membros')
        .delete()
        .eq('grupo_id', id)
        .eq('cadastro_id', cadastroId);

      if (error) throw error;

      // Update count
      await supabase
        .from('grupos_transmissao')
        .update({ total_membros: membros.length - 1 })
        .eq('id', id);

      toast.success('Membro removido do grupo');
      loadMembros();
      loadGrupo();
    } catch (error) {
      console.error('Erro ao remover:', error);
      toast.error('Erro ao remover membro');
    }
  };

  const handleRemoverSelecionados = async () => {
    if (!confirm(`Remover ${selectedMembros.length} membros do grupo?`)) return;

    try {
      const { error } = await supabase
        .from('grupo_membros')
        .delete()
        .eq('grupo_id', id)
        .in('cadastro_id', selectedMembros);

      if (error) throw error;

      // Update count
      await supabase
        .from('grupos_transmissao')
        .update({ total_membros: membros.length - selectedMembros.length })
        .eq('id', id);

      toast.success(`${selectedMembros.length} membros removidos`);
      setSelectedMembros([]);
      loadMembros();
      loadGrupo();
    } catch (error) {
      console.error('Erro ao remover:', error);
      toast.error('Erro ao remover membros');
    }
  };

  const handleAdicionarMembros = async () => {
    if (selectedToAdd.length === 0) {
      toast.error('Selecione pelo menos um cadastro');
      return;
    }

    try {
      const inserts = selectedToAdd.map(cadastroId => ({
        grupo_id: id,
        cadastro_id: cadastroId
      }));

      const { error } = await supabase
        .from('grupo_membros')
        .insert(inserts);

      if (error) throw error;

      // Update count
      await supabase
        .from('grupos_transmissao')
        .update({ total_membros: membros.length + selectedToAdd.length })
        .eq('id', id);

      toast.success(`${selectedToAdd.length} membros adicionados!`);
      setIsAddMembrosOpen(false);
      setSelectedToAdd([]);
      loadMembros();
      loadGrupo();
    } catch (error) {
      console.error('Erro ao adicionar:', error);
      toast.error('Erro ao adicionar membros');
    }
  };

  const openAddModal = () => {
    loadCadastrosDisponiveis();
    setIsAddMembrosOpen(true);
  };

  const filteredMembros = membros.filter(m =>
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    m.whatsapp.includes(search) ||
    m.empresa?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDisponiveis = cadastrosDisponiveis.filter(c =>
    c.nome.toLowerCase().includes(searchAdd.toLowerCase()) ||
    c.whatsapp.includes(searchAdd)
  );

  const toggleSelectAll = () => {
    if (selectedMembros.length === filteredMembros.length) {
      setSelectedMembros([]);
    } else {
      setSelectedMembros(filteredMembros.map(m => m.id));
    }
  };

  if (!grupo) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate('/grupos-transmissao')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para Grupos
        </Button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{grupo.icone}</span>
            <div>
              <h1 className="text-3xl font-bold">{grupo.nome}</h1>
              <p className="text-muted-foreground">{grupo.total_membros} membros</p>
            </div>
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: grupo.cor }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate(`/grupos-transmissao`)}>
              <Edit className="h-4 w-4" /> Editar grupo
            </Button>
            <Button className="gap-2" onClick={openAddModal}>
              <UserPlus className="h-4 w-4" /> Adicionar membros
            </Button>
            <Button variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" /> Enviar mensagem
            </Button>
            <Button variant="outline" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Estatísticas
            </Button>
          </div>
        </div>

        {grupo.descricao && (
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground">{grupo.descricao}</p>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar membros..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedMembros.length > 0 && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-semibold">{selectedMembros.length} selecionados</span>
                <Button size="sm" variant="outline" className="gap-2">
                  <MessageSquare className="h-4 w-4" /> Enviar Mensagem
                </Button>
                <Button size="sm" variant="destructive" className="gap-2" onClick={handleRemoverSelecionados}>
                  <UserMinus className="h-4 w-4" /> Remover do Grupo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Select All */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedMembros.length === filteredMembros.length && filteredMembros.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">Selecionar todos ({filteredMembros.length})</span>
        </div>

        {/* Members List */}
        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : filteredMembros.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhum membro neste grupo</h3>
            <p className="text-muted-foreground mb-4">Adicione cadastros a este grupo de transmissão.</p>
            <Button onClick={openAddModal}>
              <UserPlus className="h-4 w-4 mr-2" /> Adicionar membros
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredMembros.map(membro => (
              <Card key={membro.id} className={`transition-all ${selectedMembros.includes(membro.id) ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedMembros.includes(membro.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedMembros([...selectedMembros, membro.id]);
                        } else {
                          setSelectedMembros(selectedMembros.filter(id => id !== membro.id));
                        }
                      }}
                    />

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">👤</span>
                        <span className="font-semibold">{membro.nome}</span>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <p>📱 {membro.whatsapp}</p>
                        {membro.empresa && <p>🏢 {membro.empresa}</p>}
                        <p>📊 Enviadas: {membro.total_mensagens_enviadas} • Recebidas: {membro.total_mensagens_recebidas}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1">
                        <MessageSquare className="h-3 w-3" /> Mensagem
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive gap-1"
                        onClick={() => handleRemoverMembro(membro.id)}
                      >
                        <UserMinus className="h-3 w-3" /> Remover
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Adicionar Membros */}
        <Dialog open={isAddMembrosOpen} onOpenChange={setIsAddMembrosOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>➕ Adicionar Membros ao Grupo</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cadastros..."
                  value={searchAdd}
                  onChange={e => setSearchAdd(e.target.value)}
                  className="pl-10"
                />
              </div>

              <p className="text-sm text-muted-foreground">
                {selectedToAdd.length} selecionados • {cadastrosDisponiveis.length} disponíveis
              </p>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {filteredDisponiveis.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {cadastrosDisponiveis.length === 0
                      ? 'Todos os cadastros já estão neste grupo'
                      : 'Nenhum cadastro encontrado'}
                  </p>
                ) : (
                  filteredDisponiveis.map(cadastro => (
                    <div
                      key={cadastro.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedToAdd.includes(cadastro.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                      onClick={() => {
                        if (selectedToAdd.includes(cadastro.id)) {
                          setSelectedToAdd(selectedToAdd.filter(id => id !== cadastro.id));
                        } else {
                          setSelectedToAdd([...selectedToAdd, cadastro.id]);
                        }
                      }}
                    >
                      <Checkbox checked={selectedToAdd.includes(cadastro.id)} />
                      <div className="flex-1">
                        <p className="font-medium">{cadastro.nome}</p>
                        <p className="text-sm text-muted-foreground">{cadastro.whatsapp}</p>
                      </div>
                      {cadastro.opt_in && <Badge variant="outline" className="text-green-600">Opt-in</Badge>}
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setIsAddMembrosOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleAdicionarMembros} disabled={selectedToAdd.length === 0}>
                  Adicionar {selectedToAdd.length > 0 && `(${selectedToAdd.length})`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
