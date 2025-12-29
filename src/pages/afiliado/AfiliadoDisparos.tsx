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
import { ArrowLeft, Plus, Send, Clock, CheckCircle, XCircle, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Disparo {
  id: string;
  produto_id: string | null;
  data_agendada: string;
  status: string;
  destinatarios: string[] | null;
  tipo_envio: string | null;
  mensagem: string | null;
  data_envio: string | null;
}

interface Produto {
  id: string;
  titulo: string;
}

export default function AfiliadoDisparos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disparos, setDisparos] = useState<Disparo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [form, setForm] = useState({
    produto_id: '',
    data_agendada: '',
    hora_agendada: '10:00',
    tipo_envio: 'individual',
    destinatarios: '',
    mensagem: ''
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

      const [disparosRes, produtosRes] = await Promise.all([
        supabase
          .from('afiliado_disparos')
          .select('*')
          .eq('user_id', user.id)
          .order('data_agendada', { ascending: false }),
        supabase
          .from('afiliado_produtos')
          .select('id, titulo')
          .eq('user_id', user.id)
      ]);

      if (disparosRes.error) throw disparosRes.error;
      
      setDisparos(disparosRes.data || []);
      setProdutos(produtosRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar:', error);
      toast.error('Erro ao carregar disparos');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      produto_id: '',
      data_agendada: '',
      hora_agendada: '10:00',
      tipo_envio: 'individual',
      destinatarios: '',
      mensagem: ''
    });
  };

  const handleSave = async () => {
    if (!form.data_agendada || !form.mensagem) {
      toast.error('Preencha data e mensagem');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Combinar data e hora
      const dataHora = new Date(`${form.data_agendada}T${form.hora_agendada}:00`);
      
      // Processar destinatários
      const destinatarios = form.destinatarios
        .split(/[,\n]/)
        .map(d => d.trim().replace(/\D/g, ''))
        .filter(d => d.length >= 10);

      const disparoData = {
        produto_id: form.produto_id || null,
        data_agendada: dataHora.toISOString(),
        tipo_envio: form.tipo_envio,
        destinatarios: destinatarios.length > 0 ? destinatarios : null,
        mensagem: form.mensagem,
        user_id: user.id
      };

      const { error } = await supabase
        .from('afiliado_disparos')
        .insert(disparoData);
      
      if (error) throw error;
      
      toast.success('Disparo agendado!');
      resetForm();
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao agendar disparo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Cancelar este disparo?')) return;

    try {
      const { error } = await supabase
        .from('afiliado_disparos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Disparo cancelado');
      loadData();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error(error.message || 'Erro ao cancelar');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'enviado': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'falhou': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'enviado': return 'Enviado';
      case 'falhou': return 'Falhou';
      default: return 'Agendado';
    }
  };

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
              <h1 className="text-2xl font-bold text-foreground">Disparos</h1>
              <p className="text-muted-foreground">Agende envios em massa</p>
            </div>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agendar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Agendar Disparo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data *</Label>
                    <Input 
                      type="date"
                      value={form.data_agendada}
                      onChange={(e) => setForm({...form, data_agendada: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label>Hora *</Label>
                    <Input 
                      type="time"
                      value={form.hora_agendada}
                      onChange={(e) => setForm({...form, hora_agendada: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label>Tipo de Envio</Label>
                  <Select value={form.tipo_envio} onValueChange={(v) => setForm({...form, tipo_envio: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="grupo">Grupo</SelectItem>
                      <SelectItem value="lista">Lista de Transmissão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Destinatários (números separados por vírgula ou linha)</Label>
                  <Textarea 
                    value={form.destinatarios}
                    onChange={(e) => setForm({...form, destinatarios: e.target.value})}
                    placeholder="5511999999999&#10;5511888888888"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Mensagem *</Label>
                  <Textarea 
                    value={form.mensagem}
                    onChange={(e) => setForm({...form, mensagem: e.target.value})}
                    placeholder="Sua mensagem aqui..."
                    rows={4}
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? 'Agendando...' : 'Agendar Disparo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Disparos */}
        {disparos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum disparo agendado</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agendar Primeiro Disparo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {disparos.map((disparo) => (
              <Card key={disparo.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(disparo.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getStatusLabel(disparo.status)}</span>
                          <span className="text-xs bg-muted px-2 py-1 rounded capitalize">
                            {disparo.tipo_envio || 'individual'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(disparo.data_agendada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {disparo.mensagem && (
                          <p className="text-sm mt-2 line-clamp-2">{disparo.mensagem}</p>
                        )}
                        {disparo.destinatarios && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {disparo.destinatarios.length} destinatário(s)
                          </p>
                        )}
                      </div>
                    </div>
                    {disparo.status === 'agendado' && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(disparo.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
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
