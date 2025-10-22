import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthCallbackMetaPage = () => {
  const [message, setMessage] = useState('Processando autenticação...');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');

      if (code) {
        try {
          setMessage('Código recebido. Trocando pelo token de acesso...');
          
          const { data, error } = await supabase.functions.invoke('meta-auth-callback', {
            body: { code },
          });

          if (error) throw error;

          setMessage('Conexão bem-sucedida! Você será redirecionado em breve.');
          setTimeout(() => navigate('/configuracoes'), 3000);

        } catch (err: any) {
          setMessage(`Erro ao conectar com a Meta: ${err.message}`);
        }
      } else {
        setMessage('Erro: Nenhum código de autorização recebido.');
      }
    };

    processAuth();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Conectando com a Meta...</h1>
        <p className="text-gray-700 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallbackMetaPage;
