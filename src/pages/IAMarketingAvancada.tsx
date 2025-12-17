// ============================================
// COMPONENTE: IA Marketing 2.0 (Avançada)
// Análise de Sites + Geração de Imagens
// ISOLADO - Não afeta funcionalidade atual
// ============================================

import { useState } from 'react';
import { Loader2, Globe, Sparkles, Download, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function IAMarketingAvancada() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState('');

  const exemplosPrompts = [
    {
      titulo: "Mensagem Final de Ano",
      prompt: "Crie uma mensagem de final de ano calorosa para clientes e colaboradores"
    },
    {
      titulo: "Post Lançamento Produto",
      prompt: "Crie post anunciando novo produto, destacando inovação e qualidade"
    },
    {
      titulo: "Campanha Black Friday",
      prompt: "Crie arte e copy para campanha Black Friday com senso de urgência"
    },
    {
      titulo: "Aniversário Empresa",
      prompt: "Crie post comemorativo de aniversário da empresa, ressaltando história e conquistas"
    },
    {
      titulo: "Promoção Sazonal",
      prompt: "Crie campanha promocional sazonal com foco em economia e vantagens"
    }
  ];

  const analisarSite = async () => {
    if (!url || !prompt) {
      setErro('URL e prompt são obrigatórios');
      return;
    }

    setLoading(true);
    setErro('');
    setResultado(null);

    try {
      // Chama Edge Function
      const { data, error } = await supabase.functions.invoke('analisar-site-ia', {
        body: { url, prompt }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao analisar site');
      }

      setResultado(data);
      console.log('✅ Análise concluída:', data);

    } catch (error: any) {
      console.error('❌ Erro:', error);
      setErro(error.message || 'Erro ao processar análise');
    } finally {
      setLoading(false);
    }
  };

  const usarExemplo = (exemplo: any) => {
    setPrompt(exemplo.prompt);
  };

  const downloadImagem = () => {
    if (resultado?.imagem_gerada) {
      window.open(resultado.imagem_gerada, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Botão Voltar */}
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>
        
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                IA Marketing 2.0
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Analise qualquer site e crie conteúdo de marketing personalizado
              </p>
            </div>
            <span className="ml-auto px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm rounded-full font-bold">
              NOVO
            </span>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Como funciona:</strong> A IA acessa o site que você indicar, analisa a marca 
              (logo, cores, tipo de negócio) e cria conteúdo de marketing personalizado com imagem!
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Painel de Input */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white">
              <Globe className="w-5 h-5 text-purple-500" />
              Configuração
            </h2>

            {/* URL do Site */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Site da Empresa
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://empresa.com.br"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                A IA vai analisar este site automaticamente
              </p>
            </div>

            {/* Prompt */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                O que você quer criar?
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Crie uma mensagem de final de ano para clientes..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Exemplos */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                💡 Exemplos rápidos:
              </p>
              <div className="space-y-2">
                {exemplosPrompts.map((exemplo, idx) => (
                  <button
                    key={idx}
                    onClick={() => usarExemplo(exemplo)}
                    className="w-full text-left px-3 py-2 text-sm bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors"
                  >
                    <strong className="text-purple-700 dark:text-purple-300">{exemplo.titulo}</strong>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">{exemplo.prompt}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Botão Gerar */}
            <button
              onClick={analisarSite}
              disabled={loading || !url || !prompt}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analisando e criando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Criar Conteúdo
                </>
              )}
            </button>

            {/* Erro */}
            {erro && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Erro</p>
                  <p className="text-sm text-red-600 dark:text-red-300">{erro}</p>
                </div>
              </div>
            )}
          </div>

          {/* Painel de Resultado */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              Resultado
            </h2>

            {!resultado && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  Configure e clique em "Criar Conteúdo"
                  <br />
                  para começar!
                </p>
              </div>
            )}

            {loading && (
              <div className="h-full flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                <p className="text-gray-600 dark:text-gray-300 font-medium">Analisando site...</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Isso pode levar 10-20 segundos
                </p>
              </div>
            )}

            {resultado && (
              <div className="space-y-4">
                {/* Info do Site */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">
                    📊 Site Analisado
                  </h3>
                  <p className="text-sm dark:text-gray-300">
                    <strong>Título:</strong> {resultado.site?.titulo || 'N/A'}
                  </p>
                  <p className="text-sm mt-1 dark:text-gray-300">
                    <strong>Segmento:</strong> {resultado.analise?.segmento || 'N/A'}
                  </p>
                  <p className="text-sm mt-1 dark:text-gray-300">
                    <strong>Tom:</strong> {resultado.analise?.tom_marca || 'N/A'}
                  </p>
                  {resultado.analise?.cores_principais && (
                    <div className="flex gap-2 mt-2">
                      {resultado.analise.cores_principais.map((cor: string, idx: number) => (
                        <div
                          key={idx}
                          className="w-8 h-8 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: cor }}
                          title={cor}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Mensagem Gerada */}
                <div className="bg-white dark:bg-gray-700 border-2 border-purple-200 dark:border-purple-600 rounded-xl p-4">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">
                    ✍️ Conteúdo Criado
                  </h3>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {resultado.analise?.mensagem_gerada}
                    </p>
                  </div>
                </div>

                {/* Imagem Gerada */}
                {resultado.imagem_gerada && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-purple-900 dark:text-purple-200">
                        🎨 Imagem Criada
                      </h3>
                      <button
                        onClick={downloadImagem}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Baixar
                      </button>
                    </div>
                    <img
                      src={resultado.imagem_gerada}
                      alt="Imagem gerada"
                      className="w-full rounded-lg shadow-lg"
                    />
                  </div>
                )}

                {/* Screenshot do Site */}
                {resultado.site?.screenshot && (
                  <details className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                    <summary className="font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                      📸 Screenshot do Site
                    </summary>
                    <img
                      src={resultado.site.screenshot}
                      alt="Screenshot"
                      className="mt-3 w-full rounded-lg shadow"
                    />
                  </details>
                )}

                {/* Branding Extraído */}
                {resultado.branding && (
                  <details className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                    <summary className="font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                      🎨 Branding Detectado
                    </summary>
                    <div className="mt-3 space-y-2 text-sm dark:text-gray-300">
                      {resultado.branding.logo && (
                        <div>
                          <strong>Logo:</strong>
                          <img src={resultado.branding.logo} alt="Logo" className="mt-2 h-12" />
                        </div>
                      )}
                      {resultado.branding.cores && (
                        <div>
                          <strong>Cores:</strong>
                          <pre className="bg-white dark:bg-gray-800 p-2 rounded mt-1 text-xs overflow-auto">
                            {JSON.stringify(resultado.branding.cores, null, 2)}
                          </pre>
                        </div>
                      )}
                      {resultado.branding.esquema && (
                        <p><strong>Esquema:</strong> {resultado.branding.esquema}</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 dark:text-white mb-3">
            💡 Casos de Uso
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
              <strong className="text-purple-700 dark:text-purple-300">🎄 Datas Comemorativas</strong>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Crie posts personalizados para Natal, Ano Novo, Black Friday, etc.
              </p>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/30 rounded-lg p-4">
              <strong className="text-pink-700 dark:text-pink-300">🚀 Lançamentos</strong>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Anuncie novos produtos/serviços com visual da marca
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
              <strong className="text-blue-700 dark:text-blue-300">📢 Promoções</strong>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Campanhas promocionais com identidade visual perfeita
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
