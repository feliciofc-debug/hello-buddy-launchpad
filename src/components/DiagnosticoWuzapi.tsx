import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface WuzapiConfig {
  instance_url: string;
  token: string;
  phone_number: string;
}

interface DiagnosticoResult {
  urlValida: boolean;
  tokenValido: boolean;
  testeEnvio: boolean;
  erros: string[];
  logs: string[];
}

export function DiagnosticoWuzapi() {
  const [config, setConfig] = useState<WuzapiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testando, setTestando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoResult | null>(null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    carregarConfig();
  }, []);

  const carregarConfig = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    console.log('👤 User ID:', user.id);

    const { data, error } = await (supabase as any)
      .from('wuzapi_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('📊 Resultado query wuzapi_config:', { data, error });

    if (data && !error) {
      console.log('✅ Config encontrada:', {
        instance_url: data.instance_url,
        token_length: data.token?.length,
        phone_number: data.phone_number
      });
      setConfig({
        instance_url: data.instance_url || '',
        token: data.token || '',
        phone_number: data.phone_number || ''
      });
    } else {
      console.log('❌ Nenhuma config encontrada');
      setConfig({
        instance_url: '',
        token: '',
        phone_number: '5521967520706'
      });
      setEditando(true);
    }
    setLoading(false);
  };

  const salvarConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !config) return;

    const { error } = await (supabase as any)
      .from('wuzapi_config')
      .upsert({
        user_id: user.id,
        instance_url: config.instance_url,
        token: config.token,
        phone_number: config.phone_number
      }, { onConflict: 'user_id' });

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('✅ Configuração salva!');
      setEditando(false);
    }
  };

  const executarDiagnostico = async () => {
    if (!config) {
      toast.error('Configure o Wuzapi primeiro');
      return;
    }

    setTestando(true);
    const result: DiagnosticoResult = {
      urlValida: false,
      tokenValido: false,
      testeEnvio: false,
      erros: [],
      logs: []
    };

    try {
      // 1. Verificar URL
      result.logs.push('1️⃣ Verificando URL...');
      try {
        const urlTest = new URL(config.instance_url);
        result.urlValida = true;
        result.logs.push(`✅ URL válida: ${urlTest.href}`);
      } catch (e: any) {
        result.erros.push('URL inválida: ' + e.message);
        result.logs.push('❌ URL inválida');
      }

      // 2. Verificar Token
      result.logs.push('2️⃣ Verificando token...');
      if (!config.token || config.token.length < 5) {
        result.erros.push('Token vazio ou muito curto');
        result.logs.push('❌ Token inválido');
      } else {
        result.tokenValido = true;
        result.logs.push(`✅ Token configurado (${config.token.length} caracteres)`);
      }

      // 3. Testar envio via Edge Function
      result.logs.push('3️⃣ Testando envio via Edge Function...');
      try {
        const { data, error } = await supabase.functions.invoke('test-wuzapi-direct', {
          body: {
            telefone: config.phone_number,
            mensagem: `🔍 Diagnóstico Wuzapi - ${new Date().toLocaleTimeString('pt-BR')}`
          }
        });

        if (error) {
          result.erros.push('Erro na Edge Function: ' + error.message);
          result.logs.push('❌ Erro: ' + error.message);
        } else if (data?.success) {
          result.testeEnvio = true;
          result.logs.push(`✅ Enviado pelo formato: ${data.formato}`);
          result.logs.push(`✅ Status HTTP: ${data.status}`);
          toast.success('✅ Mensagem enviada! Verifique seu WhatsApp');
        } else {
          result.erros.push('Falha no envio: ' + (data?.error || 'Erro desconhecido'));
          result.logs.push('❌ Falha no envio');
          if (data?.logs) {
            data.logs.forEach((log: string) => result.logs.push('   ' + log));
          }
        }
      } catch (e: any) {
        result.erros.push('Erro ao testar: ' + e.message);
        result.logs.push('❌ Erro: ' + e.message);
      }

    } catch (error: any) {
      result.erros.push('Erro geral: ' + error.message);
    }

    setDiagnostico(result);
    setTestando(false);
  };

  if (loading) {
    return (
      <Card className="border-2 border-yellow-200">
        <CardContent className="p-6 text-center">
          <p>⏳ Carregando configuração...</p>
        </CardContent>
      </Card>
    );
  }

  const temConfigValida = config && config.instance_url && config.token;

  return (
    <Card className={`border-2 ${temConfigValida ? 'border-green-200' : 'border-red-200'}`}>
      <CardHeader className={`${temConfigValida ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' : 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20'}`}>
        <CardTitle className="flex items-center justify-between">
          <span>🔧 Configuração Wuzapi</span>
          <div className="flex items-center gap-2">
            {temConfigValida ? (
              <Badge className="bg-green-500">✓ Configurado</Badge>
            ) : (
              <Badge variant="destructive">❌ Não Configurado</Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditando(!editando)}>
              {editando ? '❌ Cancelar' : '✏️ Editar'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">

        {/* STATUS ATUAL */}
        {temConfigValida ? (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="font-bold text-sm text-green-800 dark:text-green-200 mb-2">✅ Wuzapi está configurado!</p>
            <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
              <p><strong>URL:</strong> {config?.instance_url}</p>
              <p><strong>Token:</strong> {config?.token ? `${config.token.substring(0, 20)}...` : '❌ Vazio'}</p>
              <p><strong>Seu número:</strong> {config?.phone_number}</p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="font-bold text-sm text-red-800 dark:text-red-200 mb-2">❌ Wuzapi NÃO está configurado!</p>
            <p className="text-xs text-red-700 dark:text-red-300">
              Clique em "Editar" e preencha os dados abaixo.
            </p>
          </div>
        )}

        {/* CONFIGURAÇÃO */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Instance URL:</label>
            <Input
              value={config.instance_url}
              onChange={(e) => setConfig({ ...config, instance_url: e.target.value })}
              placeholder="https://wuzapi.exemplo.com"
              disabled={!editando}
              className={!editando ? 'bg-muted' : ''}
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL base da sua instância Wuzapi
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Token:</label>
            <Input
              value={config.token}
              onChange={(e) => setConfig({ ...config, token: e.target.value })}
              placeholder="seu-token-aqui"
              type={editando ? 'text' : 'password'}
              disabled={!editando}
              className={!editando ? 'bg-muted' : ''}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Seu Número (para teste):</label>
            <Input
              value={config.phone_number}
              onChange={(e) => setConfig({ ...config, phone_number: e.target.value.replace(/\D/g, '') })}
              placeholder="5521967520706"
              disabled={!editando}
              className={!editando ? 'bg-muted' : ''}
            />
          </div>

          {editando && (
            <Button onClick={salvarConfig} className="w-full bg-green-600 hover:bg-green-700">
              💾 Salvar Configuração
            </Button>
          )}
        </div>

        {/* BOTÃO DIAGNÓSTICO */}
        <div className="border-t pt-4">
          <Button
            onClick={executarDiagnostico}
            disabled={testando || editando}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {testando ? '⏳ Executando diagnóstico...' : '🔍 EXECUTAR DIAGNÓSTICO COMPLETO'}
          </Button>
        </div>

        {/* RESULTADO */}
        {diagnostico && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-bold text-sm">📊 Resultado do Diagnóstico:</h4>

            <div className="grid grid-cols-3 gap-2">
              <div className={`p-2 rounded text-center ${diagnostico.urlValida ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                <span className="text-lg">{diagnostico.urlValida ? '✅' : '❌'}</span>
                <p className="text-xs">URL</p>
              </div>
              <div className={`p-2 rounded text-center ${diagnostico.tokenValido ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                <span className="text-lg">{diagnostico.tokenValido ? '✅' : '❌'}</span>
                <p className="text-xs">Token</p>
              </div>
              <div className={`p-2 rounded text-center ${diagnostico.testeEnvio ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                <span className="text-lg">{diagnostico.testeEnvio ? '✅' : '❌'}</span>
                <p className="text-xs">Envio</p>
              </div>
            </div>

            {/* LOGS */}
            <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs max-h-40 overflow-y-auto">
              {diagnostico.logs.map((log, i) => (
                <div key={i} className={log.includes('✅') ? 'text-green-400' : log.includes('❌') ? 'text-red-400' : 'text-gray-300'}>
                  {log}
                </div>
              ))}
            </div>

            {/* ERROS */}
            {diagnostico.erros.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="font-bold text-sm text-red-800 dark:text-red-200 mb-2">❌ Problemas encontrados:</p>
                <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                  {diagnostico.erros.map((erro, i) => (
                    <li key={i}>• {erro}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* SUCESSO */}
            {diagnostico.testeEnvio && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="font-bold text-sm text-green-800 dark:text-green-200">✅ Wuzapi funcionando!</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Verifique se a mensagem chegou no número {config.phone_number}
                </p>
              </div>
            )}
          </div>
        )}

        {/* INSTRUÇÕES */}
        <div className="border-t pt-4 text-xs text-muted-foreground">
          <details>
            <summary className="cursor-pointer font-bold">📋 Como configurar o Wuzapi</summary>
            <ol className="mt-2 ml-4 space-y-1 list-decimal">
              <li>Acesse o painel do Wuzapi</li>
              <li>Copie a Instance URL (ex: https://wuzapi.io/instance/abc)</li>
              <li>Copie o Token de autenticação</li>
              <li>Cole aqui e clique "Salvar"</li>
              <li>Execute o diagnóstico</li>
            </ol>
          </details>
        </div>

      </CardContent>
    </Card>
  );
}
