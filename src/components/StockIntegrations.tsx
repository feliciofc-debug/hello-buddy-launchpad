import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Settings, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Plug,
  Zap,
  AlertCircle
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  integration_type: string;
  active: boolean;
  api_url: string;
  api_key?: string;
  api_token?: string;
  auth_type: string;
  field_mapping: any;
  last_sync_at?: string;
  last_sync_status?: string;
  last_error?: string;
  sync_count: number;
  products_synced: number;
  auto_sync: boolean;
}

interface StockIntegrationsProps {
  open: boolean;
  onClose: () => void;
}

const TEMPLATES = {
  bling: {
    name: 'Bling',
    logo: '🔵',
    color: 'bg-blue-500',
    api_url: 'https://bling.com.br/Api/v2/produtos/json/',
    auth_type: 'api_key',
    field_mapping: {
      sku: 'codigo',
      nome: 'descricao',
      preco: 'preco',
      estoque: 'estoqueAtual'
    },
    description: 'ERP completo para gestão de negócios',
    help: 'Acesse Bling > Preferências > API > Gerar chave'
  },
  tiny: {
    name: 'Tiny ERP',
    logo: '🟢',
    color: 'bg-green-500',
    api_url: 'https://api.tiny.com.br/api2/produtos.pesquisa.php',
    auth_type: 'token',
    field_mapping: {
      sku: 'codigo',
      nome: 'nome',
      preco: 'preco',
      estoque: 'saldo'
    },
    description: 'Sistema de gestão empresarial',
    help: 'Acesse Tiny > Configurações > Tokens API'
  },
  omie: {
    name: 'Omie',
    logo: '🟡',
    color: 'bg-yellow-500',
    api_url: 'https://app.omie.com.br/api/v1/geral/produtos/',
    auth_type: 'api_key',
    field_mapping: {
      sku: 'codigo',
      nome: 'descricao',
      preco: 'valor_unitario',
      estoque: 'quantidade_estoque'
    },
    description: 'ERP online para empresas',
    help: 'Acesse Omie > Configurações > Chaves API'
  },
  custom: {
    name: 'API Própria',
    logo: '🔧',
    color: 'bg-orange-500',
    api_url: '',
    auth_type: 'bearer',
    field_mapping: {
      sku: 'sku',
      nome: 'name',
      preco: 'price',
      estoque: 'stock'
    },
    description: 'Configure sua própria API',
    help: 'Informe a URL e credenciais da sua API'
  }
};

