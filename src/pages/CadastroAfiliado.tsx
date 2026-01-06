import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, ArrowLeft, Check, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CadastroAfiliado() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [planoTipo, setPlanoTipo] = useState<'mensal' | 'anual'>('mensal');

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    aceitoTermos: false,
  });

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.aceitoTermos) {
      toast.error('Você precisa aceitar os termos de uso');
      return;
    }

    if (formData.senha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome,
            whatsapp: formData.telefone,
            tipo: 'afiliado'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            tipo: 'afiliado',
            plano: planoTipo === 'anual' ? 'afiliado_anual' : 'afiliado_mensal',
            valor_plano: planoTipo === 'anual' ? 237 : 297
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Erro ao atualizar perfil:', profileError);
        }

        // Criar registro em clientes_afiliados
        await supabase.from('clientes_afiliados').insert({
          user_id: authData.user.id,
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone.replace(/\D/g, ''),
          plano: planoTipo === 'anual' ? 'afiliado_anual' : 'afiliado_mensal',
          status: 'pendente'
        });
      }

      toast.success('Conta criada com sucesso! Redirecionando para pagamento...');
      navigate('/planos');
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        toast.error('Este email já está cadastrado. Faça login ou use outro email.');
      } else {
        toast.error(error.message || 'Erro ao criar conta');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    'Produtos baixados automaticamente',
    'Amazon, Magalu, Mercado Livre, Boticário',
    'Mensagens ilimitadas no WhatsApp',
    'IA gera textos e vídeos promocionais',
    'Campanhas agendadas automáticas',
    'Listas segmentadas de clientes',
    'Variação de mensagens anti-bloqueio',
    'Suporte via WhatsApp'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="fixed w-full top-0 z-50 bg-slate-900/95 backdrop-blur-lg border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 text-purple-300 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-purple-300 hover:text-white transition"
            >
              Já tenho conta
            </button>
          </div>
        </div>
      </div>

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Título */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Comece a Ganhar com <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Marketing de Afiliados</span>
            </h1>
            <p className="text-xl text-purple-200">
              Cadastre-se agora e tenha acesso a todas as ferramentas
            </p>
          </div>

          {/* Grid Cadastro + Plano */}
          <div className="grid lg:grid-cols-2 gap-8 mb-16">
            {/* Formulário */}
            <div className="bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Criar Conta de Afiliado</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                    <input
                      type="text"
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="Seu nome completo"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    Senha *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                    <input
                      type="password"
                      required
                      value={formData.senha}
                      onChange={(e) => setFormData({...formData, senha: e.target.value})}
                      className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                    <input
                      type="tel"
                      required
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: maskPhone(e.target.value)})}
                      className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="termos"
                    checked={formData.aceitoTermos}
                    onChange={(e) => setFormData({...formData, aceitoTermos: e.target.checked})}
                    className="mt-1 w-5 h-5 text-purple-500 bg-slate-700 border-purple-500/30 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="termos" className="text-sm text-slate-300">
                    Aceito os{' '}
                    <a href="/terms" className="text-purple-400 hover:text-purple-300 underline">
                      Termos de Uso
                    </a>{' '}
                    e{' '}
                    <a href="/privacy" className="text-purple-400 hover:text-purple-300 underline">
                      Política de Privacidade
                    </a>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Criando conta...' : '🚀 Criar Conta e Contratar'}
                </button>
              </form>
            </div>

            {/* Card do Plano */}
            <div className="bg-gradient-to-br from-orange-500/20 to-purple-500/20 border-2 border-orange-500 rounded-2xl p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  MAIS POPULAR
                </span>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Plano Afiliado AMZ Ofertas</h3>
              <p className="text-purple-200 mb-6">Tudo que você precisa para ganhar dinheiro como afiliado</p>

              {/* Seletor de Plano */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setPlanoTipo('mensal')}
                  className={`p-4 rounded-xl border-2 transition ${
                    planoTipo === 'mensal' 
                      ? 'border-green-500 bg-green-500/20' 
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <p className="text-sm text-slate-300 mb-1">Mensal</p>
                  <p className="text-3xl font-bold text-white">R$ 297</p>
                  <p className="text-xs text-slate-400">/mês</p>
                </button>

                <button
                  onClick={() => setPlanoTipo('anual')}
                  className={`p-4 rounded-xl border-2 transition relative ${
                    planoTipo === 'anual' 
                      ? 'border-orange-500 bg-orange-500/20' 
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <span className="absolute -top-2 right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                    ECONOMIA
                  </span>
                  <p className="text-sm text-slate-300 mb-1">Anual</p>
                  <p className="text-2xl font-bold text-white">12x R$ 237</p>
                  <p className="text-xs text-slate-400">total R$ 2.844</p>
                </button>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                    <span className="text-white">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                <p className="text-slate-300 text-sm">
                  💳 Pagamento seguro • Acesso imediato • Cancele quando quiser
                </p>
              </div>
            </div>
          </div>

          {/* Seção Empresas */}
          <div id="empresas" className="scroll-mt-24">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Para Empresas</h2>
              <p className="text-purple-200">Distribuidoras, fábricas e operações maiores</p>
            </div>

            <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/40 rounded-2xl p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="text-6xl">🏭</div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-white mb-3">Plano Empresarial Personalizado</h3>
                  <p className="text-slate-300 mb-4">
                    Solução sob medida para distribuidoras, fábricas e operações de grande porte. 
                    Automações avançadas, múltiplos usuários, integrações customizadas e suporte dedicado.
                  </p>
                  <ul className="grid md:grid-cols-2 gap-2 text-sm text-slate-300 mb-6">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-400" />
                      Múltiplos vendedores
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-400" />
                      Automações B2B
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-400" />
                      Integrações personalizadas
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-400" />
                      Suporte dedicado
                    </li>
                  </ul>
                </div>
                <div className="flex flex-col gap-3">
                  <a
                    href="https://wa.me/5521995379550?text=Olá! Tenho interesse no Plano Empresarial AMZ Ofertas para minha empresa."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl transition transform hover:scale-105 text-center"
                  >
                    📱 Falar no WhatsApp
                  </a>
                  <button
                    onClick={() => navigate('/cadastro')}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-xl font-semibold transition text-center"
                  >
                    Fazer cadastro empresarial
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}