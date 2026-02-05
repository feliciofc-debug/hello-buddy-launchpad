import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HealthStatus {
  function_name: string;
  status: string;
  last_check: string;
  consecutive_failures: number;
}

export function HealthStatusBanner() {
  const [offlineFunctions, setOfflineFunctions] = useState<HealthStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    try {
      const { data, error } = await supabase
        .from('edge_functions_health')
        .select('*')
        .eq('is_critical', true)
        .neq('status', 'online');

      if (!error && data) {
        setOfflineFunctions(data as HealthStatus[]);
      }
    } catch (e) {
      console.error('Erro ao verificar saúde:', e);
    }
  };

  const triggerHealthCheck = async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke('health-check-functions');
      await checkHealth();
    } catch (e) {
      console.error('Erro ao executar health check:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    
    // Verificar a cada 2 minutos
    const interval = setInterval(checkHealth, 120000);
    
    return () => clearInterval(interval);
  }, []);

  if (offlineFunctions.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-600 dark:text-red-400">
            ⚠️ Serviços Offline Detectados
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            {offlineFunctions.length} função(ões) crítica(s) estão offline:
          </p>
          <ul className="mt-2 space-y-1">
            {offlineFunctions.map((fn) => (
              <li key={fn.function_name} className="text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                <code className="bg-muted px-1 rounded">{fn.function_name}</code>
                {fn.consecutive_failures > 1 && (
                  <span className="text-xs text-red-500">
                    ({fn.consecutive_failures} falhas consecutivas)
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={triggerHealthCheck}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Verificar Novamente
          </Button>
        </div>
      </div>
    </div>
  );
}
