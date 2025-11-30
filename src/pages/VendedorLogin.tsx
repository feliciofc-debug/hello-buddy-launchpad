import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, User, ShoppingBag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function VendedorLogin() {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingPassword, setSendingPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: vendedores, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('login', login.toLowerCase().trim())
        .eq('senha', senha)
        .eq('ativo', true);

      if (error) {
        toast.error('Erro ao verificar credenciais');
        setLoading(false);
        return;
      }

      if (!vendedores || vendedores.length === 0) {
        toast.error('Login ou senha incorretos');
        setLoading(false);
        return;
      }

      const vendedor = vendedores[0];

      localStorage.setItem('vendedor_session', JSON.stringify({
        id: vendedor.id,
        nome: vendedor.nome,
        email: vendedor.email,
        especialidade: vendedor.especialidade,
        logged_at: new Date().toISOString()
      }));

      toast.success(`Bem-vindo, ${vendedor.nome}!`);
      navigate('/vendedor-painel');
    } catch (err) {
      console.error('Erro no login:', err);
      toast.error('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      toast.error('Digite seu email cadastrado');
      return;
    }

    setSendingPassword(true);

    try {
      // Buscar vendedor pelo email
      const { data: vendedor, error } = await supabase
        .from('vendedores')
        .select('id, nome, email')
        .eq('email', forgotEmail.toLowerCase().trim())
        .eq('ativo', true)
        .single();

      if (error || !vendedor) {
        toast.error('Email não encontrado no sistema');
        setSendingPassword(false);
        return;
      }

      // Gerar nova senha aleatória
      const novaSenha = Math.random().toString(36).slice(-8);

      // Atualizar senha no banco
      const { error: updateError } = await supabase
        .from('vendedores')
        .update({ senha: novaSenha })
        .eq('id', vendedor.id);

      if (updateError) {
        toast.error('Erro ao gerar nova senha');
        setSendingPassword(false);
        return;
      }

      // Mostrar nova senha para o usuário copiar
      toast.success(`Nova senha gerada: ${novaSenha}`, {
        duration: 10000,
        description: 'Copie e guarde em local seguro!'
      });

      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (err) {
      console.error('Erro ao recuperar senha:', err);
      toast.error('Erro ao recuperar senha');
    } finally {
      setSendingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-600 to-yellow-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-orange-600">AMZ</h1>
              <p className="text-sm font-medium text-muted-foreground -mt-1">OFERTAS</p>
            </div>
          </div>
          <CardTitle className="text-xl">Portal do Vendedor</CardTitle>
          <CardDescription>
            Acesse suas conversas e gerencie seus leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Login</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Seu login ou email"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold" 
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="w-full text-center text-sm text-orange-600 hover:text-orange-700 hover:underline mt-4"
          >
            Esqueci minha senha
          </button>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Suas credenciais foram enviadas via WhatsApp pelo administrador
          </p>
        </CardContent>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu email cadastrado para receber uma nova senha via WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="seu@email.com"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleForgotPassword}
                disabled={sendingPassword}
                className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              >
                {sendingPassword ? 'Enviando...' : 'Enviar Nova Senha'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}