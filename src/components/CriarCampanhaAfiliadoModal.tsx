import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Sparkles, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Formata preço corretamente para Shopee
 * O banco armazena 2.399 (número) que deve ser R$ 2.399,00 (milhar)
 * Regra: se número tem 3 casas "decimais" E parte inteira < 100, é milhar
 */
function formatarPrecoAfiliado(preco: number | string | null): string {
  if (preco == null) return 'Consulte';
  
  let valor: number;
  const precoNum = typeof preco === 'number' ? preco : parseFloat(String(preco).replace(',', '.'));
  
  if (isNaN(precoNum) || precoNum <= 0) return 'Consulte';
  
  // Detectar padrão Shopee: valores como 2.399 que deveriam ser 2399
  // Se o valor é X.YYY onde X < 100 e YYY tem 3 dígitos, multiplica por 1000
  const precoStr = precoNum.toString();
  if (precoStr.includes('.')) {
    const [inteiro, decimal] = precoStr.split('.');
    // Se tem exatamente 3 decimais e parte inteira é pequena, é milhar
    if (decimal && decimal.length === 3 && parseInt(inteiro) < 100) {
      valor = precoNum * 1000; // 2.399 -> 2399
    } else {
      valor = precoNum;
    }
  } else {
    valor = precoNum;
  }
  
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Produto {
  id: string;
  titulo: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  link_afiliado: string;
  marketplace: string;
}

interface ListaTransmissao {
  id: string;
  group_name: string;
  member_count: number;
  phone_numbers: string[];
  source: 'manual' | 'auto' | 'grupo';
  group_jid?: string; // Para grupos WhatsApp reais
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
  
  // Estados para listas de transmissão
  const [listas, setListas] = useState<ListaTransmissao[]>([]);
  const [listasSelecionadas, setListasSelecionadas] = useState<string[]>([]);
  
  const [postsGerados, setPostsGerados] = useState<PostsGerados | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState('');
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Buscar listas de transmissão ao abrir modal (manuais + automáticas + grupos WhatsApp)
  const fetchListas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [manualRes, autoRes, gruposRes] = await Promise.all([
        supabase
          .from('whatsapp_groups')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('afiliado_listas_categoria')
          .select('id, nome, total_membros, ativa')
          .eq('ativa', true)
          .order('nome', { ascending: true }),
        // Grupos WhatsApp reais
        supabase
          .from('whatsapp_grupos_afiliado')
          .select('id, group_jid, group_name, member_count, categoria, is_announce')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .order('created_at', { ascending: false })
      ]);

      if (manualRes.error) throw manualRes.error;
      if (autoRes.error) throw autoRes.error;
      if (gruposRes.error) throw gruposRes.error;

      // Grupos WhatsApp reais (aparecem primeiro com ícone destacado)
      const gruposWhatsApp: ListaTransmissao[] = (gruposRes.data || []).map((g: any) => ({
        id: g.id,
        group_name: `📱 ${g.group_name}`,
        member_count: g.member_count ?? 0,
        phone_numbers: [],
        source: 'grupo' as const,
        group_jid: g.group_jid,
      }));

      const listasAuto: ListaTransmissao[] = (autoRes.data || [])
        .filter((l) => l.ativa !== false)
        .map((l) => ({
          id: l.id,
          group_name: `📂 ${l.nome}`,
          member_count: l.total_membros ?? 0,
          phone_numbers: [],
          source: 'auto' as const,
        }));

      const listasManuais: ListaTransmissao[] = (manualRes.data || []).map((g: any) => ({
        id: g.id,
        group_name: g.group_name,
        member_count: g.member_count ?? (g.phone_numbers?.length || 0),
        phone_numbers: g.phone_numbers || [],
        source: 'manual' as const,
      }));

      // Ordem: Grupos WhatsApp → Listas automáticas → Listas manuais
      setListas([...gruposWhatsApp, ...listasAuto, ...listasManuais]);
    } catch (error) {
      console.error('Erro ao buscar listas:', error);
      setListas([]);
    }
  };

  const toggleLista = (listaId: string) => {
    if (listasSelecionadas.includes(listaId)) {
      setListasSelecionadas(listasSelecionadas.filter(id => id !== listaId));
    } else {
      setListasSelecionadas([...listasSelecionadas, listaId]);
    }
  };

  useEffect(() => {
    if (open) {
      fetchListas();
      // Template inicial COM LINK DE AFILIADO - usa formatação correta de preço
      const precoFormatado = produto.preco ? formatarPrecoAfiliado(produto.preco) : '';
      setMensagem(`Olá! 👋

Confira esta oferta incrível:

📦 *${produto.titulo}*
${precoFormatado ? `💰 *${precoFormatado}*` : ''}

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

  const enviarAgora = async (userId: string, listasIds: string[], mensagemTemplate: string, produtoInfo: any) => {
    // Separar grupos WhatsApp reais das outras listas
    const gruposWhatsApp = listas.filter(l => l.source === 'grupo' && listasIds.includes(l.id));
    const outrasListasIds = listasIds.filter(id => !gruposWhatsApp.some(g => g.id === id));

    let enviados = 0;
    let erros = 0;

    // 1. Enviar para Grupos WhatsApp reais (uma mensagem por grupo)
    for (const grupo of gruposWhatsApp) {
      if (!grupo.group_jid) continue;

      const mensagemGrupo = mensagemTemplate
        .replace(/\{\{nome\}\}/gi, 'Pessoal')
        .replace(/\{\{produto\}\}/gi, produtoInfo?.titulo || 'Produto')
        .replace(/\{\{preco\}\}/gi, formatarPrecoAfiliado(produtoInfo?.preco));

      try {
        const { data: sendData, error: sendError } = await supabase.functions.invoke(
          'send-wuzapi-group-message',
          {
            body: {
              groupJid: grupo.group_jid,
              message: mensagemGrupo,
              imageUrl: produtoInfo?.imagem_url || null,
              userId,
            },
          }
        );

        if (sendError || !sendData?.success) {
          erros++;
          console.error(`❌ Erro ao enviar para grupo ${grupo.group_name}:`, sendError || sendData);
        } else {
          enviados++;
          console.log(`✅ Enviado para grupo ${grupo.group_name}`);
        }
      } catch (err) {
        erros++;
        console.error(`❌ Exceção ao enviar para grupo:`, err);
      }
    }

    // 2. Enviar para contatos individuais (listas manuais + automáticas)
    if (outrasListasIds.length > 0) {
      const [manualRes, autoRes] = await Promise.all([
        supabase
          .from('whatsapp_groups')
          .select('phone_numbers')
          .in('id', outrasListasIds),
        supabase
          .from('afiliado_lista_membros')
          .select('leads_ebooks ( phone, nome )')
          .in('lista_id', outrasListasIds),
      ]);

      if (manualRes.error) throw manualRes.error;
      if (autoRes.error) throw autoRes.error;

      // Contatos manuais (sem nome, só telefone)
      const contatosManuais = (manualRes.data?.flatMap((g: any) => g.phone_numbers || []) || [])
        .map((phone: string) => ({ phone: String(phone).replace(/\D/g, ''), nome: 'Cliente' }));

      // Contatos automáticos (COM nome do leads_ebooks)
      const contatosAuto = (autoRes.data || [])
        .map((m: any) => {
          const lead = m.leads_ebooks as any;
          return lead?.phone ? { 
            phone: String(lead.phone).replace(/\D/g, ''), 
            nome: lead.nome || 'Cliente' 
          } : null;
        })
        .filter(Boolean);

      // Deduplicar por phone, mantendo o primeiro nome encontrado
      const contatosMap = new Map<string, { phone: string; nome: string }>();
      [...contatosManuais, ...contatosAuto].forEach((c: any) => {
        if (c.phone && !contatosMap.has(c.phone)) {
          contatosMap.set(c.phone, c);
        }
      });
      const contatos = Array.from(contatosMap.values());

      // Enviar um por um com mensagem personalizada
      for (const contato of contatos) {
        const mensagemPersonalizada = mensagemTemplate
          .replace(/\{\{nome\}\}/gi, contato.nome)
          .replace(/\{\{produto\}\}/gi, produtoInfo?.titulo || 'Produto')
          .replace(/\{\{preco\}\}/gi, formatarPrecoAfiliado(produtoInfo?.preco));

        const { data: sendData, error: sendError } = await supabase.functions.invoke(
          'send-wuzapi-message-afiliado',
          {
            body: {
              phoneNumbers: [contato.phone],
              message: mensagemPersonalizada,
              imageUrl: produtoInfo?.imagem_url || null,
              userId,
            },
          }
        );

        if (sendError || !sendData?.success) {
          erros++;
        } else {
          enviados += sendData?.enviados || 1;
        }

        // Delay entre envios
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (enviados > 0) toast.success(`✅ Enviado: ${enviados} destino(s)`);
    if (erros > 0) toast.warning(`⚠️ ${erros} falha(s) no envio`);
  };

  const handleCriarCampanha = async () => {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // ✅ Validação obrigatória de listas
      if (listasSelecionadas.length === 0) {
        toast.error('Selecione pelo menos 1 lista de transmissão');
        setIsLoading(false);
        return;
      }

      if (frequencia !== 'agora' && !dataInicio) {
        toast.error('Selecione a data de início');
        return;
      }

      const proximaExecucao = frequencia === 'agora' ? new Date().toISOString() : calcularProximaExecucao();

      console.log('📤 Criando campanha com listas:', listasSelecionadas);

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
          listas_ids: listasSelecionadas, // ✅ INCLUIR LISTAS
          ativa: true,
          status: frequencia === 'agora' ? 'enviada' : 'ativa',
          proxima_execucao: proximaExecucao,
        });

      if (error) throw error;

      // ✅ Para "Enviar Agora", dispara imediatamente (sem esperar o agendador)
      if (frequencia === 'agora') {
        await enviarAgora(user.id, listasSelecionadas, mensagem, produto);
      }

      if (frequencia === 'agora') {
        toast.success('🚀 Campanha criada!');
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

          {/* 2. LISTAS DE TRANSMISSÃO E GRUPOS */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              2. Selecione Grupos ou Listas
            </Label>
            
            {listas.length === 0 ? (
              <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Nenhuma lista ou grupo encontrado.
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Crie um grupo no Dashboard ou importe contatos.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {listas.map((lista) => (
                  <div 
                    key={lista.id}
                    onClick={() => toggleLista(lista.id)}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      listasSelecionadas.includes(lista.id) 
                        ? lista.source === 'grupo' 
                          ? 'border-green-500 bg-green-100' 
                          : 'border-green-500 bg-green-50' 
                        : lista.source === 'grupo'
                          ? 'border-teal-300 bg-teal-50/50 hover:border-teal-400'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={listasSelecionadas.includes(lista.id)}
                        onChange={() => {}}
                      />
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {lista.group_name}
                          {lista.source === 'grupo' && (
                            <span className="text-xs bg-teal-500 text-white px-1.5 py-0.5 rounded">GRUPO</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lista.source === 'grupo' 
                            ? `${lista.member_count || 0} membros` 
                            : `${lista.member_count || lista.phone_numbers?.length || 0} contatos`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {listasSelecionadas.length > 0 && (
              <p className="text-sm text-green-600 mt-2">
                ✅ {listasSelecionadas.length} lista(s) selecionada(s)
              </p>
            )}
          </div>

          {/* 3. DATA E HORÁRIOS */}
          {frequencia !== 'agora' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <Label className="text-lg font-semibold">3. Selecione Data e Horários</Label>
              
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

          {/* 4. MENSAGEM */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold mb-3 block">4. Mensagem</Label>
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
