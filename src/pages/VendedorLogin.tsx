import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { MessageSquare, Lock, User } from 'lucide-react';

export default function VendedorLogin() {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Portal do Vendedor</CardTitle>
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
                  placeholder="Seu login"
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Suas credenciais foram enviadas via WhatsApp pelo administrador
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
