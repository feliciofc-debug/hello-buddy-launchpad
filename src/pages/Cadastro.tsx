import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, CreditCard, ArrowLeft, Building2, UserCircle, Loader2, BadgeCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Cadastro() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<'afiliado' | 'empresa'>('afiliado');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);
  const [suggestedPlan, setSuggestedPlan] = useState<{
    plano: string;
    valor: number;
    mensagem: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    // Comum
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    aceitoTermos: false,

    // Afiliado
    cpf: '',

    // Empresa
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
  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

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

      // Detectar plano baseado no CNAE
      detectPlan(data.cnae_fiscal);
      
      toast.success('Empresa encontrada!');
    } catch (error: any) {
      console.error('❌ Erro ao buscar CNPJ:', error);
      toast.error(error.message || 'CNPJ inválido ou não encontrado');
    } finally {
      setIsLoadingCNPJ(false);
    }
  };

  // Detectar plano baseado no CNAE
  const detectPlan = (cnae: string) => {
    const cnaesIndustria = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'];
    const cnaesConcessionaria = ['4511-1/01', '4511-1/02'];
    const cnaesDistribuidor = ['4681-8/01', '4681-8/02', '4681-8/99'];

    const cnaeCode = cnae.substring(0, 2);

    if (cnaesIndustria.includes(cnaeCode) || cnaesConcessionaria.includes(cnae) || cnaesDistribuidor.includes(cnae)) {
      setSuggestedPlan({
        plano: 'premium',
        valor: 997.00,
        mensagem: '🏭 Plano Indústria/Distribuidor'
      });
    } else {
      setSuggestedPlan({
        plano: 'empresas',
        valor: 447.00,
        mensagem: '🏪 Plano Empresas'
      });
    }
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
      // Criar usuário
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome,
            whatsapp: formData.telefone,
            cpf: userType === 'afiliado' ? formData.cpf : '',
            tipo: userType
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Atualizar perfil com dados específicos
        const profileUpdate: any = {
          tipo: userType,
          cpf_cnpj: userType === 'afiliado' ? formData.cpf : formData.cnpj,
          plano: userType === 'afiliado' ? 'free' : (suggestedPlan?.plano || 'empresas'),
          valor_plano: userType === 'afiliado' ? 147.00 : (suggestedPlan?.valor || 447.00)
        };

        if (userType === 'empresa') {
          profileUpdate.razao_social = formData.razaoSocial;
          profileUpdate.nome_fantasia = formData.nomeFantasia;
          profileUpdate.cnae = formData.cnae;
          profileUpdate.cnae_descricao = formData.cnaeDescricao;
          profileUpdate.endereco = formData.endereco;
        }

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
            <p className="text-purple-300">Escolha o tipo de cadastro</p>
          </div>

          {/* Tabs Afiliado/Empresa */}
          <Tabs value={userType} onValueChange={(v) => setUserType(v as 'afiliado' | 'empresa')} className="mb-8">
            <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-slate-700/50">
              <TabsTrigger 
                value="afiliado" 
                className="flex items-center gap-3 py-4 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
              >
                <UserCircle className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-bold">👤 SOU AFILIADO</div>
                  <div className="text-xs opacity-80">CPF</div>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="empresa" 
                className="flex items-center gap-3 py-4 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
              >
                <Building2 className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-bold">🏢 SOU EMPRESA</div>
                  <div className="text-xs opacity-80">CNPJ</div>
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Form Afiliado */}
            <TabsContent value="afiliado" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome Completo */}
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
                      placeholder="João Silva"
                    />
                  </div>
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">
                    CPF *
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                    <input
                      type="text"
                      required
                      value={formData.cpf}
                      onChange={(e) => setFormData({...formData, cpf: maskCPF(e.target.value)})}
                      className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                      placeholder="000.000.000-00"
                      maxLength={14}
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
                    'CRIAR CONTA AFILIADO'
                  )}
                </button>
              </form>
            </TabsContent>

            {/* Form Empresa */}
            <TabsContent value="empresa" className="mt-6">
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

                {/* Card do Plano Sugerido */}
                {suggestedPlan && (
                  <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500 rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl"></div>
                    
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="inline-flex items-center gap-2 bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-bold mb-2">
                            <BadgeCheck className="w-4 h-4" />
                            Plano Recomendado
                          </div>
                          <h3 className="text-2xl font-bold text-white">{suggestedPlan.mensagem}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-white">R$ {suggestedPlan.valor.toFixed(2)}</div>
                          <div className="text-sm text-purple-300">/mês</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-green-400">
                          <span>✅</span>
                          <span>Postagens ilimitadas</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-400">
                          <span>✅</span>
                          <span>IA avançada</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-400">
                          <span>✅</span>
                          <span>Suporte prioritário</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-400">
                          <span>✅</span>
                          <span>Google Ads integrado</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-400">
                          <span>✅</span>
                          <span>Analytics completo</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-400">
                          <span>✅</span>
                          <span>WhatsApp em massa</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
            </TabsContent>
          </Tabs>

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