import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, CreditCard, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Cadastro() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    cpf: '',
    senha: '',
    confirmarSenha: '',
    amazonId: '',
    hotmartEmail: '',
    shopeeId: '',
    tiktokShopId: '',
    mercadoLivreId: '',
    aceitoTermos: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      // Validar senhas
      if (formData.senha !== formData.confirmarSenha) {
        toast.error('As senhas não coincidem');
        return;
      }
      if (formData.senha.length < 6) {
        toast.error('A senha deve ter no mínimo 6 caracteres');
        return;
      }
      setStep(2);
    } else {
      // Cadastrar usuário
      setIsLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.senha,
          options: {
            data: {
              nome: formData.nome,
              whatsapp: formData.whatsapp,
              cpf: formData.cpf
            },
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          // Atualizar perfil com IDs de afiliado
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              amazon_id: formData.amazonId || null,
              hotmart_email: formData.hotmartEmail || null,
              shopee_id: formData.shopeeId || null,
              tiktok_shop_id: formData.tiktokShopId || null,
              mercado_livre_id: formData.mercadoLivreId || null
            })
            .eq('id', authData.user.id);

          if (profileError) {
            console.error('Erro ao atualizar perfil:', profileError);
          }
        }

        toast.success('Conta criada com sucesso!');
        navigate('/planos');
      } catch (error: any) {
        toast.error(error.message || 'Erro ao criar conta');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Botão Voltar */}
        <button 
          onClick={() => step === 1 ? navigate('/') : setStep(1)} 
          className="flex items-center gap-2 text-purple-300 hover:text-white mb-8 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>

        {/* Card Cadastro */}
        <div className="bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 rounded-xl inline-block mb-4">
              <svg className="w-10 h-10" fill="white" viewBox="0 0 24 24">
                <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Criar Conta</h1>
            <p className="text-purple-300">7 dias grátis • Sem cartão de crédito</p>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-purple-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
              </div>
              <span className="text-sm font-medium">Dados Pessoais</span>
            </div>
            <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-purple-500' : 'bg-slate-700'}`}></div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-purple-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                2
              </div>
              <span className="text-sm font-medium">IDs de Afiliado</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 ? (
              <>
                {/* STEP 1: DADOS PESSOAIS */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Nome */}
                  <div className="md:col-span-2">
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
                        placeholder="João Silva"
                      />
                    </div>
                  </div>

                  {/* Email */}
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

                  {/* WhatsApp */}
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      WhatsApp *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                      <input
                        type="tel"
                        required
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                        className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>

                  {/* CPF/CNPJ */}
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      CPF ou CNPJ *
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                      <input
                        type="text"
                        required
                        value={formData.cpf}
                        onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                        className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>

                  {/* Senha */}
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
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {/* Confirmar Senha */}
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      Confirmar Senha *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                      <input
                        type="password"
                        required
                        value={formData.confirmarSenha}
                        onChange={(e) => setFormData({...formData, confirmarSenha: e.target.value})}
                        className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
                >
                  Próximo Passo →
                </button>
              </>
            ) : (
              <>
                {/* STEP 2: IDs DE AFILIADO */}
                <div className="space-y-6">
                  <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-4 mb-6">
                    <p className="text-orange-300 text-sm">
                      💡 <strong>Importante:</strong> Adicione seus IDs de afiliado para começar a ganhar comissões! Você pode pular e adicionar depois.
                    </p>
                  </div>

                  {/* Amazon Associate ID */}
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      Amazon Associate ID
                    </label>
                    <input
                      type="text"
                      value={formData.amazonId}
                      onChange={(e) => setFormData({...formData, amazonId: e.target.value})}
                      className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="seunome-20"
                    />
                    <p className="text-xs text-slate-400 mt-1">Ex: seunome-20</p>
                  </div>

                  {/* Hotmart Email */}
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      Hotmart Email
                    </label>
                    <input
                      type="email"
                      value={formData.hotmartEmail}
                      onChange={(e) => setFormData({...formData, hotmartEmail: e.target.value})}
                      className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="seu@email.com"
                    />
                    <p className="text-xs text-slate-400 mt-1">Email cadastrado na Hotmart</p>
                  </div>

                  {/* Shopee Affiliate ID */}
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      Shopee Affiliate ID
                    </label>
                    <input
                      type="text"
                      value={formData.shopeeId}
                      onChange={(e) => setFormData({...formData, shopeeId: e.target.value})}
                      className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="12345678"
                    />
                    <p className="text-xs text-slate-400 mt-1">ID de afiliado Shopee</p>
                  </div>

                  {/* TikTok Shop Affiliate ID */}
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      TikTok Shop Affiliate ID
                    </label>
                    <input
                      type="text"
                      value={formData.tiktokShopId}
                      onChange={(e) => setFormData({...formData, tiktokShopId: e.target.value})}
                      className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="TS12345678"
                    />
                    <p className="text-xs text-slate-400 mt-1">ID de afiliado TikTok Shop</p>
                  </div>

                  {/* Mercado Livre User ID */}
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      Mercado Livre User ID
                    </label>
                    <input
                      type="text"
                      value={formData.mercadoLivreId}
                      onChange={(e) => setFormData({...formData, mercadoLivreId: e.target.value})}
                      className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="USERID123"
                    />
                    <p className="text-xs text-slate-400 mt-1">User ID do Mercado Livre</p>
                  </div>

                  {/* Termos */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      required
                      checked={formData.aceitoTermos}
                      onChange={(e) => setFormData({...formData, aceitoTermos: e.target.checked})}
                      className="mt-1 w-5 h-5 text-purple-500 bg-slate-700 border-purple-500/30 rounded focus:ring-purple-500"
                    />
                    <label className="text-sm text-slate-300">
                      Eu aceito os <a href="#" className="text-purple-400 hover:underline">Termos de Uso</a> e <a href="#" className="text-purple-400 hover:underline">Política de Privacidade</a>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-lg font-bold text-lg hover:shadow-lg transition disabled:opacity-50"
                >
                  {isLoading ? 'Criando conta...' : '🎉 Criar Conta Grátis'}
                </button>
              </>
            )}
          </form>

          {/* Login Link */}
          <div className="text-center mt-6">
            <p className="text-slate-400">
              Já tem conta? <button onClick={() => navigate('/login')} className="text-purple-400 hover:text-purple-300 font-semibold">Fazer login</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}