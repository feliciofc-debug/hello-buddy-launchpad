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

/** Normalização canônica de telefone (módulo, usada também no render) */
function normalizarTelefoneUI(phone: string) {
  const somenteDigitos = (phone || '').replace(/\D/g, '');
  if (!somenteDigitos) return '';
  if (somenteDigitos.length === 10 || somenteDigitos.length === 11) return `55${somenteDigitos}`;
  return somenteDigitos;
}

interface WhatsAppGroup {

  id: string;
  group_id?: string;
  group_name: string;
  member_count: number;
  phone_numbers: string[];
  /**
   * Grupos de WhatsApp NÃO são mais destino de campanha:
   * a Meta Cloud API não envia para grupos e grupo não tem opt-in individual.
   */
  source: 'pj_lista';
  group_jid?: string | null;
}

interface TemplateMeta {
  id: string;
  nome_meta: string;
  idioma: string | null;
  body_text: string | null;
  variaveis_map: any;
  status_meta: string;
  tipo_uso: string;
}


interface Vendedor {
  id: string;
  nome: string;
  email: string;
  especialidade?: string;
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
  console.log('🚀 MODAL INICIADO', { open, produtoNome: produto?.nome, campanhaExistente: !!campanhaExistente });
  
  // Proteção: se produto não existe, não renderiza nada
  if (!produto) {
    console.error('❌ PRODUTO INVÁLIDO - Modal não pode abrir sem produto');
    return null;
  }
  
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
  
  // Estados para vendedores
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>('');

  // ============================================================
  // META OFICIAL — TEMPLATES APROVADOS (obrigatório para campanha)
  // ============================================================
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [templateSelecionado, setTemplateSelecionado] = useState<string>('');
  const templateAtivo = templates.find((t) => t.id === templateSelecionado) || null;

