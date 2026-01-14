import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Clock, Calendar, Send, Pause, Play, Settings, 
  Package, RefreshCw, Trash2, Plus, ChevronDown, ChevronUp, Loader2, Sparkles, Video
} from "lucide-react";
import { SiTiktok } from "react-icons/si";

interface Programacao {
  id: string;
  nome: string;
  descricao?: string;
  categorias: string[];
  intervalo_minutos: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
  dias_mes?: number[];
  modo_selecao: string;
  enviar_para_todos_grupos: boolean;
  grupos_ids: string[];
  ativo: boolean;
  proximo_envio?: string;
  ultimo_envio?: string;
  total_enviados: number;
  total_enviados_hoje: number;
  prefixo_mensagem: string;
  sufixo_mensagem: string;
  incluir_imagem: boolean;
  incluir_preco: boolean;
  incluir_link: boolean;
  usar_ia_criativa?: boolean;
  enviar_tiktok?: boolean;
  tiktok_post_mode?: string;
}

interface Grupo {
  id: string;
  group_name: string;
  group_jid: string;
}

// 22 Categorias Amazon completas
const CATEGORIAS_DISPONIVEIS = [
  { id: 'Alimentos e Bebidas', nome: 'Alimentos', icone: '🍴' },
  { id: 'Automotivo', nome: 'Automotivo', icone: '🚗' },
  { id: 'Bebês', nome: 'Bebês', icone: '👶' },
  { id: 'Beleza', nome: 'Beleza', icone: '💄' },
  { id: 'Brinquedos e Jogos', nome: 'Brinquedos', icone: '🎮' },
  { id: 'Casa', nome: 'Casa', icone: '🏠' },
  { id: 'Construção', nome: 'Construção', icone: '🔨' },
  { id: 'Cozinha', nome: 'Cozinha', icone: '🍳' },
  { id: 'Cuidados Pessoais e Limpeza', nome: 'Limpeza', icone: '🧼' },
  { id: 'Eletrodomésticos', nome: 'Eletros', icone: '🔌' },
  { id: 'Eletrônicos e Celulares', nome: 'Tech', icone: '📱' },
  { id: 'Esportes e Aventura', nome: 'Esportes', icone: '💪' },
  { id: 'Ferramentas e Construção', nome: 'Ferramentas', icone: '🔧' },
  { id: 'Informática', nome: 'Informática', icone: '💻' },
  { id: 'Jardim e Piscina', nome: 'Jardim', icone: '🌿' },
  { id: 'Livros', nome: 'Livros', icone: '📚' },
  { id: 'eBooks', nome: 'eBooks', icone: '📖' },
  { id: 'Moda', nome: 'Moda', icone: '👗' },
  { id: 'Móveis', nome: 'Móveis', icone: '🛋️' },
  { id: 'Papelaria e Escritório', nome: 'Papelaria', icone: '📝' },
  { id: 'Pet Shop', nome: 'Pet', icone: '🐾' },
  { id: 'Video Games', nome: 'Games', icone: '🎮' },
];

const DIAS_SEMANA = [
  { id: 0, nome: 'Dom', completo: 'Domingo' },
  { id: 1, nome: 'Seg', completo: 'Segunda' },
  { id: 2, nome: 'Ter', completo: 'Terça' },
  { id: 3, nome: 'Qua', completo: 'Quarta' },
  { id: 4, nome: 'Qui', completo: 'Quinta' },
  { id: 5, nome: 'Sex', completo: 'Sexta' },
  { id: 6, nome: 'Sáb', completo: 'Sábado' },
];

const MODOS_SELECAO = [
  { id: 'rotativo', nome: 'Rotativo', desc: 'Um por vez, sem repetir' },
  { id: 'aleatorio', nome: 'Aleatório', desc: 'Produto aleatório' },
  { id: 'preco_baixo', nome: 'Menor Preço', desc: 'Mais baratos primeiro' },
  { id: 'mais_recente', nome: 'Mais Recentes', desc: 'Cadastrados recentemente' },
];

