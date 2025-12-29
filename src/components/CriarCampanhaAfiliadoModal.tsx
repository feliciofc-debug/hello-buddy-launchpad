import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Produto {
  id: string;
  titulo: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  link_afiliado: string;
  marketplace: string;
}

interface PostsGerados {
  urgencia: string;
  beneficio: string;
  promocional: string;
}

interface CriarCampanhaAfiliadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
  onSuccess?: () => void;
}

export function CriarCampanhaAfiliadoModal({ 
  open, 
  onOpenChange, 
  produto,
  onSuccess
}: CriarCampanhaAfiliadoModalProps) {
  
  if (!produto) {
    return null;
  }
  
  const [frequencia, setFrequencia] = useState<'agora' | 'uma_vez' | 'diario' | 'semanal'>('agora');
  const [dataInicio, setDataInicio] = useState('');
  const [horarios, setHorarios] = useState<string[]>(['10:00']);
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [mensagem, setMensagem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [postsGerados, setPostsGerados] = useState<PostsGerados | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState('');
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  useEffect(() => {
    if (open) {
      // Template inicial COM LINK DE AFILIADO
      setMensagem(`Olá! 👋

Confira esta oferta incrível:

📦 *${produto.titulo}*
${produto.preco ? `💰 *R$ ${produto.preco.toFixed(2)}*` : ''}

${produto.descricao || ''}

🛒 *Compre agora:*
${produto.link_afiliado}

_Aproveite enquanto dura!_ ✅`);
    }
  }, [open, produto]);

  const addHorario = () => {
    if (horarios.length < 10) {
      setHorarios([...horarios, '14:00']);
    } else {
      toast.error('Máximo de 10 horários!');
    }
  };

  const removeHorario = (idx: number) => {
    if (horarios.length > 1) {
      setHorarios(horarios.filter((_, i) => i !== idx));
    }
  };

  const updateHorario = (idx: number, value: string) => {
    const newHorarios = [...horarios];
    newHorarios[idx] = value;
    setHorarios(newHorarios);
  };

  const toggleDiaSemana = (day: number) => {
    if (diasSemana.includes(day)) {
      setDiasSemana(diasSemana.filter(d => d !== day));
    } else {
      setDiasSemana([...diasSemana, day]);
    }
  };

  const gerarPostsIA = async () => {
    try {
      setIsGenerating(true);
      setPostsGerados(null);
      
      const { data, error } = await supabase.functions.invoke('gerar-posts-whatsapp', {
        body: { 
          produto: {
            nome: produto.titulo,
            preco: produto.preco,
            descricao: produto.descricao,
            link_marketplace: produto.link_afiliado
          },
          sugestao: sugestaoIA
        }
      });

      if (error) throw error;
      
      if (data?.posts) {
        setPostsGerados(data.posts);
        toast.success('✨ 3 variações de posts geradas!');
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error) {
      console.error('Erro ao gerar posts:', error);
      toast.error('Erro ao gerar posts. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const selecionarPost = (texto: string) => {
    const jaTemLink = texto.includes('http://') || texto.includes('https://');
    
    let mensagemFinal = texto;
    
    if (!jaTemLink) {
      mensagemFinal = `${texto}

🛒 *Compre agora:*
${produto.link_afiliado}

_Aproveite enquanto dura!_ ✅`;
    }
    
    setMensagem(mensagemFinal);
    toast.success('Post selecionado com link incluído!');
  };

  const calcularProximaExecucao = () => {
    const agora = new Date();
    const [h, m] = horarios[0].split(':').map(Number);
    
    let proximaExec: Date;

    if (frequencia === 'uma_vez') {
      proximaExec = new Date(dataInicio);
      proximaExec.setHours(h, m, 0, 0);
    } else if (frequencia === 'diario') {
      proximaExec = new Date(dataInicio);
      proximaExec.setHours(h, m, 0, 0);
      if (proximaExec <= agora) {
        proximaExec.setDate(proximaExec.getDate() + 1);
      }
    } else if (frequencia === 'semanal') {
      proximaExec = new Date(dataInicio);
      proximaExec.setHours(h, m, 0, 0);
      let tentativas = 0;
      while (
        (!diasSemana.includes(proximaExec.getDay()) || proximaExec <= agora) &&
        tentativas < 14
      ) {
        proximaExec.setDate(proximaExec.getDate() + 1);
        tentativas++;
      }
    } else {
      proximaExec = agora;
    }

    return proximaExec.toISOString();
  };

  const handleCriarCampanha = async () => {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      if (frequencia !== 'agora' && !dataInicio) {
        toast.error('Selecione a data de início');
        return;
      }

      const proximaExecucao = frequencia === 'agora' ? new Date().toISOString() : calcularProximaExecucao();

      // Salvar na tabela afiliado_campanhas
      const { error } = await supabase
        .from('afiliado_campanhas')
        .insert({
          user_id: user.id,
          produto_id: produto.id,
          nome: `Campanha ${produto.titulo}`,
          mensagem_template: mensagem,
          frequencia: frequencia,
          data_inicio: dataInicio || new Date().toISOString().split('T')[0],
          horarios: horarios,
          dias_semana: diasSemana,
          ativa: true,
          status: frequencia === 'agora' ? 'enviada' : 'ativa',
          proxima_execucao: proximaExecucao
        });

      if (error) throw error;

      if (frequencia === 'agora') {
        toast.success('🚀 Campanha criada! (Envio via WhatsApp em breve)');
      } else {
        toast.success(`✅ Campanha agendada! Próximo envio: ${new Date(proximaExecucao).toLocaleString('pt-BR')}`);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao criar campanha');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            🚀 Criar Campanha - {produto.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* PRODUTO SELECIONADO */}
          <div className="flex gap-4 p-4 bg-muted rounded-lg">
            {produto.imagem_url && (
              <img 
                src={produto.imagem_url} 
                alt={produto.titulo}
                className="w-20 h-20 object-cover rounded" 
              />
            )}
            <div>
              <h3 className="font-bold">{produto.titulo}</h3>
              <p className="text-sm text-muted-foreground capitalize">{produto.marketplace}</p>
              {produto.preco && (
                <p className="text-lg font-semibold text-green-600 mt-1">
                  R$ {produto.preco.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* 1. FREQUÊNCIA */}
          <div>
            <Label className="text-lg font-semibold">1. Escolha a Frequência</Label>
            <RadioGroup value={frequencia} onValueChange={(v: any) => setFrequencia(v)} className="mt-3">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="agora" id="agora" />
                <Label htmlFor="agora" className="cursor-pointer">🚀 Enviar Agora</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="uma_vez" id="uma_vez" />
                <Label htmlFor="uma_vez" className="cursor-pointer">📅 Agendar Uma Vez</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="diario" id="diario" />
                <Label htmlFor="diario" className="cursor-pointer">📆 Diário</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="semanal" id="semanal" />
                <Label htmlFor="semanal" className="cursor-pointer">📅 Semanal</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 2. DATA E HORÁRIOS */}
          {frequencia !== 'agora' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <Label className="text-lg font-semibold">2. Selecione Data e Horários</Label>
              
              <div>
                <Label>Data de Início</Label>
                <Input 
                  type="date" 
                  value={dataInicio} 
                  onChange={(e) => setDataInicio(e.target.value)} 
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Horários do Dia</Label>
                {horarios.map((h, idx) => (
                  <div key={idx} className="flex gap-2 items-center mt-2">
                    <Input 
                      type="time" 
                      value={h} 
                      onChange={(e) => updateHorario(idx, e.target.value)} 
                    />
                    {horarios.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeHorario(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={addHorario}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Horário
                </Button>
              </div>

              {/* Dias da Semana */}
              {(frequencia === 'semanal' || frequencia === 'diario') && (
                <div>
                  <Label>Dias da Semana</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {dayNames.map((dia, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        onClick={() => toggleDiaSemana(idx)}
                        className={
                          diasSemana.includes(idx)
                            ? 'bg-green-500 hover:bg-green-600 text-white border-green-500'
                            : 'bg-red-500 hover:bg-red-600 text-white border-red-500'
                        }
                      >
                        {dia}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. MENSAGEM */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold mb-3 block">3. Mensagem</Label>
            
            {/* Campo de sugestões + Botão IA */}
            <div className="flex gap-2 mb-4">
              <Input
                value={sugestaoIA}
                onChange={(e) => setSugestaoIA(e.target.value)}
                placeholder="Ex: promoção relâmpago, frete grátis, última unidade..."
                className="flex-1"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={gerarPostsIA}
                disabled={isGenerating}
                className="gap-2 whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar com IA
                  </>
                )}
              </Button>
            </div>

            {/* Posts gerados pela IA */}
            {postsGerados && (
              <div className="mb-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">✨ Escolha uma variação:</p>
                
                <div 
                  onClick={() => selecionarPost(postsGerados.urgencia)}
                  className="p-3 border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded">🔥 URGÊNCIA</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{postsGerados.urgencia}</p>
                </div>

                <div 
                  onClick={() => selecionarPost(postsGerados.beneficio)}
                  className="p-3 border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded">✅ BENEFÍCIO</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{postsGerados.beneficio}</p>
                </div>

                <div 
                  onClick={() => selecionarPost(postsGerados.promocional)}
                  className="p-3 border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">🎁 PROMOCIONAL</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{postsGerados.promocional}</p>
                </div>
              </div>
            )}

            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Escreva sua mensagem..."
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              💡 O link de afiliado será incluído automaticamente
            </p>
          </div>

          {/* BOTÃO CRIAR */}
          <Button 
            onClick={handleCriarCampanha} 
            disabled={isLoading}
            className="w-full h-12 text-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                🚀 {frequencia === 'agora' ? 'Criar Campanha Agora' : 'Agendar Campanha'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