  const fetchTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, nome_meta, idioma, body_text, variaveis_map, status_meta, tipo_uso')
        .eq('user_id', user.id)
        .eq('tipo_uso', 'campanha')
        .eq('status_meta', 'aprovado')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('⚠️ Erro ao buscar templates aprovados:', error);
        setTemplates([]);
        return;
      }

      setTemplates((data || []) as TemplateMeta[]);
      if ((data || []).length === 1) setTemplateSelecionado(data![0].id);
    } catch (e) {
      console.error('❌ Erro ao carregar templates:', e);
      setTemplates([]);
    }
  };

  /** Chaves de variável do template, na ordem {{1}}, {{2}}, ... */
  const chavesTemplate = (tpl: TemplateMeta | null): string[] => {
    const map = tpl?.variaveis_map;
    if (Array.isArray(map)) return map.map((k: any) => String(k));
    if (map && typeof map === 'object') {
      return Object.keys(map)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String((map as any)[k]));
    }
    return [];
  };

  /** De onde vem cada variável (mapeamento fixo e auditável) */
  const valorDaVariavel = (chave: string, nomeContato: string): string => {
    const k = chave.replace(/[{}\s]/g, '').toLowerCase();
    if (k === 'nome') return nomeContato || 'Cliente';
    if (k === 'produto') return produto.nome || '';
    if (k === 'preco') return produto.preco != null ? `R$ ${Number(produto.preco).toFixed(2)}` : '';
    return '';
  };

  const montarVariaveisTemplate = (tpl: TemplateMeta | null, nomeContato: string): string[] =>
    chavesTemplate(tpl).map((chave) => valorDaVariavel(chave, nomeContato));

  /** Preview do texto final do template com as variáveis já substituídas */
  const previewTemplate = (): string => {
    if (!templateAtivo?.body_text) return '';
    const valores = montarVariaveisTemplate(templateAtivo, 'Maria');
    let texto = templateAtivo.body_text;
    valores.forEach((valor, idx) => {
      texto = texto.replace(new RegExp(`\\{\\{\\s*${idx + 1}\\s*\\}\\}`, 'g'), valor);
    });
    return texto
      .replace(/\{\{\s*nome\s*\}\}/gi, valorDaVariavel('nome', 'Maria'))
      .replace(/\{\{\s*produto\s*\}\}/gi, valorDaVariavel('produto', ''))
      .replace(/\{\{\s*preco\s*\}\}/gi, valorDaVariavel('preco', ''));
  };

  // Preview de destinatários: X de Y vão receber (Z sem opt-in)
  const destinosSelecionadosObj = listas.filter((l) => listasSelecionadas.includes(l.id));
  const totalContatosSelecionados = destinosSelecionadosObj.reduce((acc, l) => acc + (l.member_count || 0), 0);
  const totalConfirmadosSelecionados = new Set(
    destinosSelecionadosObj.flatMap((l) => (l.phone_numbers || []).map(normalizarTelefoneUI))
  ).size;
  const totalSemOptin = Math.max(0, totalContatosSelecionados - totalConfirmadosSelecionados);


  useEffect(() => {
    console.log('⚙️ useEffect EXECUTADO', { open });
    if (open) {
      try {
        console.log('🔄 Iniciando fetch de listas, vendedores e templates aprovados...');
        fetchListas();
        fetchVendedores();
        fetchTemplates();

        
        // Se tem campanha existente, carregar dados dela
        if (campanhaExistente) {
          console.log('📝 Carregando campanha existente:', campanhaExistente.id);
          setFrequencia(campanhaExistente.frequencia as any);
          setDataInicio(campanhaExistente.data_inicio);
          setHorarios(campanhaExistente.horarios);
          setDiasSemana(campanhaExistente.dias_semana || [1, 2, 3, 4, 5]);
          setMensagem(campanhaExistente.mensagem_template);
          setListasSelecionadas(campanhaExistente.listas_ids);
        } else {
          console.log('✨ Nova campanha - configurando template padrão');
          const isArquivoConfidencial = produto.nome?.toLowerCase().includes('arquivo confidencial');

          if (isArquivoConfidencial) {
            setMensagem(`Oi {{nome}}! Tudo bem? 😊

Me permite compartilhar algo rápido sobre desenvolvimento profissional?

Existe uma habilidade que separa profissionais comuns de negociadores extraordinários — a capacidade de ler pessoas.

Entender o que o outro precisa antes de ele dizer. Perceber resistência antes dela virar objeção.

Isso tem nome: inteligência comportamental.

O livro "Arquivo Confidencial" apresenta o Método ARC — um framework prático de Análise, Resistência e Conversão para quem leva negócios a sério.

Se fizer sentido pra você: https://go.hotmart.com/C104903078G

Qualquer dúvida, estou por aqui! Abraço 👊`);
          } else {
            const linkProduto = produto.link_marketplace || 'https://amzofertas.com.br/checkout';
            setMensagem(`Olá {{nome}}! 👋

Confira nosso produto:

📦 *${produto.nome}*
${produto.preco ? `💰 *R$ ${produto.preco.toFixed(2)}*` : ''}

${produto.descricao || ''}

🛒 *Compre agora:*
${linkProduto}

_Escolha quantidade e finalize!_ ✅`);
          }
        }
        console.log('✅ useEffect concluído com sucesso');
      } catch (error) {
        console.error('❌ ERRO CRÍTICO no useEffect:', error);
        toast.error('Erro ao inicializar campanha');
      }
    }
  }, [open, produto, campanhaExistente]);

  // ============================================================
  // DESTINOS DE CAMPANHA — SOMENTE LISTAS/SEGMENTOS PJ
  // Grupos de WhatsApp foram descartados: a Meta Cloud API não envia
  // para grupos e grupo não tem opt-in individual (regra da Fase 1).
  // Cada lista traz também a contagem de opt-in CONFIRMADO.
  // ============================================================
  const fetchListas = async () => {
    console.log('📋 Buscando listas/segmentos PJ (grupos não são destino de campanha)...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ Usuário não autenticado');
        return;
      }

      const { data: pjListas, error: pjError } = await supabase
        .from('pj_listas_categoria')
        .select('id, nome, total_membros')
        .eq('user_id', user.id)
        .eq('ativa', true)
        .order('total_membros', { ascending: false });

      if (pjError) {
        console.error('⚠️ Erro ao buscar listas PJ:', pjError);
      }

      const listasPJComTelefones: WhatsAppGroup[] = await Promise.all(
        (pjListas || []).map(async (lista) => {
          const { data: membros } = await supabase
            .from('pj_lista_membros')
            .select('telefone, opt_in_status')
            .eq('lista_id', lista.id);

          const todos = (membros || []).filter((m: any) => m.telefone);
          const confirmados = todos.filter((m: any) => m.opt_in_status === 'confirmado');

          return {
            id: lista.id,
            group_id: lista.id,
            group_name: `📋 ${lista.nome}`,
            member_count: todos.length || lista.total_membros || 0,
            phone_numbers: confirmados.map((m: any) => m.telefone),
            source: 'pj_lista',
            group_jid: null,
          } as WhatsAppGroup;
        })
      );

      console.log(`✅ ${listasPJComTelefones.length} lista(s)/segmento(s) carregados`);
      setListas(listasPJComTelefones);

    } catch (error) {
      console.error('❌ ERRO ao buscar listas:', error);
      toast.error('Erro ao carregar listas');
      setListas([]);
    }
  };

  const fetchVendedores = async () => {
    console.log('👥 Buscando vendedores...');
    try {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nome, email, especialidade, ativo')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        console.warn('⚠️ Não foi possível carregar vendedores:', error.message);
        setVendedores([]);
        return;
      }
      
      console.log(`✅ ${data?.length || 0} vendedores carregados`);
      setVendedores(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('⚠️ Erro ao buscar vendedores:', error);
      setVendedores([]);
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
    // SEMPRE adicionar link de checkout no final da mensagem
    const linkProduto = produto.link_marketplace || 'https://amzofertas.com.br/checkout';
    
    // Verificar se o texto já contém um link
    const jaTemLink = texto.includes('http://') || texto.includes('https://');
    
    let mensagemFinal = texto;
    
    if (!jaTemLink) {
      // Adicionar link fixo no final
      mensagemFinal = `${texto}

🛒 *Compre agora:*
${linkProduto}

_Escolha quantidade e finalize!_ ✅`;
    }
    
    setMensagem(mensagemFinal);
    toast.success('Post selecionado com link incluído!');
  };

  const normalizarTelefone = (phone: string) => {
    const somenteDigitos = (phone || '').replace(/\D/g, '');
    if (!somenteDigitos) return '';
    if (somenteDigitos.length === 10 || somenteDigitos.length === 11) {
      return `55${somenteDigitos}`;
    }
    return somenteDigitos;
  };

  const gerarVariantesTelefone = (phone: string) => {
    const base = normalizarTelefone(phone);
    if (!base) return [];

    const semDDI = base.startsWith('55') ? base.slice(2) : base;
    return [...new Set([base, semDDI, `+${base}`].filter(Boolean))];
  };

  const resolverNomeContato = async (phone: string, userId: string, listaIds: string[]) => {
    const variantes = gerarVariantesTelefone(phone);
    if (variantes.length === 0) return 'Cliente';

    // 1) Prioridade: contatos salvos do usuário
    const { data: contato } = await supabase
      .from('whatsapp_contacts')
      .select('nome')
      .eq('user_id', userId)
      .in('phone', variantes)
      .not('nome', 'is', null)
      .limit(1)
      .maybeSingle();

    if (contato?.nome?.trim()) return contato.nome.trim();

    // 2) Lista PJ (importações manuais)
    const { data: membroPJ } = await supabase
      .from('pj_lista_membros')
      .select('nome')
      .in('lista_id', listaIds)
      .in('telefone', variantes)
      .not('nome', 'is', null)
      .limit(1)
      .maybeSingle();

    if (membroPJ?.nome?.trim()) return membroPJ.nome.trim();

    // 3) Cadastros do usuário
    const filtroWhatsapp = variantes
      .map((numero) => `whatsapp.eq.${numero.replace('+', '')}`)
      .join(',');

    if (filtroWhatsapp) {
      const { data: cadastro } = await supabase
        .from('cadastros')
        .select('nome')
        .eq('user_id', userId)
        .or(filtroWhatsapp)
        .not('nome', 'is', null)
        .limit(1)
        .maybeSingle();

      if (cadastro?.nome?.trim()) return cadastro.nome.trim();
    }

    return 'Cliente';
  };

  const enviarCampanhaAgora = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado para inserir campanha na fila');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 INICIANDO CAMPANHA COM VENDEDOR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Vendedor ID:', vendedorSelecionado);
    
    // Buscar nome do vendedor para confirmar
    if (vendedorSelecionado) {
      const { data: vendedorInfo } = await supabase
        .from('vendedores')
        .select('nome, email')
        .eq('id', vendedorSelecionado)
        .single();
      
      console.log('👤 Nome do vendedor:', vendedorInfo?.nome || 'NÃO ENCONTRADO');
      console.log('📧 Email do vendedor:', vendedorInfo?.email || 'N/A');
      
      if (!vendedorInfo) {
        toast.error('⚠️ ERRO: Vendedor não encontrado no banco!');
        return;
      }
    } else {
      console.log('⚠️ Nenhum vendedor selecionado');
    }
    
    console.log('📦 Produto:', produto.nome);

    // ============================================================
    // DISPARO 100% META CLOUD API OFICIAL
    // - template aprovado obrigatório
    // - só contatos com opt-in CONFIRMADO
    // - sem Baileys / sem fila_atendimento_pj
    // ============================================================
    if (!templateSelecionado || !templateAtivo || templateAtivo.status_meta !== 'aprovado') {
      toast.error('Selecione um template de campanha APROVADO pela Meta');
      return;
    }

    const listasContatoIds = listas
      .filter((lista) => listasSelecionadas.includes(lista.id))
      .map((lista) => lista.id);

    if (listasContatoIds.length === 0) {
      toast.error('Selecione pelo menos uma lista/segmento');
      return;
    }

    const { data: membros } = await supabase
      .from('pj_lista_membros')
      .select('telefone, nome, opt_in_status')
      .in('lista_id', listasContatoIds);

    // Dedup canônico + separação por opt-in
    const mapaContatos = new Map<string, { nome: string; status: string }>();
    for (const m of membros || []) {
      const tel = normalizarTelefone(String(m.telefone || ''));
      if (!tel) continue;
      const anterior = mapaContatos.get(tel);
      // 'recusado' (STOP) sempre prevalece
      const status = anterior?.status === 'recusado' || m.opt_in_status === 'recusado'
        ? 'recusado'
        : (m.opt_in_status === 'confirmado' || anterior?.status === 'confirmado' ? 'confirmado' : (m.opt_in_status || 'pendente'));
      mapaContatos.set(tel, { nome: (m.nome || anterior?.nome || '').trim(), status });
    }

    const totalBruto = mapaContatos.size;
    const confirmados = Array.from(mapaContatos.entries()).filter(([, v]) => v.status === 'confirmado');
    const semOptin = totalBruto - confirmados.length;

    console.log(`📋 Destinatários: ${confirmados.length} de ${totalBruto} com opt-in confirmado (${semOptin} sem opt-in)`);

    if (confirmados.length === 0) {
      toast.error(`Nenhum contato com opt-in confirmado (${totalBruto} sem opt-in). Envie o convite de opt-in primeiro.`);
      return;
    }

    // Registrar a campanha (histórico/biblioteca) já no canal oficial
    const { data: campanhaTemp, error: erroCampanha } = await supabase
      .from('campanhas_recorrentes')
      .insert({
        user_id: user.id,
        produto_id: produto.id,
        nome: `Envio Imediato - ${produto.nome}`,
        listas_ids: listasSelecionadas,
        frequencia: 'uma_vez',
        data_inicio: new Date().toISOString().split('T')[0],
        horarios: ['00:00'],
        mensagem_template: templateAtivo.body_text || '',
        template_id: templateSelecionado,
        canal: 'meta_oficial',
        ativa: false,
        status: 'enviada',
        vendedor_id: vendedorSelecionado || null
      })
      .select()
      .single();

    if (erroCampanha) {
      console.error('❌ Erro ao criar registro da campanha:', erroCampanha);
    }

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
          mensagem_template: templateAtivo.body_text || '',
          frequencia: 'agora',
          listas_ids: listasSelecionadas
        }
      });
    }

    toast.success(`🚀 Enviando ${confirmados.length} mensagem(ns) via WhatsApp oficial...`);

    let enviados = 0;
    let falhas = 0;

    for (const [phone, info] of confirmados) {
      let nomeContato = info.nome;
      if (!nomeContato) {
        try {
          nomeContato = await resolverNomeContato(phone, user.id, listasContatoIds);
        } catch {
          nomeContato = 'Cliente';
        }
      }

      const variaveis = montarVariaveisTemplate(templateAtivo, nomeContato);

      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        'whatsapp-cloud-send-template',
        {
          body: {
            user_id: user.id,
            to: phone,
            template_id: templateSelecionado,
            variaveis,
            campanha_id: campanhaTemp?.id || null,
            tipo: 'campanha',
          },
        }
      );

      if (!sendError && (sendResult as any)?.success) {
        enviados++;
      } else {
        falhas++;
        console.error('❌ Falha no envio oficial:', phone, sendError || sendResult);
        const categoria = String((sendResult as any)?.categoria || '');
        if (categoria === 'token' || categoria === 'template' || categoria === 'config') {
          toast.error(`Erro de configuração da Meta (${categoria}) — envio interrompido`);
          break;
        }
      }
    }

    if (campanhaTemp?.id) {
      await supabase
        .from('campanhas_recorrentes')
        .update({ total_enviados: enviados })
        .eq('id', campanhaTemp.id);
    }

    if (enviados === 0) {
      throw new Error('Nenhuma mensagem foi aceita pela Meta. Verifique token e template.');
    }

    if (falhas > 0) {
      toast.warning(`⚠️ ${enviados} enviada(s) e ${falhas} falha(s). Veja o console.`);
      return;
    }

    toast.success(`✅ ${enviados} mensagem(ns) enviada(s) pela API oficial da Meta!`);
  };


  const salvarCampanhaRecorrente = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado para salvar campanha');
    }

    // Calcular próxima execução COM LOGS
    const calcularProximaExecucao = () => {
      const agora = new Date();
      // Ordena horários e usa o primeiro como fallback
      const horariosOrdenados = [...horarios].sort();
      const [h, m] = horariosOrdenados[0].split(':').map(Number);

      console.log('🕐 Calculando próxima execução:', {
        frequencia,
        dataInicio,
        horarios: horariosOrdenados,
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
        // ✅ FIX A: uma_vez agora aponta pro primeiro horário ÚTIL do dia (>= agora)
        // Se todos os horários do dia já passaram, usa o primeiro (executor tem janela de recuperação de 2h)
        const dataBase = new Date(dataInicio);
        let escolhido: Date | null = null;
        for (const horario of horariosOrdenados) {
          const [hh, mm] = horario.split(':').map(Number);
          const cand = new Date(dataBase);
          cand.setHours(hh, mm, 0, 0);
          if (cand > agora) { escolhido = cand; break; }
        }
        if (!escolhido) {
          escolhido = new Date(dataBase);
          escolhido.setHours(h, m, 0, 0);
        }
        proximaExec = escolhido;
        console.log(`📅 Uma vez - ${horariosOrdenados.length} horário(s) programado(s), próximo: ${proximaExec.toLocaleString('pt-BR')}`);

      } else if (frequencia === 'diario') {
        proximaExec = new Date(dataInicio);
        proximaExec.setHours(h, m, 0, 0);
        
        // Se já passou, verificar há quanto tempo
        if (proximaExec <= agora) {
          const diffMs = agora.getTime() - proximaExec.getTime();
          const diffHoras = diffMs / (1000 * 60 * 60);
          
          if (diffHoras <= 2) {
            // Passou há menos de 2 horas: disparar em 1 minuto
            proximaExec = new Date(agora.getTime() + 60 * 1000);
            console.log('🔥 Horário passou há menos de 2h, disparando em 1 minuto');
          } else {
            // Passou há mais de 2 horas: mover para amanhã
            proximaExec.setDate(proximaExec.getDate() + 1);
            console.log('⏭️ Horário passou há mais de 2h, movendo para amanhã');
          }
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
        // personalizado - mesmo que diário com proteção de 2h
        proximaExec = new Date(dataInicio);
        proximaExec.setHours(h, m, 0, 0);
        if (proximaExec <= agora) {
          const diffMs = agora.getTime() - proximaExec.getTime();
          const diffHoras = diffMs / (1000 * 60 * 60);
          if (diffHoras <= 2) {
            proximaExec = new Date(agora.getTime() + 60 * 1000);
          } else {
            proximaExec.setDate(proximaExec.getDate() + 1);
          }
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
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(`Erro: ${error?.message || 'Falha ao criar campanha'}`);
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
                {frequencia === 'uma_vez' && horarios.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ℹ️ Todos os {horarios.length} horários serão disparados no mesmo dia ({new Date(dataInicio).toLocaleDateString('pt-BR')}). Não precisa duplicar a campanha.
                  </p>
                )}

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

          {/* 2. VENDEDOR RESPONSÁVEL */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold mb-3 block">2. Vendedor Responsável (Opcional)</Label>
            <Select
              value={vendedorSelecionado || 'nenhum'}
              onValueChange={(v) => setVendedorSelecionado(v === 'nenhum' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">
                  Sem vendedor atribuído
                </SelectItem>
                {vendedores.map(vendedor => (
                  <SelectItem key={vendedor.id} value={vendedor.id}>
                    👤 {vendedor.nome}
                    {vendedor.especialidade && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({vendedor.especialidade})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              ℹ️ Conversas desta campanha serão automaticamente atribuídas a este vendedor
            </p>
          </div>

          {/* 3. LISTAS DE TRANSMISSÃO */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold">3. Selecione Lista(s) de Transmissão</Label>
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

          {/* 4. MENSAGEM */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold mb-3 block">4. Mensagem</Label>
            
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
