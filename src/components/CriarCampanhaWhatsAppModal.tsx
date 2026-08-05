import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  const [templatesCampanhaTodos, setTemplatesCampanhaTodos] = useState<TemplateMeta[]>([]);
  const [templateConvite, setTemplateConvite] = useState<TemplateMeta | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState<string>('');
  const templateAtivo = templates.find((t) => t.id === templateSelecionado) || null;

  // ============================================================
  // FLUXO GUIADO (linguagem de usuário leigo)
  // Nada de "template", "Meta", "opt-in", "WABA" na tela.
  // Camada de UX por cima das regras — não fura nenhum guardrail.
  // ============================================================
  const [textoModelo, setTextoModelo] = useState('');
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [verificandoModelo, setVerificandoModelo] = useState(false);
  const [enviandoAutorizacoes, setEnviandoAutorizacoes] = useState(false);
  const [confirmAutorizacaoOpen, setConfirmAutorizacaoOpen] = useState(false);
  const [modeloEnviadoAgora, setModeloEnviadoAgora] = useState(false);

  // ============================================================
  // TESTE RÁPIDO — "ver no meu WhatsApp antes de enviar pra todos"
  // Não depende de mensagem aprovada nem de autorização de contato:
  // é você conversando com o seu próprio número (conversa já aberta).
  // ============================================================
  const [telefoneTeste, setTelefoneTeste] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);

  const enviarTesteParaMim = async () => {
    try {
      setEnviandoTeste(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Faça login novamente');

      const telefone = normalizarTelefoneUI(telefoneTeste);
      if (!telefone || telefone.length < 12) {
        toast.error('Digite seu WhatsApp com DDD. Ex: 21 96752-0706');
        return;
      }

      const texto = (previewModeloAmigavel() || mensagem || '').trim();
      if (!texto) {
        toast.error('Escreva a mensagem antes de testar');
        return;
      }

      localStorage.setItem('amz_teste_whatsapp', telefoneTeste);

      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          user_id: user.id,
          to: telefone,
          message: texto,
          image_url: produto.imagem_url || undefined,
        },
      });

      if (error || (data as any)?.success === false) {
        const motivo = String((data as any)?.error || error?.message || '');
        if (/24|window|re-?engag/i.test(motivo)) {
          toast.error(
            'Para o teste chegar, mande primeiro um "oi" no seu WhatsApp de atendimento e tente de novo.'
          );
        } else {
          toast.error(`Não conseguimos enviar o teste agora. ${motivo}`);
        }
        return;
      }

      toast.success('✅ Teste enviado! Confira seu WhatsApp.');
    } catch (e: any) {
      toast.error(e?.message || 'Não conseguimos enviar o teste agora');
    } finally {
      setEnviandoTeste(false);
    }
  };


  const fetchTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, nome_meta, idioma, body_text, variaveis_map, status_meta, tipo_uso')
        .eq('user_id', user.id)
        .in('tipo_uso', ['campanha', 'convite'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('⚠️ Erro ao buscar mensagens modelo:', error);
        setTemplates([]);
        setTemplatesCampanhaTodos([]);
        setTemplateConvite(null);
        return;
      }

      const todos = (data || []) as TemplateMeta[];
      const campanha = todos.filter((t) => t.tipo_uso === 'campanha');
      const aprovados = campanha.filter((t) => t.status_meta === 'aprovado');

      setTemplatesCampanhaTodos(campanha);
      setTemplates(aprovados);
      setTemplateConvite(
        todos.find((t) => t.tipo_uso === 'convite' && t.status_meta === 'aprovado') || null
      );
      // MODO PRONTO: se já existe mensagem liberada, seleciona automaticamente
      // (a mais recente) para o cliente não precisar escolher nada.
      if (aprovados.length > 0) {
        setTemplateSelecionado((atual) =>
          atual && aprovados.some((t) => t.id === atual) ? atual : aprovados[0].id
        );
      } else {
        setTemplateSelecionado('');
      }
    } catch (e) {
      console.error('❌ Erro ao carregar mensagens modelo:', e);
      setTemplates([]);
      setTemplatesCampanhaTodos([]);
      setTemplateConvite(null);
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

  // ============================================================
  // ETAPA DO FLUXO GUIADO
  // A = ainda não tem mensagem modelo liberada e nada em análise
  // B = mensagem em análise
  // C = mensagem liberada, mas contatos escolhidos sem autorização
  // D = tudo pronto
  // ============================================================
  const temModeloLiberado = templates.length > 0;
  const temModeloEmAnalise = templatesCampanhaTodos.some((t) => t.status_meta === 'pendente');
  const etapa: 'A' | 'B' | 'C' | 'D' = !temModeloLiberado
    ? (temModeloEmAnalise ? 'B' : 'A')
    : (listasSelecionadas.length > 0 && totalConfirmadosSelecionados === 0 ? 'C' : 'D');

  /** Texto amigável → formato aceito pelo WhatsApp ({{1}}, {{2}}...) */
  const CHIPS: { label: string; chave: string }[] = [
    { label: '[nome do cliente]', chave: 'nome' },
    { label: '[produto]', chave: 'produto' },
    { label: '[preço]', chave: 'preco' },
  ];

  const converterTextoModelo = (texto: string) => {
    const ordem: string[] = [];
    let corpo = texto;
    // percorre o texto na ordem real de aparição
    const regex = new RegExp(CHIPS.map((c) => c.label.replace(/[[\]]/g, '\\$&')).join('|'), 'g');
    corpo = corpo.replace(regex, (achado) => {
      const chip = CHIPS.find((c) => c.label === achado)!;
      ordem.push(chip.chave);
      return `{{${ordem.length}}}`;
    });
    return { corpo, ordem };
  };

  const previewModeloAmigavel = () =>
    textoModelo
      .replace(/\[nome do cliente\]/g, 'Maria')
      .replace(/\[produto\]/g, produto.nome || 'seu produto')
      .replace(
        /\[preço\]/g,
        produto.preco != null ? `R$ ${Number(produto.preco).toFixed(2)}` : 'R$ —'
      );

  const inserirChip = (label: string) => setTextoModelo((atual) => `${atual}${label}`);

  /** Cria a "mensagem modelo" e envia pra análise do WhatsApp (sem jargão na tela) */
  const criarEEnviarModelo = async () => {
    try {
      setSalvandoModelo(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Faça login novamente');

      const { corpo, ordem } = converterTextoModelo(textoModelo.trim());
      if (!corpo) {
        toast.error('Escreva a mensagem que você quer enviar');
        return;
      }

      const nomeMeta = `campanha_${Date.now()}`;
      const variaveis_map = ordem.reduce<Record<string, string>>((acc, chave, idx) => {
        acc[String(idx + 1)] = chave;
        return acc;
      }, {});

      const { data: novo, error: erroInsert } = await supabase
        .from('whatsapp_templates')
        .insert({
          user_id: user.id,
          nome_meta: nomeMeta,
          idioma: 'pt_BR',
          categoria_meta: 'MARKETING',
          tipo_uso: 'campanha',
          status_meta: 'rascunho',
          body_text: corpo,
          variaveis_map,
        })
        .select()
        .single();

      if (erroInsert) throw erroInsert;

      const { data: submit, error: erroSubmit } = await supabase.functions.invoke(
        'whatsapp-template-submit',
        { body: { template_id: novo.id } }
      );

      if (erroSubmit || (submit as any)?.success === false) {
        const msg = (submit as any)?.error || erroSubmit?.message || '';
        toast.error(
          `Não conseguimos enviar sua mensagem pra análise agora. ${msg ? `Motivo: ${msg}` : 'Tente novamente em instantes.'}`
        );
        await fetchTemplates();
        return;
      }

      setModeloEnviadoAgora(true);
      toast.success('✅ Enviamos sua mensagem para análise do WhatsApp!');
      await fetchTemplates();
    } catch (e: any) {
      console.error('Erro ao criar mensagem modelo:', e);
      toast.error(e?.message || 'Não conseguimos criar sua mensagem agora');
    } finally {
      setSalvandoModelo(false);
    }
  };

  /** Consulta se a análise do WhatsApp já liberou */
  const verificarModelo = async () => {
    try {
      setVerificandoModelo(true);
      const { error } = await supabase.functions.invoke('whatsapp-template-refresh', {
        body: { all: true },
      });
      if (error) throw error;
      await fetchTemplates();
      toast.success('Status atualizado');
    } catch (e: any) {
      toast.error('Não conseguimos verificar agora. Tente de novo em instantes.');
    } finally {
      setVerificandoModelo(false);
    }
  };

  /** Pede autorização aos contatos que ainda não autorizaram */
  const pedirAutorizacoes = async () => {
    try {
      setEnviandoAutorizacoes(true);

      if (!templateConvite) {
        toast.error(
          'Antes de pedir autorização, sua mensagem de convite também precisa passar pela análise do WhatsApp. Fale com o suporte para liberar.'
        );
        return;
      }

      let enviados = 0;
      for (const listaId of listasSelecionadas) {
        const { data, error } = await supabase.functions.invoke('enviar-convite-optin', {
          body: { lista_id: listaId, template_id: templateConvite.id },
        });
        if (error || (data as any)?.success === false) {
          console.error('Falha ao pedir autorização:', listaId, error || data);
          continue;
        }
        enviados += Number((data as any)?.enviados || 0);
      }

      if (enviados === 0) {
        toast.warning('Nenhum convite novo foi enviado agora. Tente novamente mais tarde.');
      } else {
        toast.success(`Perguntamos a ${enviados} contato(s) se aceitam receber suas mensagens.`);
      }
      await fetchListas();
    } catch (e: any) {
      toast.error('Não conseguimos pedir as autorizações agora.');
    } finally {
      setEnviandoAutorizacoes(false);
    }
  };

  // Pré-preenche a mensagem modelo com o produto ao abrir
  useEffect(() => {
    if (!open) {
      setModeloEnviadoAgora(false);
      return;
    }
    setTextoModelo(
      `Oi [nome do cliente], tudo bem? Separei uma oferta especial pra você: [produto] sai por [preço]. Quer que eu te passe os detalhes?`
    );
    setTelefoneTeste(localStorage.getItem('amz_teste_whatsapp') || '');
  }, [open, produto?.id]);


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
          mensagem_template: templateAtivo?.body_text || '',
          template_id: templateSelecionado,
          canal: 'meta_oficial',
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
          mensagem_template: templateAtivo?.body_text || '',
          template_id: templateSelecionado,
          canal: 'meta_oficial',
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

      if (!templateSelecionado || !templateAtivo || templateAtivo.status_meta !== 'aprovado') {
        toast.error('Selecione um template de campanha aprovado pela Meta');
        return;
      }

      if (listasSelecionadas.length === 0) {
        toast.error('Selecione pelo menos uma lista/segmento');
        return;
      }

      if (totalConfirmadosSelecionados === 0) {
        toast.error('Nenhum contato com opt-in confirmado nos destinos selecionados');
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

          {/* SEM MENSAGEM LIBERADA — a criação/aprovação mora na tela de WhatsApp */}
          {(etapa === 'A' || etapa === 'B') && (
            <div className="p-4 rounded-lg border bg-background space-y-3">
              <p className="text-sm font-semibold">
                {etapa === 'B'
                  ? '⏳ Sua mensagem está aguardando liberação do WhatsApp'
                  : 'Você ainda não tem uma mensagem liberada'}
              </p>
              <p className="text-sm text-muted-foreground">
                {etapa === 'B'
                  ? 'Assim que liberar, esta tela abre direto no envio: você escolhe a agenda de clientes e dispara.'
                  : 'A mensagem é criada e liberada uma única vez na tela de WhatsApp. Depois, aqui só resta escolher a agenda de clientes e enviar.'}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = '/pj/whatsapp-templates'; }}
              >
                Abrir tela de mensagens do WhatsApp
              </Button>
            </div>
          )}


          {(etapa === 'C' || etapa === 'D') && (
          <>

          {/* MODO PRONTO — a burocracia já foi feita uma vez */}
          <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
            <p className="text-sm font-semibold">✅ Sua mensagem já está liberada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Agora é só escolher para quem enviar e clicar em enviar. O nome do cliente, o produto e o
              preço entram automáticos — você não precisa refazer nada a cada campanha.
            </p>
          </div>

          {/* PASSO ÚNICO — PARA QUEM ENVIAR (segmentos) */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-lg font-semibold">Para quem enviar</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Escolha um ou mais grupos de clientes. Campanhas são enviadas individualmente para cada
              cliente — grupos de WhatsApp não recebem campanha.
            </p>
            {listas.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">
                Você ainda não criou grupos de clientes. Crie em "Clientes e Segmentos".
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
                      {lista.group_name} — {lista.phone_numbers.length} de {lista.member_count} autorizados
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {/* PREVIEW DE DESTINATÁRIOS — só quem autorizou recebe */}
            {listasSelecionadas.length > 0 && (
              <div className="mt-4 p-3 rounded-lg border bg-background">
                <p className="text-sm font-medium">
                  ✅ {totalConfirmadosSelecionados} de {totalContatosSelecionados} vão receber
                  {totalSemOptin > 0 && ` (${totalSemOptin} ainda sem autorização)`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Só enviamos para quem autorizou receber suas mensagens. É assim que o WhatsApp protege o
                  seu número de bloqueio.
                </p>
              </div>
            )}
          </div>

          {/* PREVIEW DA MENSAGEM QUE VAI SAIR (sem jargão, sem escolha obrigatória) */}
          {templateAtivo && (
            <div className="p-3 rounded-lg border bg-background">
              <p className="text-xs font-medium mb-2">Como o cliente vai receber (exemplo com "Maria"):</p>
              <p className="text-sm whitespace-pre-wrap">{previewTemplate() || '—'}</p>
            </div>
          )}

          {/* OPÇÕES AVANÇADAS — agendamento, vendedor e troca de mensagem ficam escondidos */}
          <details className="rounded-lg border bg-background">
            <summary className="cursor-pointer select-none p-3 text-sm font-medium">
              ⚙️ Opções avançadas (agendar, vendedor, trocar a mensagem)
            </summary>

            <div className="p-4 pt-0 space-y-6">
              {/* FREQUÊNCIA */}
              <div>
                <Label className="text-sm font-semibold">Quando enviar</Label>
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

              {/* DATA E HORÁRIOS */}
              {frequencia !== 'agora' && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <Label className="text-sm font-semibold">Data e horários</Label>

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

              {/* VENDEDOR RESPONSÁVEL */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <Label className="text-sm font-semibold mb-3 block">Vendedor responsável (opcional)</Label>
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

              {/* TROCAR A MENSAGEM LIBERADA (só faz sentido com mais de uma) */}
              {templates.length > 1 && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <Label className="text-sm font-semibold mb-1 block">Trocar a mensagem</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Estas são as mensagens já liberadas para envio em massa.
                  </p>
                  <Select value={templateSelecionado} onValueChange={setTemplateSelecionado}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolha a mensagem" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          ✅ {t.body_text ? `${t.body_text.slice(0, 60)}${t.body_text.length > 60 ? '…' : ''}` : t.nome_meta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </details>
          </>
          )}


          {/* ESTADO C — contatos ainda sem autorização */}
          {etapa === 'C' && (
            <div className="p-4 rounded-lg border bg-background space-y-3">
              <p className="text-sm font-semibold">✅ Sua mensagem está liberada!</p>
              <p className="text-sm text-muted-foreground">
                Só podemos enviar para contatos que autorizaram receber suas mensagens — é assim que o
                WhatsApp protege o seu número de bloqueio.
              </p>
              <p className="text-sm font-medium">
                {totalConfirmadosSelecionados} de {totalContatosSelecionados} contatos autorizados
              </p>
              <Button
                onClick={() => setConfirmAutorizacaoOpen(true)}
                disabled={enviandoAutorizacoes}
                className="w-full"
              >
                {enviandoAutorizacoes ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Perguntando aos contatos...
                  </>
                ) : (
                  'Pedir autorização aos demais'
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Vamos perguntar aos seus contatos se aceitam receber suas mensagens. Quem responder que
                sim já entra na próxima campanha.
              </p>

              <AlertDialog open={confirmAutorizacaoOpen} onOpenChange={setConfirmAutorizacaoOpen}>
                <AlertDialogContent className="bg-background">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar pedido de autorização</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vamos enviar uma mensagem perguntando aos seus{' '}
                      {Math.max(0, totalContatosSelecionados - totalConfirmadosSelecionados)} contatos se
                      aceitam receber suas ofertas. Quem responder SIM entra na sua lista. Esta ainda não é
                      a sua campanha de vendas. Confirmar?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setConfirmAutorizacaoOpen(false);
                        pedirAutorizacoes();
                      }}
                    >
                      Sim, perguntar aos contatos
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* BOTÕES */}
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {etapa === 'A' || etapa === 'B' ? 'Fechar' : 'Cancelar'}
            </Button>
            {etapa === 'D' && (
              <Button onClick={handleCriarCampanha} disabled={isLoading}>
                {isLoading ? 'Processando...' : frequencia === 'agora' ? '🚀 Enviar Agora' : '📅 Agendar Campanha'}
              </Button>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