export const StockIntegrations: React.FC<StockIntegrationsProps> = ({ open, onClose }) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [formData, setFormData] = useState({
    api_url: '',
    api_key: '',
    api_token: '',
    field_sku: 'sku',
    field_nome: 'nome',
    field_preco: 'preco',
    field_estoque: 'estoque'
  });

  useEffect(() => {
    if (open) {
      loadIntegrations();
    }
  }, [open]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('stock_integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations((data || []) as Integration[]);
    } catch (error: any) {
      console.error('Erro ao carregar integrações:', error);
      toast.error('Erro ao carregar integrações');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    const template = TEMPLATES[type as keyof typeof TEMPLATES];
    
    setFormData({
      api_url: template.api_url,
      api_key: '',
      api_token: '',
      field_sku: template.field_mapping.sku,
      field_nome: template.field_mapping.nome,
      field_preco: template.field_mapping.preco,
      field_estoque: template.field_mapping.estoque
    });
    
    setShowForm(true);
  };

  const handleConnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const template = TEMPLATES[selectedType as keyof typeof TEMPLATES];
      
      if (!formData.api_url) {
        toast.error('Informe a URL da API');
        return;
      }

      if (!formData.api_key && !formData.api_token) {
        toast.error('Informe a API Key ou Token');
        return;
      }

      console.log('🔌 Criando integração:', selectedType);

      const integrationData = {
        user_id: user.id,
        name: template.name,
        integration_type: selectedType,
        api_url: formData.api_url,
        api_key: formData.api_key || null,
        api_token: formData.api_token || null,
        auth_type: template.auth_type,
        field_mapping: {
          sku: formData.field_sku,
          nome: formData.field_nome,
          preco: formData.field_preco,
          estoque: formData.field_estoque
        },
        active: true,
        auto_sync: true,
        last_sync_status: 'pending'
      };

      const { data: newIntegration, error } = await supabase
        .from('stock_integrations')
        .insert(integrationData)
        .select()
        .single();

      if (error) throw error;

      toast.success('✅ Integração criada! Testando conexão...');

      // Testar conexão
      await handleSync(newIntegration.id, true);

      setShowForm(false);
      setSelectedType('');
      loadIntegrations();

    } catch (error: any) {
      console.error('Erro ao criar integração:', error);
      toast.error('Erro: ' + error.message);
    }
  };

  const handleSync = async (integrationId: string, testOnly = false) => {
    try {
      setSyncing(integrationId);
      console.log('🔄 Sincronizando integração:', integrationId);

      const { data, error } = await supabase.functions.invoke('sync-stock', {
        body: { 
          integration_id: integrationId,
          test_only: testOnly
        }
      });

      if (error) throw error;

      console.log('📊 Resultado:', data);

      if (data.success && data.results?.[0]) {
        const result = data.results[0];
        if (result.status === 'success') {
          toast.success(
            `✅ Sincronizado! ${result.productsFound} encontrados, ${result.productsUpdated} atualizados`
          );
        } else {
          toast.error(`❌ Erro: ${result.error}`);
        }
      } else {
        toast.error('Erro na sincronização');
      }

      loadIntegrations();

    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro: ' + error.message);
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleActive = async (integration: Integration) => {
    try {
      const { error } = await supabase
        .from('stock_integrations')
        .update({ active: !integration.active })
        .eq('id', integration.id);

      if (error) throw error;

      toast.success(integration.active ? 'Integração desativada' : 'Integração ativada');
      loadIntegrations();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta integração?')) return;

    try {
      const { error } = await supabase
        .from('stock_integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Integração excluída');
      loadIntegrations();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const getStatusBadge = (integration: Integration) => {
    if (!integration.last_sync_status) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
    if (integration.last_sync_status === 'success') {
      return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Sincronizado</Badge>;
    }
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrações de Estoque - Plug & Play
          </DialogTitle>
        </DialogHeader>

        {/* Seleção de tipo */}
        {!showForm && (
          <>
            <div className="bg-muted/50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Sincronização Automática
              </h3>
              <p className="text-sm text-muted-foreground">
                Conecte seu ERP e mantenha estoque/preços atualizados automaticamente a cada 5 minutos.
                Produtos são identificados pelo SKU.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => handleSelectType(key)}
                  className="p-4 border-2 rounded-lg hover:border-primary transition-all text-center"
                >
                  <div className="text-4xl mb-2">{template.logo}</div>
                  <h3 className="font-bold">{template.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                </button>
              ))}
            </div>

            {/* Lista de integrações existentes */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Integrações Configuradas ({integrations.length})
              </h3>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : integrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma integração configurada. Escolha um tipo acima para começar.
                </div>
              ) : (
                <div className="space-y-3">
                  {integrations.map((integration) => (
                    <Card key={integration.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">
                              {TEMPLATES[integration.integration_type as keyof typeof TEMPLATES]?.logo || '🔧'}
                            </div>
                            <div>
                              <h4 className="font-semibold">{integration.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(integration)}
                                {integration.last_sync_at && (
                                  <span className="text-xs text-muted-foreground">
                                    Última sync: {new Date(integration.last_sync_at).toLocaleString('pt-BR')}
                                  </span>
                                )}
                              </div>
                              {integration.last_error && (
                                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  {integration.last_error.substring(0, 100)}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {integration.sync_count} sincronizações • {integration.products_synced} produtos atualizados
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Ativo</Label>
                              <Switch
                                checked={integration.active}
                                onCheckedChange={() => handleToggleActive(integration)}
                              />
                            </div>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSync(integration.id)}
                              disabled={syncing === integration.id}
                            >
                              <RefreshCw className={`h-4 w-4 ${syncing === integration.id ? 'animate-spin' : ''}`} />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(integration.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Formulário de configuração */}
        {showForm && selectedType && (
          <div className="space-y-4">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              ← Voltar
            </Button>

            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">
                {TEMPLATES[selectedType as keyof typeof TEMPLATES].logo}
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  Configurar {TEMPLATES[selectedType as keyof typeof TEMPLATES].name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {TEMPLATES[selectedType as keyof typeof TEMPLATES].help}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {selectedType === 'custom' && (
                <div>
                  <Label>🌐 URL da API</Label>
                  <Input
                    type="url"
                    placeholder="https://sua-api.com/produtos"
                    value={formData.api_url}
                    onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Label>🔑 API Key</Label>
                <Input
                  type="password"
                  placeholder="Cole sua API key aqui"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                />
              </div>

              {(selectedType === 'tiny' || selectedType === 'custom') && (
                <div>
                  <Label>🎟️ Token (opcional)</Label>
                  <Input
                    type="password"
                    placeholder="Token de autenticação"
                    value={formData.api_token}
                    onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                  />
                </div>
              )}

              {selectedType === 'custom' && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">📋 Mapeamento de Campos</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Informe o nome dos campos na sua API que correspondem a cada dado:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Campo SKU</Label>
                      <Input
                        placeholder="sku"
                        value={formData.field_sku}
                        onChange={(e) => setFormData({ ...formData, field_sku: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Campo Nome</Label>
                      <Input
                        placeholder="name"
                        value={formData.field_nome}
                        onChange={(e) => setFormData({ ...formData, field_nome: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Campo Preço</Label>
                      <Input
                        placeholder="price"
                        value={formData.field_preco}
                        onChange={(e) => setFormData({ ...formData, field_preco: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Campo Estoque</Label>
                      <Input
                        placeholder="stock"
                        value={formData.field_estoque}
                        onChange={(e) => setFormData({ ...formData, field_estoque: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Como funciona:
                </h4>
                <ul className="text-sm space-y-1">
                  <li>✅ AMZ busca produtos automaticamente a cada 5 minutos</li>
                  <li>✅ Atualiza estoque e preço dos seus produtos</li>
                  <li>✅ Produtos são identificados pelo campo SKU</li>
                  <li>✅ Você pode desativar a qualquer momento</li>
                </ul>
              </div>

              <Button 
                onClick={handleConnect}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <Plug className="h-5 w-5 mr-2" />
                Conectar e Testar Agora
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StockIntegrations;
