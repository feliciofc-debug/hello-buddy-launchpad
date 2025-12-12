import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const FooterOptIn = () => {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [aceite, setAceite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ nome?: string; whatsapp?: string; aceite?: string }>({});
  const nomeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-focus no primeiro campo
  useEffect(() => {
    nomeRef.current?.focus();
  }, []);

  // Máscara de WhatsApp
  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers.length > 0 ? `(${numbers}` : '';
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value);
    setWhatsapp(formatted);
    if (errors.whatsapp) setErrors(prev => ({ ...prev, whatsapp: undefined }));
  };

  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNome(e.target.value);
    if (errors.nome) setErrors(prev => ({ ...prev, nome: undefined }));
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    if (nome.trim().length < 3) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }
    
    const whatsappPattern = /^\(\d{2}\) \d{5}-\d{4}$/;
    if (!whatsappPattern.test(whatsapp)) {
      newErrors.whatsapp = 'WhatsApp inválido. Use (XX) XXXXX-XXXX';
    }
    
    if (!aceite) {
      newErrors.aceite = 'Você deve aceitar os termos';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Shake animation nos campos com erro
      formRef.current?.classList.add('shake');
      setTimeout(() => formRef.current?.classList.remove('shake'), 500);
      return;
    }
    
    setLoading(true);
    
    try {
      // Obter IP (opcional, pode falhar)
      let ipAddress = '';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch {
        console.log('Não foi possível obter IP');
      }
      
      // Chamar edge function que registra e envia WhatsApp
      const { data, error } = await supabase.functions.invoke('registrar-optin', {
        body: {
          nome: nome.trim(),
          whatsapp: whatsapp,
          aceite: true,
          origem: 'site_footer',
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
          termo_aceite: 'Autorizo a AMZ Ofertas a me enviar informações, ofertas e conteúdos via WhatsApp. Posso cancelar enviando SAIR.'
        }
      });
      
      if (error) {
        console.error('Erro edge function:', error);
        throw new Error(error.message || 'Erro ao cadastrar');
      }
      
      // Verificar resposta
      if (data?.duplicate) {
        toast.warning('⚠️ Este WhatsApp já está cadastrado!');
      } else if (data?.success) {
        toast.success('✅ Cadastro confirmado! Você receberá uma mensagem de boas-vindas no WhatsApp.');
        
        // Analytics event
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'opt_in_footer', {
            'event_category': 'cadastro',
            'event_label': 'footer_whatsapp'
          });
        }
        
        // Limpar formulário
        setNome('');
        setWhatsapp('');
        setAceite(false);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar:', error);
      toast.error('❌ ' + (error.message || 'Erro ao cadastrar. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNome('');
        setWhatsapp('');
        setAceite(false);
        setErrors({});
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <section 
      className="w-full py-[60px] px-10 md:py-[60px] md:px-[40px] text-white text-center"
      style={{ background: 'linear-gradient(135deg, #E31E24 0%, #C62828 100%)' }}
    >
      {/* Ícone */}
      <div className="text-5xl mb-4">📱</div>
      
      {/* Título */}
      <h2 className="text-2xl md:text-[28px] font-bold mb-2">
        RECEBA OFERTAS EXCLUSIVAS NO WHATSAPP
      </h2>
      
      {/* Subtítulo */}
      <p className="text-base opacity-95 mb-8">
        Cadastre-se e fique por dentro das novidades da AMZ Ofertas
      </p>
      
      {/* Formulário */}
      <form 
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row gap-4 justify-center items-start max-w-[900px] mx-auto"
      >
        {/* Campo Nome */}
        <div className="w-full md:w-auto flex flex-col items-start">
          <input
            ref={nomeRef}
            type="text"
            name="nome"
            value={nome}
            onChange={handleNomeChange}
            placeholder="Seu nome completo"
            className={`w-full md:w-[280px] h-[50px] rounded-lg border-none px-5 text-base text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${errors.nome ? 'ring-2 ring-red-500' : ''}`}
            disabled={loading}
          />
          {errors.nome && (
            <span className="text-xs text-yellow-200 mt-1 text-left">{errors.nome}</span>
          )}
        </div>
        
        {/* Campo WhatsApp */}
        <div className="w-full md:w-auto flex flex-col items-start">
          <input
            type="tel"
            name="whatsapp"
            value={whatsapp}
            onChange={handleWhatsAppChange}
            placeholder="(00) 00000-0000"
            maxLength={15}
            className={`w-full md:w-[200px] h-[50px] rounded-lg border-none px-5 text-base text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${errors.whatsapp ? 'ring-2 ring-red-500' : ''}`}
            disabled={loading}
          />
          {errors.whatsapp && (
            <span className="text-xs text-yellow-200 mt-1 text-left">{errors.whatsapp}</span>
          )}
        </div>
        
        {/* Botão */}
        <button
          type="submit"
          disabled={loading}
          className="w-full md:w-[160px] h-[50px] bg-white text-[#E31E24] font-bold text-base rounded-lg border-none cursor-pointer transition-all duration-300 hover:bg-yellow-400 hover:text-gray-800 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              ENVIANDO...
            </>
          ) : (
            'CADASTRAR'
          )}
        </button>
      </form>
      
      {/* Checkbox */}
      <div className="flex items-start justify-center gap-3 mt-5 max-w-[600px] mx-auto">
        <input
          type="checkbox"
          name="aceite"
          id="aceite"
          checked={aceite}
          onChange={(e) => {
            setAceite(e.target.checked);
            if (errors.aceite) setErrors(prev => ({ ...prev, aceite: undefined }));
          }}
          className={`w-5 h-5 mt-0.5 accent-yellow-400 cursor-pointer ${errors.aceite ? 'ring-2 ring-red-500 rounded' : ''}`}
          disabled={loading}
        />
        <label 
          htmlFor="aceite" 
          className="text-sm text-left cursor-pointer opacity-95"
        >
          Autorizo a AMZ Ofertas a me enviar informações, ofertas e conteúdos via WhatsApp. Posso cancelar enviando SAIR.
        </label>
      </div>
      {errors.aceite && (
        <span className="text-xs text-yellow-200 mt-2 block">{errors.aceite}</span>
      )}
      
      {/* Texto Legal */}
      <p className="text-xs opacity-80 mt-6 text-center">
        🔒 Seus dados estão seguros e protegidos.<br />
        Você pode cancelar o recebimento a qualquer momento.{' '}
        <Link to="/politica-privacidade" className="underline hover:text-yellow-200 transition-colors">
          Política de Privacidade
        </Link>
      </p>
      
      {/* CSS para shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        .shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </section>
  );
};

export default FooterOptIn;
