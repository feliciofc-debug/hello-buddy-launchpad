import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Plus, Users, MessageSquare, Edit, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GrupoTransmissao {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  total_membros: number;
  ativo: boolean;
  created_at: string;
}

const ICONES = ['📋', '🎯', '🔥', '⭐', '📈', '💼', '👥', '🎁', '💰', '🚀', '📱', '✨', '🆕', '💎', '🏆'];
const CORES = ['#E31E24', '#FF6B35', '#F7931E', '#4CAF50', '#2196F3', '#9C27B0', '#607D8B', '#795548'];

export default function GruposTransmissao() {
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState<GrupoTransmissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<GrupoTransmissao | null>(null);
  const [novoGrupo, setNovoGrupo] = useState({
    nome: '',
    descricao: '',
    icone: '📋',
    cor: '#E31E24'
  });

  const totalMembros = grupos.reduce((acc, g) => acc + g.total_membros, 0);

  useEffect(() => {
    loadGrupos();
  }, []);

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
      toast.error('Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrupo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingGrupo) {
        const { error } = await supabase
          .from('grupos_transmissao')
          .update({
            nome: novoGrupo.nome,
            descricao: novoGrupo.descricao || null,
            icone: novoGrupo.icone,
            cor: novoGrupo.cor
          })
          .eq('id', editingGrupo.id);

        if (error) throw error;
        toast.success('Grupo atualizado!');
      } else {
        const { error } = await supabase.from('grupos_transmissao').insert({
          user_id: user.id,
          nome: novoGrupo.nome,
          descricao: novoGrupo.descricao || null,
          icone: novoGrupo.icone,
          cor: novoGrupo.cor
        });

        if (error) throw error;
        toast.success('Grupo criado com sucesso!');
      }

      setIsModalOpen(false);
      setEditingGrupo(null);
      setNovoGrupo({ nome: '', descricao: '', icone: '📋', cor: '#E31E24' });
      loadGrupos();
    } catch (error) {
      console.error('Erro ao salvar grupo:', error);
      toast.error('Erro ao salvar grupo');
    }
  };

  const handleDeleteGrupo = async (id: string) => {
    if (!confirm('Excluir este grupo? Os membros não serão excluídos.')) return;

    try {
      const { error } = await supabase
        .from('grupos_transmissao')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Grupo excluído');
      loadGrupos();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir grupo');
    }
  };

  const openEditModal = (grupo: GrupoTransmissao) => {
    setEditingGrupo(grupo);
    setNovoGrupo({
      nome: grupo.nome,
      descricao: grupo.descricao || '',
      icone: grupo.icone,
      cor: grupo.cor
    });
    setIsModalOpen(true);
  };

  const filteredGrupos = grupos.filter(g =>
    g.nome.toLowerCase().includes(search.toLowerCase()) ||
    g.descricao?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              📋 Grupos de Transmissão
            </h1>
            <p className="text-muted-foreground mt-1">
              {grupos.length} grupos • {totalMembros} membros total
            </p>
          </div>

          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) {
              setEditingGrupo(null);
              setNovoGrupo({ nome: '', descricao: '', icone: '📋', cor: '#E31E24' });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGrupo ? 'Editar Grupo' : '📋 Criar Novo Grupo de Transmissão'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do grupo *</Label>
                  <Input
                    value={novoGrupo.nome}
                    onChange={e => setNovoGrupo({ ...novoGrupo, nome: e.target.value })}
                    placeholder="Ex: Clientes VIP"
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={novoGrupo.descricao}
                    onChange={e => setNovoGrupo({ ...novoGrupo, descricao: e.target.value })}
                    placeholder="Descreva o propósito do grupo..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Ícone</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ICONES.map(icone => (
                      <button
                        key={icone}
                        type="button"
                        onClick={() => setNovoGrupo({ ...novoGrupo, icone })}
                        className={`text-2xl p-2 rounded-lg transition-all ${novoGrupo.icone === icone ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'}`}
                      >
                        {icone}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {CORES.map(cor => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setNovoGrupo({ ...novoGrupo, cor })}
                        className={`w-8 h-8 rounded-full transition-all ${novoGrupo.cor === cor ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={handleSaveGrupo} disabled={!novoGrupo.nome}>
                    {editingGrupo ? 'Salvar' : 'Criar Grupo'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : filteredGrupos.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold">Nenhum grupo criado</h3>
            <p className="text-muted-foreground mb-4">Crie seu primeiro grupo de transmissão para organizar seus cadastros.</p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Criar Grupo
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGrupos.map(grupo => (
              <Card key={grupo.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{grupo.icone}</span>
                      <div>
                        <CardTitle className="text-lg">{grupo.nome}</CardTitle>
                        <p className="text-sm text-muted-foreground">{grupo.total_membros} membros</p>
                      </div>
                    </div>
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: grupo.cor }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {grupo.descricao && (
                    <p className="text-sm text-muted-foreground">{grupo.descricao}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => navigate(`/grupos-transmissao/${grupo.id}`)}
                    >
                      <Eye className="h-3 w-3" /> Ver membros
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1">
                      <MessageSquare className="h-3 w-3" /> Enviar msg
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditModal(grupo)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteGrupo(grupo.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
