import { useState, useEffect } from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Home, 
  Users, 
  Building2, 
  Instagram, 
  Linkedin, 
  MapPin, 
  Search, 
  UserCheck, 
  Loader2,
  ExternalLink,
  CheckCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Square,
  Clock,
  DollarSign,
  XCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Estados brasileiros
const ESTADOS = [
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "CE", nome: "Ceará" },
];

// Bairros por cidade/estado
const BAIRROS_RJ: Record<string, string[]> = {
  "Rio de Janeiro": [
    "Barra da Tijuca", "Copacabana", "Ipanema", "Leblon", "Botafogo", 
    "Flamengo", "Recreio", "Jacarepaguá", "Tijuca", "Vila Isabel",
    "Grajaú", "Méier", "Madureira", "Ilha do Governador", "Centro"
  ]
};

interface Corretora {
  id: string;
  nome: string;
  instagram_username?: string;
  instagram_url?: string;
  seguidores_count?: number;
  endereco?: string;
  tem_instagram: boolean;
  selecionada: boolean;
}

interface Seguidor {
  id: string;
  instagram_username: string;
  instagram_url?: string;
  nome_completo?: string;
  foto_url?: string;
  bio?: string;
  seguidores: number;
  cidade_detectada?: string;
  estado_detectado?: string;
  seguindo_imobiliaria?: string;
  imobiliaria_url?: string;
  linkedin_url?: string;
  linkedin_encontrado: boolean;
  cargo?: string;
  empresa?: string;
  score_total: number;
  qualificacao: string;
  status: string;
  contatado: boolean;
  buscando_linkedin?: boolean;
}

interface ProgressoEtapa2 {
  atual: number;
  total: number;
  corretoraAtual: string;
  seguidoresEncontrados: number;
  corretorasProcessadas: { nome: string; seguidores: number; sucesso: boolean }[];
}

