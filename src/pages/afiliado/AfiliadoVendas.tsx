import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, DollarSign, TrendingUp, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Venda {
  id: string;
  valor: number;
  marketplace: string;
  estimativa_comissao: number | null;
  observacao: string | null;
  data_venda: string;
  produto_id: string | null;
}

interface Produto {
  id: string;
  titulo: string;
}

export default function AfiliadoVendas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [form, setForm] = useState({
    valor: '',
    marketplace: 'amazon',
    estimativa_comissao: '',
    observacao: '',
    produto_id: ''
  });

  const [stats, setStats] = useState({
    totalVendas: 0,
    valorTotal: 0,
    comissaoEstimada: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const [vendasRes, produtosRes] = await Promise.all([
        supabase
          .from('afiliado_vendas')
          .select('*')
          .eq('user_id', user.id)
          .order('data_venda', { ascending: false }),
        supabase
          .from('afiliado_produtos')
          .select('id, titulo')
          .eq('user_id', user.id)
      ]);

      if (vendasRes.error) throw vendasRes.error;
      
      const vendasData = vendasRes.data || [];
      setVendas(vendasData);
      setProdutos(produtosRes.data || []);

      // Calcular estatísticas
      const valorTotal = vendasData.reduce((acc, v) => acc + Number(v.valor || 0), 0);
      const comissaoEstimada = vendasData.reduce((acc, v) => acc + Number(v.estimativa_comissao || 0), 0);
      
      setStats({
        totalVendas: vendasData.length,
        valorTotal,
        comissaoEstimada
      });
    } catch (error) {
      console.error('Erro ao carregar:', error);
      toast.error('Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      valor: '',
      marketplace: 'amazon',
      estimativa_comissao: '',
      observacao: '',
      produto_id: ''
    });
  };

  const handleSave = async () => {
    if (!form.valor || !form.marketplace) {
      toast.error('Preencha valor e marketplace');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const vendaData = {
        valor: parseFloat(form.valor),
        marketplace: form.marketplace,
        estimativa_comissao: form.estimativa_comissao ? parseFloat(form.estimativa_comissao) : null,
        observacao: form.observacao || null,
        produto_id: form.produto_id || null,
        user_id: user.id
      };

      const { error } = await supabase
        .from('afiliado_vendas')
        .insert(vendaData);
      
      if (error) throw error;
      
      toast.success('Venda registrada!');
      resetForm();
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao registrar venda');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta venda?')) return;

    try {
      const { error } = await supabase
        .from('afiliado_vendas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Venda excluída');
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error(error.message || 'Erro ao excluir');
    }
  };

  const marketplaces = [
    { value: 'amazon', label: 'Amazon' },
    { value: 'mercadolivre', label: 'Mercado Livre' },
    { value: 'shopee', label: 'Shopee' },
    { value: 'magalu', label: 'Magazine Luiza' },
    { value: 'americanas', label: 'Americanas' },
    { value: 'hotmart', label: 'Hotmart' },
    { value: 'outro', label: 'Outro' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/afiliado/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
              <p className="text-muted-foreground">Registre e acompanhe suas vendas</p>
            </div>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Venda</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Valor da Venda (R$) *</Label>
                  <Input 
                    type="number"
                    value={form.valor}
                    onChange={(e) => setForm({...form, valor: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Marketplace *</Label>
                  <Select value={form.marketplace} onValueChange={(v) => setForm({...form, marketplace: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {marketplaces.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {produtos.length > 0 && (
                  <div>
                    <Label>Produto (opcional)</Label>
                    <Select value={form.produto_id} onValueChange={(v) => setForm({...form, produto_id: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Estimativa de Comissão (R$)</Label>
                  <Input 
                    type="number"
                    value={form.estimativa_comissao}
                    onChange={(e) => setForm({...form, estimativa_comissao: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Observação</Label>
                  <Textarea 
                    value={form.observacao}
                    onChange={(e) => setForm({...form, observacao: e.target.value})}
                    placeholder="Detalhes da venda..."
                    rows={2}
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? 'Salvando...' : 'Registrar Venda'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="h-6 w-6 mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold">R$ {stats.valorTotal.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Vendas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">R$ {stats.comissaoEstimada.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Comissão Estimada</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="h-6 w-6 mx-auto text-purple-500 mb-2" />
              <p className="text-2xl font-bold">{stats.totalVendas}</p>
              <p className="text-xs text-muted-foreground">Vendas</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Vendas */}
        {vendas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma venda registrada</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Primeira Venda
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {vendas.map((venda) => (
              <Card key={venda.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-green-500">
                          R$ {Number(venda.valor).toFixed(2)}
                        </span>
                        <span className="text-xs bg-muted px-2 py-1 rounded capitalize">
                          {venda.marketplace}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(venda.data_venda), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {venda.estimativa_comissao && (
                        <p className="text-sm text-blue-500">
                          Comissão: R$ {Number(venda.estimativa_comissao).toFixed(2)}
                        </p>
                      )}
                      {venda.observacao && (
                        <p className="text-sm text-muted-foreground mt-1">{venda.observacao}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(venda.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
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