export function ProgramacaoEnvioCard() {
  const [loading, setLoading] = useState(false);
  const [programacoes, setProgramacoes] = useState<Programacao[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [novaProgramacao, setNovaProgramacao] = useState(false);

  const [form, setForm] = useState<Partial<Programacao>>({
    nome: 'Nova Programação',
    categorias: [],
    intervalo_minutos: 15,
    horario_inicio: '08:00',
    horario_fim: '22:00',
    dias_semana: [1, 2, 3, 4, 5],
    modo_selecao: 'rotativo',
    enviar_para_todos_grupos: true,
    grupos_ids: [],
    prefixo_mensagem: '🔥 *OFERTA IMPERDÍVEL!*',
    sufixo_mensagem: '💰 Comprando pelo link você ganha *2% de cashback*!',
    incluir_imagem: true,
    incluir_preco: true,
    incluir_link: true,
    usar_ia_criativa: true,
    enviar_tiktok: false,
    tiktok_post_mode: 'draft',
  });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const { data: progs, error: progError } = await supabase
        .from('programacao_envio_afiliado')
        .select('*')
        .order('created_at', { ascending: false });

      if (progError) throw progError;
      setProgramacoes((progs || []) as Programacao[]);

      const { data: grps, error: grpError } = await supabase
        .from('whatsapp_grupos_afiliado')
        .select('id, group_name, group_jid')
        .eq('ativo', true);

      if (grpError) throw grpError;
      setGrupos((grps || []) as Grupo[]);

    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  async function salvarProgramacao() {
    if (!form.nome || form.categorias?.length === 0) {
      toast.error("Nome e pelo menos uma categoria são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const dados = {
        ...form,
        user_id: user.id,
        ativo: false,
        proximo_envio: null
      };

      if (form.id) {
        const { error } = await supabase
          .from('programacao_envio_afiliado')
          .update(dados)
          .eq('id', form.id);
        
        if (error) throw error;
        toast.success("Programação atualizada!");
      } else {
        const { error } = await supabase
          .from('programacao_envio_afiliado')
          .insert(dados);
        
        if (error) throw error;
        toast.success("Programação criada!");
      }

      setNovaProgramacao(false);
      resetForm();
      carregarDados();

    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      nome: 'Nova Programação',
      categorias: [],
      intervalo_minutos: 15,
      horario_inicio: '08:00',
      horario_fim: '22:00',
      dias_semana: [1, 2, 3, 4, 5],
      modo_selecao: 'rotativo',
      enviar_para_todos_grupos: true,
      grupos_ids: [],
      prefixo_mensagem: '🔥 *OFERTA IMPERDÍVEL!*',
      sufixo_mensagem: '💰 Comprando pelo link você ganha *2% de cashback*!',
      incluir_imagem: true,
      incluir_preco: true,
      incluir_link: true,
      usar_ia_criativa: true,
      enviar_tiktok: false,
      tiktok_post_mode: 'draft',
    });
  }

  async function toggleAtivo(prog: Programacao) {
    setLoading(true);
    try {
      const novoStatus = !prog.ativo;
      let proximoEnvio = null;
      if (novoStatus) {
        proximoEnvio = new Date().toISOString();
      }

      const { error } = await supabase
        .from('programacao_envio_afiliado')
        .update({ 
          ativo: novoStatus,
          proximo_envio: proximoEnvio
        })
        .eq('id', prog.id);

      if (error) throw error;

      toast.success(novoStatus ? "Programação ativada!" : "Programação pausada");
      carregarDados();

    } catch (error: any) {
      toast.error(error.message || "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function excluirProgramacao(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta programação?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('programacao_envio_afiliado')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Programação excluída!");
      carregarDados();

    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    } finally {
      setLoading(false);
    }
  }

  function renderFormulario() {
    return (
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {form.id ? 'Editar Programação' : 'Nova Programação'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nome */}
          <div className="space-y-2">
            <Label>Nome da Programação</Label>
            <Input
              value={form.nome || ''}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Casa e Cozinha - Semanal"
            />
          </div>

          {/* Categorias */}
          <div className="space-y-2">
            <Label>Categorias dos Produtos</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_DISPONIVEIS.map((cat) => (
                <Button
                  key={cat.id}
                  variant={form.categorias?.includes(cat.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const atual = form.categorias || [];
                    const novas = atual.includes(cat.id)
                      ? atual.filter(c => c !== cat.id)
                      : [...atual, cat.id];
                    setForm({ ...form, categorias: novas });
                  }}
                >
                  {cat.icone} {cat.nome}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Horário e Intervalo */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input
                type="time"
                value={form.horario_inicio || '08:00'}
                onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input
                type="time"
                value={form.horario_fim || '22:00'}
                onChange={(e) => setForm({ ...form, horario_fim: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Intervalo (min)</Label>
              <Input
                type="number"
                min={5}
                max={120}
                value={form.intervalo_minutos || 15}
                onChange={(e) => setForm({ ...form, intervalo_minutos: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {/* Dias da Semana */}
          <div className="space-y-2">
            <Label>Dias da Semana</Label>
            <div className="flex gap-2">
              {DIAS_SEMANA.map((dia) => (
                <Button
                  key={dia.id}
                  variant={form.dias_semana?.includes(dia.id) ? "default" : "outline"}
                  size="sm"
                  className="w-12"
                  onClick={() => {
                    const atual = form.dias_semana || [];
                    const novos = atual.includes(dia.id)
                      ? atual.filter(d => d !== dia.id)
                      : [...atual, dia.id];
                    setForm({ ...form, dias_semana: novos });
                  }}
                >
                  {dia.nome}
                </Button>
              ))}
            </div>
          </div>

          {/* Modo de Seleção */}
          <div className="space-y-2">
            <Label>Modo de Seleção de Produtos</Label>
            <Select
              value={form.modo_selecao || 'rotativo'}
              onValueChange={(v) => setForm({ ...form, modo_selecao: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODOS_SELECAO.map((modo) => (
                  <SelectItem key={modo.id} value={modo.id}>
                    {modo.nome} - {modo.desc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grupos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">📱 Grupos Destino</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enviar_para_todos_grupos}
                  onCheckedChange={(v) => setForm({ ...form, enviar_para_todos_grupos: v, grupos_ids: v ? [] : form.grupos_ids })}
                />
                <span className="text-sm text-muted-foreground">Todos os grupos ativos</span>
              </div>
            </div>
            
            {form.enviar_para_todos_grupos ? (
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">
                  ✅ Enviando para <strong>todos os {grupos.length} grupos ativos</strong>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Selecione os grupos que receberão os envios ({form.grupos_ids?.length || 0} selecionados):
                </p>
                {grupos.length === 0 ? (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      ⚠️ Nenhum grupo ativo. Vá em "Grupos WhatsApp" para criar ou ativar grupos.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg max-h-48 overflow-y-auto">
                    {grupos.map((grupo) => (
                      <Button
                        key={grupo.id}
                        variant={form.grupos_ids?.includes(grupo.id) ? "default" : "outline"}
                        size="sm"
                        className={form.grupos_ids?.includes(grupo.id) ? "bg-primary" : ""}
                        onClick={() => {
                          const atual = form.grupos_ids || [];
                          const novos = atual.includes(grupo.id)
                            ? atual.filter(g => g !== grupo.id)
                            : [...atual, grupo.id];
                          setForm({ ...form, grupos_ids: novos });
                        }}
                      >
                        {form.grupos_ids?.includes(grupo.id) ? "✓ " : ""}{grupo.group_name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* IA Criativa */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-500/20">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <Label className="text-base font-medium">🤖 IA Criativa</Label>
                  <p className="text-sm text-muted-foreground">
                    Gera posts únicos e criativos automaticamente para cada produto
                  </p>
                </div>
              </div>
              <Switch
                checked={form.usar_ia_criativa ?? true}
                onCheckedChange={(v) => setForm({ ...form, usar_ia_criativa: v })}
              />
            </div>
            {form.usar_ia_criativa && (
              <p className="text-xs text-muted-foreground px-2">
                ✨ Cada mensagem será única, evitando bloqueios do WhatsApp e aumentando engajamento.
              </p>
            )}
          </div>

          {/* TikTok Integration */}
          <div className="space-y-3">
            <div className={`flex items-center justify-between p-4 rounded-lg border ${form.enviar_tiktok ? 'bg-gradient-to-r from-pink-500/10 to-cyan-500/10 border-pink-200 dark:border-pink-800' : 'bg-muted/30 border-border'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${form.enviar_tiktok ? 'bg-gradient-to-r from-pink-500/20 to-cyan-500/20' : 'bg-muted'}`}>
                  <SiTiktok className={`h-5 w-5 ${form.enviar_tiktok ? 'text-pink-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <Label className="text-base font-medium">📱 Enviar para TikTok</Label>
                  <p className="text-sm text-muted-foreground">
                    Posta automaticamente o produto no TikTok
                  </p>
                </div>
              </div>
              <Switch
                checked={form.enviar_tiktok ?? false}
                onCheckedChange={(v) => setForm({ ...form, enviar_tiktok: v })}
              />
            </div>
            {form.enviar_tiktok && (
              <div className="ml-4 space-y-2">
                <Label>Modo de Postagem</Label>
                <Select
                  value={form.tiktok_post_mode || 'draft'}
                  onValueChange={(v) => setForm({ ...form, tiktok_post_mode: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">📝 Rascunho (revisar antes de publicar)</SelectItem>
                    <SelectItem value="direct">🚀 Publicar Direto (automático)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.tiktok_post_mode === 'direct' 
                    ? '⚡ O vídeo será publicado automaticamente no seu TikTok' 
                    : '📋 O vídeo será salvo como rascunho para você revisar'}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Opções de Mensagem */}
          <div className="space-y-4">
            <Label>Opções da Mensagem {form.usar_ia_criativa && <span className="text-xs text-muted-foreground">(usado como fallback)</span>}</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.incluir_imagem}
                  onCheckedChange={(v) => setForm({ ...form, incluir_imagem: !!v })}
                />
                <span className="text-sm">Incluir imagem</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.incluir_preco}
                  onCheckedChange={(v) => setForm({ ...form, incluir_preco: !!v })}
                />
                <span className="text-sm">Incluir preço</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.incluir_link}
                  onCheckedChange={(v) => setForm({ ...form, incluir_link: !!v })}
                />
                <span className="text-sm">Incluir link</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Texto antes do produto</Label>
              <Input
                value={form.prefixo_mensagem || ''}
                onChange={(e) => setForm({ ...form, prefixo_mensagem: e.target.value })}
                placeholder="Ex: 🔥 OFERTA IMPERDÍVEL!"
                disabled={form.usar_ia_criativa}
                className={form.usar_ia_criativa ? "opacity-50" : ""}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Texto depois do produto</Label>
              <Input
                value={form.sufixo_mensagem || ''}
                onChange={(e) => setForm({ ...form, sufixo_mensagem: e.target.value })}
                placeholder="Ex: Comprando pelo link você ganha cashback!"
                disabled={form.usar_ia_criativa}
                className={form.usar_ia_criativa ? "opacity-50" : ""}
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            <Button onClick={salvarProgramacao} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Salvando..." : "Salvar Programação"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setNovaProgramacao(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderProgramacao(prog: Programacao) {
    const isExpanded = expandido === prog.id;
    
    return (
      <Card 
        key={prog.id} 
        className={`transition-all ${prog.ativo ? 'border-green-500/50 bg-green-50/30 dark:bg-green-950/20' : 'border-border'}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${prog.ativo ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                {prog.ativo ? (
                  <Play className="h-4 w-4 text-green-600" />
                ) : (
                  <Pause className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">{prog.nome}</CardTitle>
                <CardDescription>
                  {prog.categorias?.map(c => {
                    const cat = CATEGORIAS_DISPONIVEIS.find(x => x.id === c);
                    return cat ? `${cat.icone} ${cat.nome}` : c;
                  }).join(' • ')}
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={prog.ativo ? "default" : "secondary"}>
                {prog.ativo ? "Ativo" : "Pausado"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandido(isExpanded ? null : prog.id)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Resumo */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {prog.horario_inicio} - {prog.horario_fim}
            </div>
            <div className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              A cada {prog.intervalo_minutos} min
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {prog.dias_semana?.map(d => DIAS_SEMANA.find(x => x.id === d)?.nome).join(', ')}
            </div>
            <div className="flex items-center gap-1">
              <Send className="h-4 w-4" />
              {prog.total_enviados_hoje || 0} hoje
            </div>
          </div>

          {/* Próximo envio - SEMPRE VISÍVEL */}
          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Próximo envio:
                </span>
              </div>
              {prog.ativo && prog.proximo_envio ? (
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {new Date(prog.proximo_envio).toLocaleTimeString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  <span className="text-sm font-normal ml-2 text-blue-500">
                    ({new Date(prog.proximo_envio).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit',
                      month: '2-digit',
                    })})
                  </span>
                  <span className="text-xs font-normal ml-2 text-muted-foreground">BRT</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  {prog.ativo ? 'Calculando...' : 'Pausado'}
                </span>
              )}
            </div>
          </div>

          {/* Grupos e TikTok */}
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-sm">
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                📱 {prog.enviar_para_todos_grupos ? `Todos os grupos` : `${prog.grupos_ids?.length || 0} grupos`}
              </span>
            </div>
            {prog.enviar_tiktok && (
              <div className="p-2 bg-gradient-to-r from-pink-50 to-cyan-50 dark:from-pink-950/30 dark:to-cyan-950/30 rounded-lg text-sm flex items-center gap-1">
                <SiTiktok className="h-3 w-3 text-pink-500" />
                <span className="text-pink-600 dark:text-pink-400 font-medium">
                  TikTok ({prog.tiktok_post_mode === 'direct' ? 'Direto' : 'Rascunho'})
                </span>
              </div>
            )}
          </div>

          {/* Expandido */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{prog.total_enviados || 0}</div>
                  <div className="text-xs text-muted-foreground">Total enviados</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{prog.total_enviados_hoje || 0}</div>
                  <div className="text-xs text-muted-foreground">Enviados hoje</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.floor(((22 - 8) * 60) / prog.intervalo_minutos)}
                  </div>
                  <div className="text-xs text-muted-foreground">Máximo/dia</div>
                </div>
              </div>

              {/* Último envio */}
              {prog.ultimo_envio && (
                <div className="text-sm text-muted-foreground">
                  Último envio: {new Date(prog.ultimo_envio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} BRT
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={prog.ativo ? "destructive" : "default"}
                  size="sm"
                  onClick={() => toggleAtivo(prog)}
                  disabled={loading}
                >
                  {prog.ativo ? (
                    <>
                      <Pause className="h-4 w-4 mr-1" /> Pausar
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" /> Ativar
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/executar-envio-programado`, {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
                        },
                        body: JSON.stringify({ programacaoId: prog.id })
                      });
                      const data = await response.json();
                      if (data.success && data.sent > 0) {
                        toast.success(`✅ Enviado para ${data.sent} grupo(s)!`);
                        carregarDados();
                      } else if (data.success) {
                        toast.info("Nenhum envio realizado (verifique horário/dia)");
                      } else {
                        toast.error(data.error || "Erro ao enviar");
                      }
                    } catch (error: any) {
                      toast.error(error.message || "Erro ao executar");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  <Send className="h-4 w-4 mr-1" /> Testar Agora
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm(prog as Partial<Programacao>);
                    setNovaProgramacao(true);
                  }}
                >
                  <Settings className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => excluirProgramacao(prog.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Envio Programado
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure envios automáticos para seus grupos
          </p>
        </div>
        
        {!novaProgramacao && (
          <Button onClick={() => setNovaProgramacao(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Programação
          </Button>
        )}
      </div>

      {/* Formulário */}
      {novaProgramacao && renderFormulario()}

      {/* Lista de Programações */}
      {!novaProgramacao && (
        <div className="space-y-3">
          {programacoes.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Nenhuma programação</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie uma programação para enviar produtos automaticamente
              </p>
              <Button onClick={() => setNovaProgramacao(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Programação
              </Button>
            </Card>
          ) : (
            programacoes.map(prog => renderProgramacao(prog))
          )}
        </div>
      )}

      {/* Refresh */}
      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={carregarDados} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    </div>
  );
}

export default ProgramacaoEnvioCard;
