import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const AuthCallbackMetaPage = () => {
  const [message, setMessage] = useState('Processando autenticação...');
  const location = useLocation();

  useEffect(() => {
    // Redirecionar para a edge function com os parâmetros da URL
    const edgeFunctionUrl = `https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/meta-auth-callback${location.search}`;
    window.location.href = edgeFunctionUrl;
  }, [location]);

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
