import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TikTokCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando autorização do TikTok...');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle error from TikTok
      if (error) {
        console.error('❌ TikTok OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(errorDescription || 'Permissão negada pelo usuário');
        toast({
          title: "Erro na autorização",
          description: errorDescription || "O usuário negou a permissão",
          variant: "destructive",
        });
        setTimeout(() => navigate('/afiliado/produtos'), 3000);
        return;
      }

      // Validate code
      if (!code) {
        setStatus('error');
        setMessage('Código de autorização não recebido');
        toast({
          title: "Erro de autorização",
          description: "Parâmetros inválidos retornados pelo TikTok",
          variant: "destructive",
        });
        setTimeout(() => navigate('/afiliado/produtos'), 3000);
        return;
      }

      try {
        console.log('🔐 Trocando código por access_token do TikTok...');
        console.log('📍 Code:', code?.substring(0, 20) + '...');
        console.log('📍 State:', state);

         const { data, error: fnError } = await supabase.functions.invoke('tiktok-auth-callback', {
           body: { code, state }
         });

         console.log('📦 Callback response:', { data, fnError });

        if (fnError) {
          throw fnError;
        }

        if (data?.success) {
          setStatus('success');
          setMessage('TikTok conectado com sucesso!');
          
          console.log('✅ TikTok conectado:', data);
          
          toast({
            title: "✅ TikTok conectado!",
            description: "Sua conta TikTok foi conectada com sucesso",
          });

          setTimeout(() => navigate('/afiliado/produtos?tiktok=connected'), 2000);
        } else {
          throw new Error(data?.error || 'Erro ao obter token');
        }
      } catch (err: any) {
        console.error('❌ Erro ao processar callback:', err);
        setStatus('error');
        setMessage(err.message || 'Erro ao conectar com o TikTok');
        
        toast({
          title: "Erro ao conectar TikTok",
          description: err.message || "Não foi possível obter o token de acesso",
          variant: "destructive",
        });

        setTimeout(() => navigate('/afiliado/produtos'), 3000);
      }
    };

    processCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-center">
            {status === 'loading' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Conectando TikTok
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
              Redirecionando para seus produtos...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TikTokCallback;
