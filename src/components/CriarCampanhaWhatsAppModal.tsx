import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { salvarCampanhaNaBiblioteca } from '@/lib/bibliotecaCampanhas';

interface WhatsAppGroup {
  id: string;
  group_name: string;
  member_count: number;
  phone_numbers: string[];
}

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  estoque?: number;
  especificacoes?: string | null;
  categoria?: string;
  link_marketplace?: string | null;
}

interface Campanha {
  id: string;
  nome: string;
  frequencia: string;
  data_inicio: string;
  horarios: string[];
  dias_semana: number[];
  mensagem_template: string;
  listas_ids: string[];
  ativa: boolean;
}

interface PostsGerados {
  urgencia: string;
  beneficio: string;
  promocional: string;
}

interface CriarCampanhaWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Product;
  onSuccess?: () => void;
  campanhaExistente?: Campanha | null;
}

export function CriarCampanhaWhatsAppModal({ 
  open, 
  onOpenChange, 
  produto,
  onSuccess,
  campanhaExistente 
}: CriarCampanhaWhatsAppModalProps) {
  console.log('🚀 CriarCampanhaWhatsAppModal renderizado', { open, produto });
  
  const [frequencia, setFrequencia] = useState<'agora' | 'uma_vez' | 'diario' | 'semanal' | 'personalizado' | 'teste'>('agora');
  const [dataInicio, setDataInicio] = useState('');
  const [horarios, setHorarios] = useState<string[]>(['10:00']);
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]); // Seg-Sex
  const [listas, setListas] = useState<WhatsAppGroup[]>([]);
  const [listasSelecionadas, setListasSelecionadas] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para geração de posts IA
  const [postsGerados, setPostsGerados] = useState<PostsGerados | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState(''); // Campo para sugestões personalizadas
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  // NOVO: Estados para vendedores
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>('');
  const [vendedoresLoading, setVendedoresLoading] = useState(false);

  useEffect(() => {
    if (open) {
      try {
        fetchListas();
        fetchVendedores().catch(err => {
          console.warn('Continuando sem vendedores disponíveis');
        });
        
        // Se tem campanha existente, carregar dados dela
        if (campanhaExistente) {
          setFrequencia(campanhaExistente.frequencia as any);
          setDataInicio(campanhaExistente.data_inicio);
          setHorarios(campanhaExistente.horarios);
          setDiasSemana(campanhaExistente.dias_semana || [1, 2, 3, 4, 5]);
          setMensagem(campanhaExistente.mensagem_template);
          setListasSelecionadas(campanhaExistente.listas_ids);
        } else {
          // Template inicial com variáveis
          setMensagem(`Olá {{nome}}! 👋\n\nConfira nosso produto:\n\n${produto.nome}\n${produto.preco ? `💰 R$ ${produto.preco.toFixed(2)}` : ''}\n\n${produto.descricao || ''}`);
        }
      } catch (error) {
        console.error('Erro no useEffect:', error);
      }
    }
  }, [open, produto, campanhaExistente]);

  const fetchListas = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListas(data || []);
    } catch (error) {
      console.error('Erro ao buscar listas:', error);
      toast.error('Erro ao carregar listas de transmissão');
    }
  };

  const fetchVendedores = async () => {
    setVendedoresLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nome, email, ativo')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        console.warn('Não foi possível carregar vendedores:', error.message);
        setVendedores([]);
        return;
      }
      
      setVendedores(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Erro ao buscar vendedores (continuando sem vendedores):', error);
      setVendedores([]);
    } finally {
      setVendedoresLoading(false);
    }
  };

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

  const toggleLista = (listaId: string) => {
    if (listasSelecionadas.includes(listaId)) {
      setListasSelecionadas(listasSelecionadas.filter(id => id !== listaId));
    } else {
      setListasSelecionadas([...listasSelecionadas, listaId]);
    }
  };

  const gerarPostsIA = async () => {
    try {
      setIsGenerating(true);
      setPostsGerados(null);
      
      const { data, error } = await supabase.functions.invoke('gerar-posts-whatsapp', {
        body: { 
          produto: {
            nome: produto.nome,
            preco: produto.preco,
            descricao: produto.descricao,
            estoque: produto.estoque,
            especificacoes: produto.especificacoes,
            categoria: produto.categoria,
            link_marketplace: produto.link_marketplace
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
    setMensagem(texto);
    toast.success('Post selecionado!');
  };

  const enviarCampanhaAgora = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Buscar contatos de todas as listas selecionadas
    const { data: listasData } = await supabase
      .from('whatsapp_groups')
      .select('phone_numbers')
      .in('id', listasSelecionadas);

    const todosContatos = listasData?.flatMap(l => l.phone_numbers || []) || [];

    if (todosContatos.length === 0) {
      toast.error('Nenhum contato encontrado nas listas selecionadas');
      return;
    }

    let enviados = 0;
    let erros = 0;

    for (const phone of todosContatos) {
      try {
        // Buscar nome do contato
        const { data: contact } = await supabase
          .from('whatsapp_contacts')
          .select('nome')
          .eq('phone', phone)
          .eq('user_id', user.id)
          .maybeSingle();

        const nome = contact?.nome || 'Cliente';
        
        // Personalizar mensagem
        const mensagemPersonalizada = mensagem
          .replace(/\{\{nome\}\}/gi, nome)
          .replace(/\{\{produto\}\}/gi, produto.nome)
          .replace(/\{\{preco\}\}/gi, produto.preco?.toString() || '');

        // Enviar
        const { error } = await supabase.functions.invoke('send-wuzapi-message', {
          body: {
            phoneNumbers: [phone],
            message: mensagemPersonalizada,
            imageUrl: produto.imagem_url
          }
        });

        if (error) throw error;
        enviados++;

        // Delay entre mensagens
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        console.error('Erro ao enviar para', phone, error);
        erros++;
      }
    }

    toast.success(`✅ Campanha enviada! ${enviados} sucesso, ${erros} erros`);
    
    // Criar campanha temporária para salvar na biblioteca
    const { data: campanhaTemp } = await supabase
      .from('campanhas_recorrentes')
      .insert({
        user_id: user.id,
        produto_id: produto.id,
        nome: `Envio Imediato - ${produto.nome}`,
        listas_ids: listasSelecionadas,
        frequencia: 'agora',
        data_inicio: new Date().toISOString().split('T')[0],
        horarios: [new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })],
        dias_semana: [],
        mensagem_template: mensagem,
        ativa: false,
        status: 'finalizada',
        total_enviados: enviados,
        ultima_execucao: new Date().toISOString()
      })
      .select()
      .single();
    
    if (campanhaTemp) {
      await salvarCampanhaNaBiblioteca({
        produto: {
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao || undefined,
          preco: produto.preco || undefined,
          imagem_url: produto.imagem_url || undefined
        },
        campanha: {
          id: campanhaTemp.id,
          nome: campanhaTemp.nome,
          mensagem_template: mensagem,
          frequencia: 'agora',
          listas_ids: listasSelecionadas
        }
      });
      console.log('📚 Campanha imediata salva na biblioteca!');
    }
  };

  const salvarCampanhaRecorrente = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Calcular próxima execução COM LOGS
    const calcularProximaExecucao = () => {
      const agora = new Date();
      const [h, m] = horarios[0].split(':').map(Number);
      
      console.log('🕐 Calculando próxima execução:', {
        frequencia,
        dataInicio,
        horarios,
        diasSemana,
        agoraLocal: agora.toLocaleString('pt-BR'),
        agoraISO: agora.toISOString()
      });

      let proximaExec: Date;

      if (frequencia === 'teste') {
        // MODO TESTE: executar daqui 2 minutos
        proximaExec = new Date();
        proximaExec.setMinutes(proximaExec.getMinutes() + 2);
        console.log('🧪 TESTE - executar em 2 minutos:', proximaExec.toLocaleString('pt-BR'));
      } else if (frequencia === 'uma_vez') {
        proximaExec = new Date(dataInicio);
        proximaExec.setHours(h, m, 0, 0);
        console.log('📅 Uma vez - usando data escolhida:', proximaExec.toLocaleString('pt-BR'));
      } else if (frequencia === 'diario') {
        proximaExec = new Date(dataInicio);
        proximaExec.setHours(h, m, 0, 0);
        
        // Se já passou, começar amanhã
        if (proximaExec <= agora) {
          proximaExec.setDate(proximaExec.getDate() + 1);
          console.log('⏭️ Horário passou, movendo para amanhã');
        }
      } else if (frequencia === 'semanal') {
        proximaExec = new Date(dataInicio);
        proximaExec.setHours(h, m, 0, 0);
        
        // Encontrar próximo dia válido
        let tentativas = 0;
        while (
          (!diasSemana.includes(proximaExec.getDay()) || proximaExec <= agora) &&
          tentativas < 14
        ) {
          proximaExec.setDate(proximaExec.getDate() + 1);
          tentativas++;
        }
        console.log('📆 Semanal - próximo dia válido:', proximaExec.toLocaleString('pt-BR'));
      } else {
        // personalizado - mesmo que diário
        proximaExec = new Date(dataInicio);
        proximaExec.setHours(h, m, 0, 0);
        if (proximaExec <= agora) {
          proximaExec.setDate(proximaExec.getDate() + 1);
        }
      }

      const resultado = proximaExec.toISOString();
      console.log('✅ Próxima execução calculada:', {
        iso: resultado,
        local: proximaExec.toLocaleString('pt-BR'),
        emMinutos: Math.round((proximaExec.getTime() - agora.getTime()) / 60000)
      });
      
      return resultado;
    };

    const proximaExecucao = calcularProximaExecucao();

    if (campanhaExistente) {
      // Atualizar campanha existente
      const { data: campanhaAtualizada, error } = await supabase
        .from('campanhas_recorrentes')
        .update({
          nome: `Campanha ${produto.nome}`,
          listas_ids: listasSelecionadas,
          frequencia: frequencia,
          data_inicio: dataInicio,
          horarios: horarios,
          dias_semana: diasSemana,
          mensagem_template: mensagem,
          ativa: true,
          proxima_execucao: proximaExecucao,
          vendedor_id: vendedorSelecionado || null
        })
        .eq('id', campanhaExistente.id)
        .select()
        .single();

      if (error) throw error;
      console.log('📝 Campanha atualizada:', campanhaAtualizada);
      toast.success(`✅ Campanha atualizada! Próximo envio: ${new Date(proximaExecucao).toLocaleString('pt-BR')}`);
    } else {
      // Criar nova campanha
      const { data: novaCampanha, error } = await supabase
        .from('campanhas_recorrentes')
        .insert({
          user_id: user.id,
          produto_id: produto.id,
          nome: `Campanha ${produto.nome}`,
          listas_ids: listasSelecionadas,
          frequencia: frequencia,
          data_inicio: dataInicio,
          horarios: horarios,
          dias_semana: diasSemana,
          mensagem_template: mensagem,
          ativa: true,
          proxima_execucao: proximaExecucao,
          status: 'ativa',
          vendedor_id: vendedorSelecionado || null
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✨ Nova campanha criada:', novaCampanha);
      
      // Salvar na biblioteca automaticamente
      await salvarCampanhaNaBiblioteca({
        produto: {
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao || undefined,
          preco: produto.preco || undefined,
          imagem_url: produto.imagem_url || undefined
        },
        campanha: {
          id: novaCampanha.id,
          nome: novaCampanha.nome,
          mensagem_template: mensagem,
          frequencia: frequencia,
          listas_ids: listasSelecionadas
        }
      });
      console.log('📚 Campanha salva na biblioteca!');
      
      toast.success(`✅ Campanha agendada! Próximo envio: ${new Date(proximaExecucao).toLocaleString('pt-BR')}`);
    }
  };

  const handleCriarCampanha = async () => {
    try {
      setIsLoading(true);

      if (listasSelecionadas.length === 0) {
        toast.error('Selecione pelo menos uma lista de transmissão');
        return;
      }

      if (frequencia === 'agora') {
        await enviarCampanhaAgora();
      } else {
        if (!dataInicio) {
          toast.error('Selecione a data de início');
          return;
        }
        await salvarCampanhaRecorrente();
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao criar campanha');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {campanhaExistente ? '✏️ Editar Campanha' : '🚀 Criar Campanha'} WhatsApp - {produto.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* PRODUTO SELECIONADO */}
          <div className="flex gap-4 p-4 bg-muted rounded-lg">
            {produto.imagem_url && (
              <img 
                src={produto.imagem_url} 
                alt={produto.nome}
                className="w-20 h-20 object-cover rounded" 
              />
            )}
            <div>
              <h3 className="font-bold">{produto.nome}</h3>
              <p className="text-sm text-muted-foreground">{produto.descricao}</p>
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
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="personalizado" id="personalizado" />
                <Label htmlFor="personalizado" className="cursor-pointer">⚙️ Personalizado</Label>
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

              {/* Dias da Semana (para semanal) */}
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

          {/* 3. ATRIBUIR A UM VENDEDOR (OPCIONAL) */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold mb-3 block">3. Atribuir a um Vendedor (Opcional)</Label>
            {vendedoresLoading ? (
              <p className="text-sm text-muted-foreground">Carregando vendedores...</p>
            ) : (
              <Select value={vendedorSelecionado} onValueChange={setVendedorSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum vendedor (padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum vendedor</SelectItem>
                  {Array.isArray(vendedores) && vendedores.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome} {v.email && `(${v.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              💡 Se selecionado, as conversas desta campanha serão automaticamente atribuídas ao vendedor escolhido
            </p>
          </div>
          
          {/* 4. LISTAS DE TRANSMISSÃO */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold">4. Selecione Lista(s) de Transmissão</Label>
            {listas.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">
                Nenhuma lista criada ainda. Crie listas na página de WhatsApp Marketing.
              </p>
            ) : (
              <div className="space-y-2 mt-3">
                {listas.map(lista => (
                  <div key={lista.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                    <Checkbox
                      checked={listasSelecionadas.includes(lista.id)}
                      onCheckedChange={() => toggleLista(lista.id)}
                    />
                    <Label className="cursor-pointer flex-1">
                      {lista.group_name} ({lista.member_count} contatos)
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. MENSAGEM */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold mb-3 block">5. Mensagem</Label>
            
            {/* Campo de sugestões + Botão IA */}
            <div className="flex gap-2 mb-4">
              <Input
                value={sugestaoIA}
                onChange={(e) => setSugestaoIA(e.target.value)}
                placeholder="Ex: promoção no Mundial, pão quentinho saindo agora, padaria Recreio..."
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
              placeholder="Olá {{nome}}! Confira nosso produto..."
              rows={8}
            />
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-xs font-medium mb-2">💡 Variáveis disponíveis:</p>
              <div className="flex gap-2 flex-wrap">
                <code 
                  className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" 
                  onClick={() => setMensagem(mensagem + '{{nome}}')}
                >
                  {'{{nome}}'}
                </code>
                <code 
                  className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" 
                  onClick={() => setMensagem(mensagem + '{{produto}}')}
                >
                  {'{{produto}}'}
                </code>
                <code 
                  className="text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" 
                  onClick={() => setMensagem(mensagem + '{{preco}}')}
                >
                  {'{{preco}}'}
                </code>
              </div>
            </div>
          </div>

          {/* BOTÕES */}
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarCampanha} disabled={isLoading}>
              {isLoading ? 'Processando...' : frequencia === 'agora' ? '🚀 Enviar Agora' : '📅 Agendar Campanha'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
