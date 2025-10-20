import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ShopeeCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando autorização...');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const shop_id = searchParams.get('shop_id');

      if (!code || !shop_id) {
        setStatus('error');
        setMessage('Parâmetros de autorização inválidos');
        toast({
          title: "Erro de autorização",
          description: "Parâmetros inválidos retornados pela Shopee",
          variant: "destructive",
        });
        
        setTimeout(() => navigate('/dashboard'), 3000);
        return;
      }

      try {
        console.log('🔐 Obtendo access_token da Shopee...');
        console.log('📍 Code:', code);
        console.log('📍 Shop ID:', shop_id);

        const { data, error } = await supabase.functions.invoke('shopee-get-token', {
          body: { code, shop_id }
        });

        if (error) {
          throw error;
        }

        if (data?.status === 'success') {
          setStatus('success');
          setMessage('Loja Shopee conectada com sucesso!');
          
          console.log('✅ Token obtido:', data);
          
          toast({
            title: "✅ Shopee conectada!",
            description: `Access token: ${data.access_token.substring(0, 20)}...`,
          });

          // Armazenar tokens (você pode salvar no banco de dados)
          localStorage.setItem('shopee_access_token', data.access_token);
          localStorage.setItem('shopee_refresh_token', data.refresh_token);
          localStorage.setItem('shopee_shop_id', shop_id);

          setTimeout(() => navigate('/dashboard'), 2000);
        } else {
          throw new Error(data?.error || 'Erro ao obter token');
        }
      } catch (error: any) {
        console.error('❌ Erro ao processar callback:', error);
        setStatus('error');
        setMessage(error.message || 'Erro ao conectar com a Shopee');
        
        toast({
          title: "Erro ao conectar Shopee",
          description: error.message || "Não foi possível obter o token de acesso",
          variant: "destructive",
        });

        setTimeout(() => navigate('/dashboard'), 3000);
      }
    };

    processCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-center">
            {status === 'loading' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Conectando Shopee
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Sucesso!
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Erro
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            {message}
          </p>
          {status === 'loading' && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Aguarde enquanto processamos a autorização...
            </div>
          )}
          {status !== 'loading' && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Redirecionando...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopeeCallback;
