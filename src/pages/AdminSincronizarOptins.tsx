import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';

interface SyncResult {
  success: boolean;
  total: number;
  sincronizados: number;
  atualizados: number;
  erros: number;
  detalhes?: { whatsapp: string; status: string }[];
}

export default function AdminSincronizarOptins() {
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<SyncResult | null>(null);

  async function sincronizarTodos() {
    setSincronizando(true);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('sincronizar-optins-retroativo');

      if (error) throw error;

      setResultado(data);
      toast.success(`✅ Sincronização concluída! ${data.sincronizados} novos, ${data.atualizados} atualizados`);
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('❌ ' + (error.message || 'Erro ao sincronizar'));
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Admin
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-6 h-6" />
              🔄 Sincronizar Opt-ins
            </CardTitle>
            <CardDescription>
              Sincroniza TODOS os cadastros de opt-ins anteriores para "Seus Cadastros", 
              marcando opt_in = true e vinculando os registros.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">O que esta ação faz:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Busca todos os opt-ins com aceite confirmado</li>
                <li>✅ Cria cadastros para números novos</li>
                <li>✅ Atualiza cadastros existentes com flag opt_in = true</li>
                <li>✅ Vincula opt_in_id nos cadastros</li>
              </ul>
            </div>

            <Button
              onClick={sincronizarTodos}
              disabled={sincronizando}
              size="lg"
              className="w-full"
            >
              {sincronizando ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  🔄 Sincronizar Todos
                </>
              )}
            </Button>

            {resultado && (
              <div className="mt-6 space-y-4">
                <div className={`p-4 rounded-lg ${resultado.erros > 0 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    {resultado.erros > 0 ? (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    Resultado da Sincronização
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-background/50 p-3 rounded">
                      <p className="text-muted-foreground">Total Processados</p>
                      <p className="text-2xl font-bold">{resultado.total}</p>
                    </div>
                    <div className="bg-background/50 p-3 rounded">
                      <p className="text-muted-foreground">Novos Criados</p>
                      <p className="text-2xl font-bold text-green-500">{resultado.sincronizados}</p>
                    </div>
                    <div className="bg-background/50 p-3 rounded">
                      <p className="text-muted-foreground">Atualizados</p>
                      <p className="text-2xl font-bold text-blue-500">{resultado.atualizados}</p>
                    </div>
                    <div className="bg-background/50 p-3 rounded">
                      <p className="text-muted-foreground">Erros</p>
                      <p className="text-2xl font-bold text-red-500">{resultado.erros}</p>
                    </div>
                  </div>
                </div>

                {resultado.detalhes && resultado.detalhes.length > 0 && (
                  <div className="bg-muted/30 p-4 rounded-lg max-h-60 overflow-y-auto">
                    <h4 className="font-medium mb-2 text-sm">Detalhes (últimos 50):</h4>
                    <div className="space-y-1 text-xs">
                      {resultado.detalhes.map((d, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-border/30">
                          <span className="font-mono">{d.whatsapp}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            d.status === 'criado' ? 'bg-green-500/20 text-green-400' :
                            d.status === 'atualizado' ? 'bg-blue-500/20 text-blue-400' :
                            d.status === 'já_sincronizado' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {d.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
