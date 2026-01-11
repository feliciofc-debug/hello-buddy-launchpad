import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, Loader2, ExternalLink, RefreshCw, Music2 } from 'lucide-react';

interface TikTokIntegration {
  id: string;
  platform: string;
  is_active: boolean;
  meta_user_id: string | null; // stores tiktok open_id
  token_expires_at: string | null;
  updated_at: string;
}

export default function TikTokIntegrationCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [integration, setIntegration] = useState<TikTokIntegration | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    checkIntegration();
  }, []);

  const checkIntegration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);

      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', 'tiktok')
        .maybeSingle();

      if (error) throw error;
      setIntegration(data as TikTokIntegration | null);
    } catch (error) {
      console.error('Erro ao verificar integração TikTok:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!userId) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para conectar com o TikTok',
        variant: 'destructive',
      });
      return;
    }

    setConnecting(true);
    setIsOpen(false); // Fechar modal antes de redirecionar

    try {
      // TikTok OAuth URL - usando user_id como state
      const CLIENT_KEY = 'aw2ouo90dyp4ju9w';
      const REDIRECT_URI = encodeURIComponent('https://amzofertas.com.br/tiktok/callback');
      const SCOPE = encodeURIComponent('user.info.basic,user.info.profile,video.upload,video.publish');
      const STATE = userId; // Usar user_id para identificar o usuário no callback

      const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}&response_type=code&scope=${SCOPE}&redirect_uri=${REDIRECT_URI}&state=${STATE}`;

      console.log('🔗 Redirecionando TikTok OAuth com user_id:', userId);
      console.log('🔗 URL:', authUrl);

      // Redirect completo (sem popup)
      window.location.href = authUrl;
    } catch (error) {
      console.error('Erro ao iniciar conexão TikTok:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a conexão com o TikTok',
        variant: 'destructive',
      });
      setConnecting(false);
      setIsOpen(true);
    }
  };

  const handleDisconnect = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('user_id', userId)
        .eq('platform', 'tiktok');

      if (error) throw error;

      setIntegration(null);
      toast({
        title: 'TikTok desconectado',
        description: 'Sua conta TikTok foi desconectada com sucesso',
      });
    } catch (error) {
      console.error('Erro ao desconectar TikTok:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível desconectar o TikTok',
        variant: 'destructive',
      });
    }
  };

  const isTokenExpired = () => {
    if (!integration?.token_expires_at) return true;
    return new Date(integration.token_expires_at) < new Date();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card className="border-pink-500/20">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:border-pink-500/50 transition-colors border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-500/10 rounded-lg">
                  <Music2 className="h-5 w-5 text-pink-500" />
                </div>
                <div>
                  <p className="font-medium">TikTok Shop</p>
                  <p className="text-xs text-muted-foreground">
                    {integration?.is_active ? 'Conectado' : 'Clique para conectar'}
                  </p>
                </div>
              </div>
              {integration?.is_active ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <XCircle className="h-3 w-3 mr-1" />
                  Desconectado
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-pink-500" />
            Integração TikTok Shop
          </DialogTitle>
          <DialogDescription>
            Conecte sua conta TikTok para vender produtos diretamente na plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {integration?.is_active ? (
            <>
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-600 dark:text-green-400">
                    TikTok Conectado
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>ID: {integration.meta_user_id || 'N/A'}</p>
                  <p>Última atualização: {formatDate(integration.updated_at)}</p>
                  {integration.token_expires_at && (
                    <p className={isTokenExpired() ? 'text-red-500' : ''}>
                      {isTokenExpired() ? '⚠️ Token expirado' : `Expira em: ${formatDate(integration.token_expires_at)}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isTokenExpired() && (
                  <Button onClick={handleConnect} className="flex-1 bg-pink-600 hover:bg-pink-700">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconectar
                  </Button>
                )}
                <Button variant="destructive" onClick={handleDisconnect} className="flex-1">
                  <XCircle className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Benefícios da integração:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✅ Sincronize produtos com TikTok Shop</li>
                  <li>✅ Venda diretamente nos vídeos</li>
                  <li>✅ Acompanhe métricas de vendas</li>
                  <li>✅ Links de afiliado automáticos</li>
                </ul>
              </div>

              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Conectar TikTok
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Você será redirecionado para o TikTok para autorizar a conexão.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
