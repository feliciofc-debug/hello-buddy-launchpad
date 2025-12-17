import { useState } from 'react';
import { Loader2, Globe, Sparkles, Download, Brain, TrendingUp, Palette, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

export default function IAMarketingInteligente() {
  const [url, setUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState('');

  const analisarSite = async () => {
    if (!url || !prompt) {
      setErro('URL e prompt são obrigatórios');
      return;
    }

    setLoading(true);
    setErro('');
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('analisar-negocio-final', {
        body: { url, prompt }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao analisar');

      setResultado(data);
      console.log('✅ Análise completa:', data);

    } catch (error: any) {
      console.error('❌ Erro:', error);
      setErro(error.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                IA Marketing Inteligente
              </h1>
              <p className="text-white/60">
                Análise profunda de negócio + conteúdo contextualizado
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Painel Input */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Configuração
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Site da Empresa
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://empresa.com.br"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    O que criar?
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: Criar mensagem de final de ano para redes sociais"
                    rows={4}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>

                <button
                  onClick={analisarSite}
                  disabled={loading || !url || !prompt}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold py-4 rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analisando profundamente...
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5" />
                      Analisar Negócio
                    </>
                  )}
                </button>
              </div>

              {erro && (
                <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-sm text-red-200">{erro}</p>
                </div>
              )}
            </div>
          </div>

          {/* Painel Resultado */}
          <div className="lg:col-span-2 space-y-6">
            
            {!resultado && !loading && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center border border-white/20">
                <Brain className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <p className="text-white/50">
                  Configure e clique em "Analisar Negócio"
                </p>
              </div>
            )}

            {loading && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center border border-white/20">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
                <p className="text-white font-medium">Analisando negócio...</p>
                <p className="text-sm text-white/60 mt-2">
                  Lendo site completo, entendendo contexto, gerando conteúdo...
                </p>
              </div>
            )}

            {resultado && (
              <>
                {/* Logo e Info do Site */}
                {resultado.logo?.url && (
                  <div className="bg-white rounded-2xl shadow-xl p-6">
                    <div className="flex items-center gap-4">
                      <img 
                        src={resultado.logo.url} 
                        alt="Logo" 
                        className="w-16 h-16 object-contain rounded-lg border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = resultado.logo.fallback;
                        }}
                      />
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{resultado.site?.titulo}</h2>
                        <p className="text-sm text-gray-500">{resultado.site?.domain}</p>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Logo via {resultado.logo.metodo}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Análise do Negócio */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="w-6 h-6 text-indigo-500" />
                    <h2 className="text-xl font-bold text-gray-900">Análise do Negócio</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-indigo-900 mb-1">O que faz:</p>
                      <p className="text-indigo-700">{resultado.analise?.empresa?.oque_faz}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-purple-900 mb-1">Setor:</p>
                        <p className="text-purple-700">{resultado.analise?.empresa?.setor}</p>
                      </div>
                      <div className="bg-pink-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-pink-900 mb-1">Cliente Alvo:</p>
                        <p className="text-pink-700">{resultado.analise?.empresa?.cliente}</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-900 mb-2">Proposta de Valor:</p>
                      <p className="text-blue-700">{resultado.analise?.empresa?.proposta_valor}</p>
                    </div>
                  </div>
                </div>

                {/* Identidade da Marca */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Palette className="w-6 h-6 text-purple-500" />
                    <h2 className="text-xl font-bold text-gray-900">Identidade da Marca</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-purple-900 mb-1">Estilo Visual:</p>
                        <p className="text-purple-700 capitalize">{resultado.analise?.identidade?.estilo}</p>
                      </div>
                      <div className="bg-pink-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-pink-900 mb-1">Tom:</p>
                        <p className="text-pink-700 capitalize">{resultado.analise?.identidade?.tom}</p>
                      </div>
                    </div>

                    {resultado.analise?.identidade?.cores && resultado.analise.identidade.cores.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-900 mb-3">Paleta de Cores:</p>
                        <div className="flex gap-3 flex-wrap">
                          {resultado.analise.identidade.cores.map((cor: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm">
                              <div
                                className="w-10 h-10 rounded-lg border-2 border-gray-200"
                                style={{ backgroundColor: cor }}
                              />
                              <span className="text-sm font-mono text-gray-700">{cor}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-indigo-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-indigo-900 mb-1">Personalidade:</p>
                      <p className="text-indigo-700">{resultado.analise?.identidade?.personalidade}</p>
                    </div>
                  </div>
                </div>

                {/* Conteúdo Gerado */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-xl p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Conteúdo Criado</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-indigo-100 text-sm mb-2">Título:</p>
                      <h3 className="text-2xl font-bold">{resultado.conteudo?.titulo}</h3>
                    </div>

                    <div>
                      <p className="text-indigo-100 text-sm mb-2">Mensagem:</p>
                      <p className="text-lg leading-relaxed whitespace-pre-wrap">
                        {resultado.conteudo?.texto}
                      </p>
                    </div>

                    {resultado.conteudo?.cta && (
                      <div>
                        <p className="text-indigo-100 text-sm mb-2">Call to Action:</p>
                        <p className="text-lg font-semibold">{resultado.conteudo.cta}</p>
                      </div>
                    )}

                    {resultado.conteudo?.hashtags && (
                      <div className="flex gap-2 flex-wrap">
                        {resultado.conteudo.hashtags.map((tag: string, i: number) => (
                          <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Imagem Gerada */}
                {resultado.imagem?.url && (
                  <div className="bg-white rounded-2xl shadow-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Imagem Gerada</h2>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          via {resultado.imagem.metodo}
                        </span>
                      </div>
                      <button
                        onClick={() => window.open(resultado.imagem.url, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Baixar
                      </button>
                    </div>
                    <img
                      src={resultado.imagem.url}
                      alt="Imagem gerada"
                      className="w-full rounded-lg shadow-lg"
                    />
                  </div>
                )}

                {/* Debug Info */}
                {resultado.debug && (
                  <details className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                    <summary className="text-sm text-white/70 cursor-pointer font-medium">
                      Informações Técnicas (Debug)
                    </summary>
                    <pre className="mt-3 text-xs overflow-auto bg-black/30 p-3 rounded text-white/80">
                      {JSON.stringify(resultado.debug, null, 2)}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
