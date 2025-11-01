import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export const LomadeeSettings = () => {
  const [appToken, setAppToken] = useState('');
  const [affiliateId, setAffiliateId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [approvedStores, setApprovedStores] = useState<string[]>([]);

  useEffect(() => {
    loadLomadeeConfig();
  }, []);

  const loadLomadeeConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('integrations')
        .select('lomadee_app_token, lomadee_source_id, lomadee_affiliate_id, is_active')
        .eq('user_id', user.id)
        .eq('platform', 'lomadee')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAppToken(data.lomadee_app_token || '');
        setAffiliateId(data.lomadee_affiliate_id || '');
        setIsConnected(data.is_active || false);
        if (data.lomadee_source_id) {
          setApprovedStores(data.lomadee_source_id.split(',').filter(Boolean));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const handleConnect = async () => {
    if (!appToken.trim()) {
      toast.error('Por favor, insira seu APP_TOKEN da Lomadee');
      return;
    }

    if (!affiliateId.trim()) {
      toast.error('Por favor, insira seu ID de Afiliado da Lomadee');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Salvar APP_TOKEN e Affiliate ID no banco
      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          platform: 'lomadee',
          lomadee_app_token: appToken,
          lomadee_affiliate_id: affiliateId,
          is_active: true,
          access_token: appToken, // Campo obrigatório
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,platform'
        });

      if (upsertError) throw upsertError;

      setIsConnected(true);
      toast.success('APP_TOKEN salvo com sucesso!');
      
      // Sincronizar lojas automaticamente
      await syncStores();

    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast.error(error.message || 'Erro ao conectar com Lomadee');
    } finally {
      setIsLoading(false);
    }
  };

  const syncStores = async () => {
    setIsSyncing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Chamar edge function para listar lojas
      const { data, error } = await supabase.functions.invoke('listar-lojas-lomadee', {
        body: { appToken }
      });

      if (error) throw error;

      if (data.stores && data.stores.length > 0) {
        const sourceIds = data.stores.map((store: any) => store.sourceId).join(',');
        
        // Atualizar no banco
        const { error: updateError } = await supabase
          .from('integrations')
          .update({
            lomadee_source_id: sourceIds,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('platform', 'lomadee');

        if (updateError) throw updateError;

        setApprovedStores(data.stores.map((s: any) => s.name));
        toast.success(`${data.stores.length} lojas sincronizadas com sucesso!`);
      } else {
        toast.warning('Nenhuma loja aprovada encontrada');
      }

    } catch (error: any) {
      console.error('Erro ao sincronizar lojas:', error);
      toast.error(error.message || 'Erro ao sincronizar lojas');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('integrations')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('platform', 'lomadee');

      if (error) throw error;

      setIsConnected(false);
      setApprovedStores([]);
      toast.success('Lomadee desconectada');
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Integração Lomadee
              {isConnected && (
                <Badge className="bg-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Conecte sua conta Lomadee para buscar produtos das lojas aprovadas
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">APP_TOKEN da Lomadee</label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Ksk0l6JK..."
              value={appToken}
              onChange={(e) => setAppToken(e.target.value)}
              disabled={isConnected}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Encontre seu APP_TOKEN em: Painel Lomadee → Configurações → API
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">ID de Afiliado (sourceId)</label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="37698997"
              value={affiliateId}
              onChange={(e) => setAffiliateId(e.target.value)}
              disabled={isConnected}
            />
            {!isConnected ? (
              <Button onClick={handleConnect} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  'Conectar'
                )}
              </Button>
            ) : (
              <Button variant="outline" onClick={handleDisconnect}>
                Desconectar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Seu ID aparece nos links de afiliado
          </p>
        </div>

        {isConnected && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Lojas Aprovadas ({approvedStores.length})</h4>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={syncStores}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sincronizar
                  </>
                )}
              </Button>
            </div>

            {approvedStores.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {approvedStores.map((store, index) => (
                  <Badge key={index} variant="secondary">
                    {store}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <XCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma loja aprovada</p>
                <p className="text-sm">Clique em "Sincronizar" para buscar suas lojas</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
