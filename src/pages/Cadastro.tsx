import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, ArrowLeft, Building2, Loader2, BadgeCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


export default function Cadastro() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    aceitoTermos: false,
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    endereco: {
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      municipio: '',
      uf: ''
    },
    cnae: '',
    cnaeDescricao: ''
  });

  // Máscaras
  const maskCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  // Buscar dados do CNPJ
  const handleCNPJBlur = async () => {
    const cnpj = formData.cnpj.replace(/\D/g, '');
    
    console.log('🔍 CNPJ digitado:', formData.cnpj);
    console.log('🔍 CNPJ limpo:', cnpj);
    
    if (cnpj.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos');
      return;
    }

    setIsLoadingCNPJ(true);
    
    try {
      console.log('📡 Consultando Brasil API para CNPJ:', cnpj);
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      
      console.log('📡 Status da resposta:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro da API:', errorText);
        throw new Error('CNPJ inválido');
      }

      const data = await response.json();
      console.log('✅ Dados recebidos da API:', data);
      
      setFormData(prev => ({
        ...prev,
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || data.razao_social || '',
        cnae: data.cnae_fiscal || '',
        cnaeDescricao: data.cnae_fiscal_descricao || '',
        endereco: {
          cep: data.cep || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          municipio: data.municipio || '',
          uf: data.uf || ''
        }
      }));

      // Plano empresarial personalizado - sem pagamento online
      
      toast.success('Empresa encontrada!');
    } catch (error: any) {
      console.error('❌ Erro ao buscar CNPJ:', error);
      toast.error(error.message || 'CNPJ inválido ou não encontrado');
    } finally {
      setIsLoadingCNPJ(false);
    }
  };

  // Plano empresarial é personalizado - sem detecção automática

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
      // Criar usuário
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome,
            whatsapp: formData.telefone,
            tipo: 'empresa'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Atualizar perfil com dados da empresa - plano personalizado
        const profileUpdate: any = {
          tipo: 'empresa',
          cpf_cnpj: formData.cnpj,
          plano: 'empresarial_personalizado',
          razao_social: formData.razaoSocial,
          nome_fantasia: formData.nomeFantasia,
          cnae: formData.cnae,
          cnae_descricao: formData.cnaeDescricao,
          endereco: formData.endereco
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Erro ao atualizar perfil:', profileError);
        }
      }

      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        {/* Botão Voltar */}
        <button 
          onClick={() => navigate('/')} 
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
            <p className="text-purple-300">Cadastro para empresas em geral</p>
          </div>

          {/* Formulário Empresa */}
          <div className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* CNPJ */}
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    CNPJ *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                    <input
                      type="text"
                      required
                      value={formData.cnpj}
                      onChange={(e) => setFormData({...formData, cnpj: maskCNPJ(e.target.value)})}
                      onBlur={handleCNPJBlur}
                      className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    {isLoadingCNPJ && (
                      <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400 animate-spin" />
                    )}
                  </div>
                  {isLoadingCNPJ && (
                    <p className="text-xs text-purple-400 mt-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Consultando empresa...
                    </p>
                  )}
                </div>

                {/* Razão Social */}
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.razaoSocial}
                    onChange={(e) => setFormData({...formData, razaoSocial: e.target.value})}
                    className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                    placeholder="Empresa LTDA"
                    readOnly={isLoadingCNPJ}
                  />
                </div>

                {/* Nome Fantasia */}
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    Nome Fantasia *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nomeFantasia}
                    onChange={(e) => setFormData({...formData, nomeFantasia: e.target.value})}
                    className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                    placeholder="Minha Empresa"
                    readOnly={isLoadingCNPJ}
                  />
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
                      placeholder="contato@empresa.com"
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

                {/* Telefone/WhatsApp */}
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    Telefone/WhatsApp *
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

                {/* Endereço */}
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    Endereço Completo
                  </label>
                  <textarea
                    value={formData.endereco.logradouro ? 
                      `${formData.endereco.logradouro}, ${formData.endereco.numero} - ${formData.endereco.bairro}, ${formData.endereco.municipio}/${formData.endereco.uf}` 
                      : ''}
                    readOnly
                    className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500 resize-none"
                    rows={2}
                    placeholder="Preencha o CNPJ para buscar automaticamente"
                  />
                </div>

                {/* CNAE */}
                {formData.cnae && (
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-2">
                      CNAE Principal
                    </label>
                    <div className="bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30">
                      <div className="font-semibold">{formData.cnae}</div>
                      <div className="text-sm text-slate-400 mt-1">{formData.cnaeDescricao}</div>
                    </div>
                  </div>
                )}

                {/* Card Plano Empresarial Personalizado */}
                <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl"></div>
                  
                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="inline-flex items-center gap-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold mb-2">
                          <BadgeCheck className="w-4 h-4" />
                          Plano Empresarial
                        </div>
                        <h3 className="text-2xl font-bold text-white">🏭 Distribuidoras e Fábricas</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-white">Personalizado</div>
                        <div className="text-sm text-blue-300">sob consulta</div>
                      </div>
                    </div>

                    <p className="text-slate-300 mb-4">
                      Após o cadastro, nossa equipe entrará em contato para entender suas necessidades e criar um plano personalizado para seu negócio.
                    </p>

                    <a 
                      href="https://wa.me/5521995379550?text=Olá! Acabei de fazer meu cadastro e quero saber mais sobre o plano empresarial."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
                    >
                      <Phone className="w-4 h-4" />
                      Falar com consultor
                    </a>
                  </div>
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
                    Li e aceito os termos de uso e política de privacidade
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-lg font-bold text-lg hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    'CRIAR CONTA EMPRESA'
                  )}
                </button>
              </form>
          </div>

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