export default function SeguidoresConcorrentes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"automatico" | "manual">("automatico");
  
  // Estados do fluxo de 3 etapas
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [corretoras, setCorretoras] = useState<Corretora[]>([]);
  const [seguidores, setSeguidores] = useState<Seguidor[]>([]);
  const [seguidoresFiltrados, setSeguidoresFiltrados] = useState<Seguidor[]>([]);
  
  // Loading states
  const [buscandoCorretoras, setBuscandoCorretoras] = useState(false);
  const [buscandoSeguidores, setBuscandoSeguidores] = useState(false);
  const [progresso, setProgresso] = useState<ProgressoEtapa2>({
    atual: 0,
    total: 0,
    corretoraAtual: '',
    seguidoresEncontrados: 0,
    corretorasProcessadas: []
  });
  
  // Modo automático
  const [estadoSelecionado, setEstadoSelecionado] = useState("RJ");
  const [cidadeSelecionada, setCidadeSelecionada] = useState("Rio de Janeiro");
  const [bairrosSelecionados, setBairrosSelecionados] = useState<string[]>([]);
  const [maxSeguidores, setMaxSeguidores] = useState("300");
  
  // Modo manual
  const [perfisManual, setPerfisManual] = useState("");
  
  // Etapa 3
  const [modoEnriquecimento, setModoEnriquecimento] = useState<"sob_demanda" | "todos">("sob_demanda");

  useEffect(() => {
    carregarSeguidoresSalvos();
  }, []);

  const carregarSeguidoresSalvos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('seguidores_concorrentes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        const mapped = data.map(s => ({
          ...s,
          linkedin_encontrado: s.linkedin_encontrado || false,
          score_total: s.score_total || 0,
          qualificacao: s.qualificacao || 'NOVO',
          status: s.status || 'novo',
          contatado: s.contatado || false
        }));
        setSeguidores(mapped);
        setSeguidoresFiltrados(mapped);
        setEtapaAtual(3); // Mostrar resultados se já tiver dados
      }
    } catch (error) {
      console.error('Erro ao carregar seguidores:', error);
    }
  };

  const toggleBairro = (bairro: string) => {
    if (bairrosSelecionados.includes(bairro)) {
      setBairrosSelecionados(bairrosSelecionados.filter(b => b !== bairro));
    } else {
      setBairrosSelecionados([...bairrosSelecionados, bairro]);
    }
  };

  const toggleCorretora = (id: string) => {
    setCorretoras(prev => prev.map(c => 
      c.id === id ? { ...c, selecionada: !c.selecionada } : c
    ));
  };

  const selecionarTodas = () => {
    setCorretoras(prev => prev.map(c => ({ ...c, selecionada: c.tem_instagram })));
  };

  const limparSelecao = () => {
    setCorretoras(prev => prev.map(c => ({ ...c, selecionada: false })));
  };

  // ETAPA 1: Buscar Corretoras
  const buscarCorretoras = async () => {
    setBuscandoCorretoras(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      console.log('🏢 Buscando corretoras...', { bairros: bairrosSelecionados, cidade: cidadeSelecionada, estado: estadoSelecionado });

      const { data, error } = await supabase.functions.invoke('buscar-seguidores-concorrentes', {
        body: {
          acao: 'buscar_corretoras',
          estado: estadoSelecionado,
          cidade: cidadeSelecionada,
          bairros: bairrosSelecionados
        },
        headers: { 'x-user-id': user.id }
      });

      if (error) throw error;

      console.log('✅ Corretoras encontradas:', data);

      if (data?.corretoras && data.corretoras.length > 0) {
        setCorretoras(data.corretoras.map((c: any, i: number) => ({
          id: `corr-${i}`,
          nome: c.nome,
          instagram_username: c.instagram_username,
          instagram_url: c.instagram_url,
          seguidores_count: c.seguidores_count,
          endereco: c.endereco,
          tem_instagram: !!c.instagram_username,
          selecionada: !!c.instagram_username
        })));
        toast.success(`${data.corretoras.length} corretoras encontradas!`);
      } else {
        toast.info("Nenhuma corretora encontrada. Tente outros bairros.");
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      toast.error(error.message || "Erro ao buscar corretoras");
    } finally {
      setBuscandoCorretoras(false);
    }
  };

  // ETAPA 2: Buscar Seguidores
  const buscarSeguidoresCorretoras = async () => {
    const selecionadas = corretoras.filter(c => c.selecionada && c.tem_instagram);
    if (selecionadas.length === 0) {
      toast.error("Selecione pelo menos uma corretora com Instagram");
      return;
    }

    setBuscandoSeguidores(true);
    setProgresso({
      atual: 0,
      total: selecionadas.length,
      corretoraAtual: '',
      seguidoresEncontrados: 0,
      corretorasProcessadas: []
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      let todosSeguidores: Seguidor[] = [];

      for (let i = 0; i < selecionadas.length; i++) {
        const corretora = selecionadas[i];
        
        setProgresso(prev => ({
          ...prev,
          atual: i + 1,
          corretoraAtual: corretora.nome
        }));

        console.log(`📸 Buscando seguidores de @${corretora.instagram_username}...`);

        try {
          const { data, error } = await supabase.functions.invoke('buscar-seguidores-concorrentes', {
            body: {
              acao: 'buscar_seguidores',
              instagram_username: corretora.instagram_username,
              max_seguidores: parseInt(maxSeguidores),
              imobiliaria_nome: corretora.nome
            },
            headers: { 'x-user-id': user.id }
          });

          if (error) throw error;

          const novosSeguidores = data?.seguidores || [];
          todosSeguidores = [...todosSeguidores, ...novosSeguidores];

          setProgresso(prev => ({
            ...prev,
            seguidoresEncontrados: todosSeguidores.length,
            corretorasProcessadas: [
              ...prev.corretorasProcessadas,
              { nome: corretora.nome, seguidores: novosSeguidores.length, sucesso: true }
            ]
          }));
        } catch (err) {
          console.error(`❌ Erro ao buscar @${corretora.instagram_username}:`, err);
          setProgresso(prev => ({
            ...prev,
            corretorasProcessadas: [
              ...prev.corretorasProcessadas,
              { nome: corretora.nome, seguidores: 0, sucesso: false }
            ]
          }));
        }
      }

      // Filtrar por localização
      const filtrados = todosSeguidores.filter(s => 
        s.cidade_detectada || s.bio?.toLowerCase().includes('rio') || s.bio?.toLowerCase().includes('rj')
      );

      setSeguidores(todosSeguidores);
      setSeguidoresFiltrados(filtrados.length > 0 ? filtrados : todosSeguidores);
      
      toast.success(`${todosSeguidores.length} seguidores encontrados!`);
      setEtapaAtual(3);
    } catch (error: any) {
      console.error('❌ Erro geral:', error);
      toast.error(error.message || "Erro ao buscar seguidores");
    } finally {
      setBuscandoSeguidores(false);
    }
  };

  // Modo Manual - direto para etapa 2
  const buscarSeguidoresManual = async () => {
    const perfis = perfisManual.split("\n").map(p => p.trim().replace("@", "")).filter(Boolean);
    if (perfis.length === 0) {
      toast.error("Insira pelo menos um perfil");
      return;
    }

    // Converter para corretoras e ir para etapa 2
    setCorretoras(perfis.map((p, i) => ({
      id: `manual-${i}`,
      nome: `@${p}`,
      instagram_username: p,
      tem_instagram: true,
      selecionada: true
    })));
    
    setEtapaAtual(2);
  };

  const marcarContatado = async (id: string) => {
    try {
      const { error } = await supabase
        .from('seguidores_concorrentes')
        .update({ contatado: true, status: 'contatado' })
        .eq('id', id);

      if (error) throw error;
      
      setSeguidoresFiltrados(prev => prev.map(s => 
        s.id === id ? { ...s, contatado: true, status: 'contatado' } : s
      ));
      toast.success("Marcado como contatado!");
    } catch (error) {
      toast.error("Erro ao atualizar");
    }
  };

  const buscarLinkedInLead = async (seguidorId: string) => {
    setSeguidoresFiltrados(prev => prev.map(s => 
      s.id === seguidorId ? { ...s, buscando_linkedin: true } : s
    ));

    try {
      const seguidor = seguidoresFiltrados.find(s => s.id === seguidorId);
      if (!seguidor) return;

      const { data, error } = await supabase.functions.invoke('buscar-seguidores-concorrentes', {
        body: {
          acao: 'buscar_linkedin',
          nome: seguidor.nome_completo,
          cidade: seguidor.cidade_detectada || cidadeSelecionada,
          estado: seguidor.estado_detectado || estadoSelecionado
        }
      });

      if (error) throw error;

      if (data?.linkedin_url) {
        await supabase
          .from('seguidores_concorrentes')
          .update({ 
            linkedin_url: data.linkedin_url,
            linkedin_encontrado: true,
            cargo: data.cargo,
            empresa: data.empresa
          })
          .eq('id', seguidorId);

        setSeguidoresFiltrados(prev => prev.map(s => 
          s.id === seguidorId ? { 
            ...s, 
            linkedin_url: data.linkedin_url,
            linkedin_encontrado: true,
            cargo: data.cargo,
            empresa: data.empresa,
            buscando_linkedin: false
          } : s
        ));
        toast.success("LinkedIn encontrado!");
      } else {
        toast.info("LinkedIn não encontrado");
        setSeguidoresFiltrados(prev => prev.map(s => 
          s.id === seguidorId ? { ...s, buscando_linkedin: false } : s
        ));
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error("Erro ao buscar LinkedIn");
      setSeguidoresFiltrados(prev => prev.map(s => 
        s.id === seguidorId ? { ...s, buscando_linkedin: false } : s
      ));
    }
  };

  const bairros = BAIRROS_RJ[cidadeSelecionada] || [];
  const corretorasSelecionadas = corretoras.filter(c => c.selecionada);
  const corretorasComInstagram = corretoras.filter(c => c.tem_instagram);

  // Renderização das etapas
  const renderEtapa1 = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10">Etapa 1</Badge>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Buscar Corretoras com Instagram
          </CardTitle>
        </div>
        <CardDescription>
          Primeiro, vamos encontrar corretoras da região que têm Instagram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="automatico" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Modo Automático
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Modo Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="automatico" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Estado</label>
                <Select value={estadoSelecionado} onValueChange={setEstadoSelecionado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map(e => (
                      <SelectItem key={e.sigla} value={e.sigla}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cidade</label>
                <Select value={cidadeSelecionada} onValueChange={setCidadeSelecionada}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rio de Janeiro">Rio de Janeiro</SelectItem>
                    <SelectItem value="São Paulo">São Paulo</SelectItem>
                    <SelectItem value="Belo Horizonte">Belo Horizonte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bairros/Regiões (clique para selecionar)</label>
              <div className="flex flex-wrap gap-2">
                {bairros.map(bairro => (
                  <Badge
                    key={bairro}
                    variant={bairrosSelecionados.includes(bairro) ? "default" : "outline"}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => toggleBairro(bairro)}
                  >
                    {bairro}
                  </Badge>
                ))}
              </div>
              {bairrosSelecionados.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {bairrosSelecionados.length} bairro(s) selecionado(s)
                </p>
              )}
            </div>

            <Button 
              onClick={buscarCorretoras} 
              disabled={buscandoCorretoras || bairrosSelecionados.length === 0}
              className="w-full"
            >
              {buscandoCorretoras ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando corretoras...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Buscar Corretoras
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Perfis Instagram (um por linha)</label>
              <Textarea
                placeholder={`@imobiliariabarra\n@peninsulacorretora\n@quintoandar\n@lopes_imoveis`}
                value={perfisManual}
                onChange={(e) => setPerfisManual(e.target.value)}
                rows={6}
              />
            </div>

            <Button 
              onClick={buscarSeguidoresManual} 
              disabled={!perfisManual.trim()}
              className="w-full"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Próxima Etapa
            </Button>
          </TabsContent>
        </Tabs>

        {/* Lista de Corretoras Encontradas */}
        {corretoras.length > 0 && (
          <div className="space-y-4 mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                {corretoras.length} Corretoras Encontradas
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selecionarTodas}>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Selecionar Todas
                </Button>
                <Button variant="outline" size="sm" onClick={limparSelecao}>
                  <Square className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {corretoras.map(corretora => (
                <div 
                  key={corretora.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    corretora.selecionada ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  } ${!corretora.tem_instagram ? 'opacity-50' : ''}`}
                  onClick={() => corretora.tem_instagram && toggleCorretora(corretora.id)}
                >
                  <Checkbox 
                    checked={corretora.selecionada} 
                    disabled={!corretora.tem_instagram}
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {corretora.tem_instagram ? (
                        <Instagram className="h-4 w-4 text-pink-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{corretora.nome}</span>
                    </div>
                    {corretora.instagram_username && (
                      <p className="text-sm text-muted-foreground">
                        @{corretora.instagram_username}
                        {corretora.seguidores_count && ` (${(corretora.seguidores_count / 1000).toFixed(1)}k seguidores)`}
                      </p>
                    )}
                    {corretora.endereco && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {corretora.endereco}
                      </p>
                    )}
                    {!corretora.tem_instagram && (
                      <p className="text-xs text-red-400">Sem Instagram</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {corretorasSelecionadas.length} de {corretorasComInstagram.length} corretoras selecionadas
              </p>
              <Button 
                onClick={() => setEtapaAtual(2)}
                disabled={corretorasSelecionadas.length === 0}
              >
                Próxima Etapa: Buscar Seguidores
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderEtapa2 = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10">Etapa 2</Badge>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-500" />
            Buscar Seguidores
          </CardTitle>
        </div>
        <CardDescription>
          Vamos buscar os seguidores das corretoras selecionadas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!buscandoSeguidores ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Corretoras selecionadas</p>
                <p className="text-2xl font-bold">{corretorasSelecionadas.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Max seguidores/perfil</p>
                <Select value={maxSeguidores} onValueChange={setMaxSeguidores}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="300">300</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 space-y-2">
              <p className="font-medium">📊 Estimativa:</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>~{corretorasSelecionadas.length * parseInt(maxSeguidores)} seguidores</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span>~{Math.ceil(corretorasSelecionadas.length * 0.5)} minutos</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span>~${(corretorasSelecionadas.length * 2).toFixed(0)} Apify</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEtapaAtual(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={buscarSeguidoresCorretoras} className="flex-1">
                <Instagram className="h-4 w-4 mr-2" />
                Buscar Seguidores
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="font-medium">Buscando seguidores...</p>
              <p className="text-sm text-muted-foreground">
                Processando: {progresso.corretoraAtual}
              </p>
            </div>

            <Progress value={(progresso.atual / progresso.total) * 100} />

            <div className="text-center text-sm">
              <span className="font-medium">{progresso.atual}</span>
              <span className="text-muted-foreground">/{progresso.total} corretoras</span>
              <span className="mx-3">|</span>
              <span className="font-medium">{progresso.seguidoresEncontrados}</span>
              <span className="text-muted-foreground"> seguidores encontrados</span>
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto">
              {progresso.corretorasProcessadas.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {c.sucesso ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>{c.nome}</span>
                  <span className="text-muted-foreground">- {c.seguidores} seguidores</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderEtapa3 = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10">Etapa 3</Badge>
          <CardTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-blue-500" />
            Leads Qualificados
          </CardTitle>
        </div>
        <CardDescription>
          {seguidoresFiltrados.length} seguidores encontrados. Enriqueça com LinkedIn sob demanda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => {
            setEtapaAtual(1);
            setCorretoras([]);
            setSeguidores([]);
            setSeguidoresFiltrados([]);
          }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Nova Busca
          </Button>
          
          <div className="flex gap-2">
            <Badge variant="secondary">{seguidoresFiltrados.length} leads</Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-500">
              {seguidoresFiltrados.filter(s => s.linkedin_encontrado).length} com LinkedIn
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {seguidoresFiltrados.map(seguidor => (
            <div 
              key={seguidor.id}
              className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={seguidor.foto_url} />
                <AvatarFallback>
                  {seguidor.nome_completo?.charAt(0) || seguidor.instagram_username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{seguidor.nome_completo || seguidor.instagram_username}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Instagram className="h-3 w-3" />
                      @{seguidor.instagram_username}
                      {seguidor.seguidores > 0 && (
                        <span className="ml-2">({(seguidor.seguidores / 1000).toFixed(1)}k)</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {seguidor.contatado && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Contatado
                      </Badge>
                    )}
                  </div>
                </div>

                {seguidor.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    💬 {seguidor.bio}
                  </p>
                )}

                {(seguidor.cidade_detectada || seguidor.estado_detectado) && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[seguidor.cidade_detectada, seguidor.estado_detectado].filter(Boolean).join(', ')}
                  </p>
                )}

                {seguidor.seguindo_imobiliaria && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Segue: {seguidor.seguindo_imobiliaria}
                  </p>
                )}

                {seguidor.linkedin_url && (
                  <p className="text-sm flex items-center gap-1 text-blue-500">
                    <Linkedin className="h-3 w-3" />
                    {seguidor.cargo && `${seguidor.cargo} - `}
                    {seguidor.empresa || 'LinkedIn encontrado'}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`https://instagram.com/${seguidor.instagram_username}`, '_blank')}
                  >
                    <Instagram className="h-4 w-4 mr-1" />
                    Instagram
                  </Button>
                  
                  {seguidor.linkedin_url ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(seguidor.linkedin_url, '_blank')}
                    >
                      <Linkedin className="h-4 w-4 mr-1" />
                      LinkedIn
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => buscarLinkedInLead(seguidor.id)}
                      disabled={seguidor.buscando_linkedin}
                    >
                      {seguidor.buscando_linkedin ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-1" />
                      )}
                      Buscar LinkedIn
                    </Button>
                  )}

                  {!seguidor.contatado && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => marcarContatado(seguidor.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Marcar Contatado
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {seguidoresFiltrados.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum seguidor encontrado ainda.</p>
              <p className="text-sm">Complete as etapas anteriores para buscar leads.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>AMZ Imóveis</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate('/dashboard')}>
                      <Home className="h-4 w-4" />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate('/imoveis/leads-enriquecidos')}>
                      <Users className="h-4 w-4" />
                      <span>Leads Enriquecidos</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive onClick={() => navigate('/imoveis/seguidores-concorrentes')}>
                      <Instagram className="h-4 w-4" />
                      <span>Seguidores Concorrentes</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2">
              <Instagram className="h-5 w-5 text-pink-500" />
              <h1 className="text-lg font-semibold">Seguidores de Concorrentes</h1>
            </div>
            
            {/* Indicador de Etapas */}
            <div className="ml-auto flex items-center gap-2">
              {[1, 2, 3].map(etapa => (
                <Badge 
                  key={etapa}
                  variant={etapaAtual === etapa ? "default" : "outline"}
                  className={`cursor-pointer transition-all ${
                    etapaAtual > etapa ? 'bg-green-500/20 text-green-500 border-green-500' : ''
                  }`}
                  onClick={() => {
                    if (etapa === 1) setEtapaAtual(1);
                    else if (etapa === 2 && corretoras.length > 0) setEtapaAtual(2);
                    else if (etapa === 3 && seguidoresFiltrados.length > 0) setEtapaAtual(3);
                  }}
                >
                  {etapaAtual > etapa ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                  Etapa {etapa}
                </Badge>
              ))}
            </div>
          </header>

          <main className="flex-1 p-6">
            {etapaAtual === 1 && renderEtapa1()}
            {etapaAtual === 2 && renderEtapa2()}
            {etapaAtual === 3 && renderEtapa3()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
