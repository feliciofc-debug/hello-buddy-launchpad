import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, UserCircle, ArrowLeft } from 'lucide-react';

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  foto_url?: string;
  especialidade?: string;
  meta_mensal?: number;
  comissao_percentual?: number;
  ativo: boolean;
  whatsapp?: string;
  created_at: string;
}

export default function Vendedores() {
  const navigate = useNavigate();
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [vendedorEditando, setVendedorEditando] = useState<Vendedor | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    especialidade: '',
    meta_mensal: '',
    comissao_percentual: '5',
    whatsapp: ''
  });

  useEffect(() => {
    loadVendedores();
  }, []);

  const loadVendedores = async () => {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setVendedores(data || []);
    setLoading(false);
  };

  const handleSalvar = async () => {
    if (!formData.nome || !formData.email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }

    try {
      const payload = {
        nome: formData.nome,
        email: formData.email,
        especialidade: formData.especialidade || null,
        meta_mensal: formData.meta_mensal ? parseFloat(formData.meta_mensal) : 0,
        comissao_percentual: formData.comissao_percentual ? parseFloat(formData.comissao_percentual) : 5,
        whatsapp: formData.whatsapp || null
      };

      if (vendedorEditando) {
        const { error } = await supabase
          .from('vendedores')
          .update(payload)
          .eq('id', vendedorEditando.id);
        
        if (error) throw error;
        toast.success('Vendedor atualizado!');
      } else {
        // Gerar senha automática: primeiro nome + "123"
        const primeiroNome = formData.nome.split(' ')[0];
        const senhaGerada = primeiroNome + '123';
        
        const { data: novoVendedor, error } = await supabase
          .from('vendedores')
          .insert({
            ...payload,
            senha: senhaGerada
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Enviar credenciais via WhatsApp se tiver número
        if (formData.whatsapp) {
          try {
            await supabase.functions.invoke('send-wuzapi-message', {
              body: {
                phoneNumber: formData.whatsapp,
                message: `🔐 *AMZ Ofertas - Credenciais de Acesso*\n\nOlá ${primeiroNome}! 👋\n\nSeu cadastro como vendedor foi concluído!\n\n📧 *Login:* ${formData.email}\n🔑 *Senha:* ${senhaGerada}\n\n🔗 Acesse: amzofertas.com.br/vendedor-login\n\nBoas vendas! 🚀`
              }
            });
            toast.success('Vendedor cadastrado! Credenciais enviadas via WhatsApp ✅');
          } catch (whatsappError) {
            console.error('Erro ao enviar WhatsApp:', whatsappError);
            toast.success(`Vendedor cadastrado!\n\nCredenciais:\nLogin: ${formData.email}\nSenha: ${senhaGerada}`);
          }
        } else {
          toast.success(`Vendedor cadastrado!\n\nCredenciais:\nLogin: ${formData.email}\nSenha: ${senhaGerada}`);
        }
      }

      setModalAberto(false);
      setVendedorEditando(null);
      setFormData({
        nome: '',
        email: '',
        especialidade: '',
        meta_mensal: '',
        comissao_percentual: '5',
        whatsapp: ''
      });
      loadVendedores();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleEditar = (vendedor: Vendedor) => {
    setVendedorEditando(vendedor);
    setFormData({
      nome: vendedor.nome,
      email: vendedor.email,
      especialidade: vendedor.especialidade || '',
      meta_mensal: vendedor.meta_mensal?.toString() || '',
      comissao_percentual: vendedor.comissao_percentual?.toString() || '5',
      whatsapp: vendedor.whatsapp || ''
    });
    setModalAberto(true);
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Tem certeza? Isso vai desatribuir todos os leads deste vendedor.')) {
      return;
    }

    const { error } = await supabase.from('vendedores').delete().eq('id', id);
    
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
      return;
    }
    
    toast.success('Vendedor removido');
    loadVendedores();
  };

  const handleToggleAtivo = async (vendedor: Vendedor) => {
    const { error } = await supabase
      .from('vendedores')
      .update({ ativo: !vendedor.ativo })
      .eq('id', vendedor.id);

    if (!error) {
      toast.success(vendedor.ativo ? 'Vendedor desativado' : 'Vendedor ativado');
      loadVendedores();
    }
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 min-h-screen overflow-auto bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">👥 Vendedores</h1>
            <p className="text-muted-foreground">
              Gerencie sua equipe de vendas e atribuições
            </p>
          </div>
        </div>
        <Button onClick={() => {
          setVendedorEditando(null);
          setFormData({
            nome: '',
            email: '',
            especialidade: '',
            meta_mensal: '',
            comissao_percentual: '5',
            whatsapp: ''
          });
          setModalAberto(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Vendedor
        </Button>
      </div>

      {vendedores.length === 0 ? (
        <Card className="p-12 text-center">
          <UserCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">Nenhum vendedor cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Cadastre vendedores para começar a atribuir leads e campanhas
          </p>
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Primeiro Vendedor
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendedores.map(vendedor => (
            <Card key={vendedor.id} className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {vendedor.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold">{vendedor.nome}</h3>
                    <p className="text-sm text-muted-foreground">{vendedor.email}</p>
                  </div>
                </div>
                <Badge 
                  variant={vendedor.ativo ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => handleToggleAtivo(vendedor)}
                >
                  {vendedor.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {vendedor.especialidade && (
                <p className="text-sm mb-2">
                  <strong>Especialidade:</strong> {vendedor.especialidade}
                </p>
              )}

              {vendedor.whatsapp && (
                <p className="text-sm mb-2">
                  <strong>WhatsApp:</strong> {vendedor.whatsapp}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div>
                  <p className="text-muted-foreground">Meta Mensal</p>
                  <p className="font-semibold">
                    {vendedor.meta_mensal ? `R$ ${Number(vendedor.meta_mensal).toLocaleString('pt-BR')}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Comissão</p>
                  <p className="font-semibold">{vendedor.comissao_percentual || 5}%</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEditar(vendedor)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExcluir(vendedor.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {vendedorEditando ? 'Editar Vendedor' : 'Novo Vendedor'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Nome Completo *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                placeholder="João Silva"
              />
            </div>

            <div>
              <Label className="mb-2 block">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="joao@empresa.com"
              />
            </div>

            <div>
              <Label className="mb-2 block">WhatsApp</Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                placeholder="+5521999999999"
              />
            </div>

            <div>
              <Label className="mb-2 block">Especialidade</Label>
              <Input
                value={formData.especialidade}
                onChange={(e) => setFormData({...formData, especialidade: e.target.value})}
                placeholder="Ex: Apartamentos à Venda, SUVs Novos, Cardiologia"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Meta Mensal (R$)</Label>
                <Input
                  type="number"
                  value={formData.meta_mensal}
                  onChange={(e) => setFormData({...formData, meta_mensal: e.target.value})}
                  placeholder="50000"
                />
              </div>

              <div>
                <Label className="mb-2 block">Comissão (%)</Label>
                <Input
                  type="number"
                  value={formData.comissao_percentual}
                  onChange={(e) => setFormData({...formData, comissao_percentual: e.target.value})}
                  placeholder="5"
                  step="0.5"
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleSalvar}>
              {vendedorEditando ? 'Atualizar' : 'Cadastrar'} Vendedor
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
