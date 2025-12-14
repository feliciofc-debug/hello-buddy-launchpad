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
  Sparkles
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
}

export default function SeguidoresConcorrentes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"automatico" | "manual">("automatico");
  const [loading, setLoading] = useState(false);
  const [seguidores, setSeguidores] = useState<Seguidor[]>([]);
  
  // Modo automático
  const [estadoSelecionado, setEstadoSelecionado] = useState("RJ");
  const [cidadeSelecionada, setCidadeSelecionada] = useState("Rio de Janeiro");
  const [bairrosSelecionados, setBairrosSelecionados] = useState<string[]>([]);
  const [maxSeguidores, setMaxSeguidores] = useState("300");
  
  // Modo manual
  const [perfisManual, setPerfisManual] = useState("");

  useEffect(() => {
    carregarSeguidores();
  }, []);

  const carregarSeguidores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('seguidores_concorrentes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSeguidores(data || []);
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

  const buscarSeguidores = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      const payload = activeTab === "automatico" 
        ? {
            modo: "automatico",
            estado: estadoSelecionado,
            cidade: cidadeSelecionada,
            bairros: bairrosSelecionados,
            maxSeguidores: parseInt(maxSeguidores)
          }
        : {
            modo: "manual",
            perfis: perfisManual.split("\n").map(p => p.trim().replace("@", "")).filter(Boolean),
            maxSeguidores: parseInt(maxSeguidores)
          };

      const { data, error } = await supabase.functions.invoke('buscar-seguidores-concorrentes', {
        body: payload,
        headers: { 'x-user-id': user.id }
      });

      if (error) throw error;

      toast.success(`${data?.count || 0} seguidores encontrados!`);
      carregarSeguidores();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || "Erro ao buscar seguidores");
    } finally {
      setLoading(false);
    }
  };

  const marcarContatado = async (id: string) => {
    try {
      const { error } = await supabase
        .from('seguidores_concorrentes')
        .update({ contatado: true, status: 'contatado' })
        .eq('id', id);

      if (error) throw error;
      
      setSeguidores(prev => prev.map(s => 
        s.id === id ? { ...s, contatado: true, status: 'contatado' } : s
      ));
      toast.success("Marcado como contatado!");
    } catch (error) {
      toast.error("Erro ao atualizar");
    }
  };

  const bairros = BAIRROS_RJ[cidadeSelecionada] || [];

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
          </header>

          <main className="flex-1 p-6 space-y-6">
            {/* Tabs de modo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Buscar Seguidores
                </CardTitle>
                <CardDescription>
                  Encontre pessoas que seguem imobiliárias concorrentes no Instagram
                </CardDescription>
              </CardHeader>
              <CardContent>
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max seguidores por perfil</label>
                      <Select value={maxSeguidores} onValueChange={setMaxSeguidores}>
                        <SelectTrigger className="w-40">
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

                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        Como funciona:
                      </p>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Busca corretoras em: {bairrosSelecionados.join(", ") || "selecione bairros"}</li>
                        <li>Pega Instagram das corretoras</li>
                        <li>Busca até {maxSeguidores} seguidores de cada</li>
                        <li>Filtra só quem mora na região</li>
                      </ol>
                    </div>
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max seguidores por perfil</label>
                      <Select value={maxSeguidores} onValueChange={setMaxSeguidores}>
                        <SelectTrigger className="w-40">
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
                  </TabsContent>
                </Tabs>

                <div className="mt-6">
                  <Button 
                    onClick={buscarSeguidores} 
                    disabled={loading || (activeTab === "automatico" && bairrosSelecionados.length === 0)}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Buscando seguidores...
                      </>
                    ) : (
                      <>
                        <Instagram className="h-4 w-4 mr-2" />
                        Buscar Seguidores
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resultados */}
            {seguidores.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {seguidores.length} Seguidores Encontrados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {seguidores.map(seguidor => (
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
                                  <span className="ml-2">({(seguidor.seguidores / 1000).toFixed(1)}k seguidores)</span>
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
                              <Badge variant={
                                seguidor.qualificacao === 'QUENTE' ? 'destructive' : 
                                seguidor.qualificacao === 'MORNO' ? 'default' : 
                                'secondary'
                              }>
                                {seguidor.qualificacao}
                              </Badge>
                            </div>
                          </div>

                          {(seguidor.cidade_detectada || seguidor.cargo) && (
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {seguidor.cidade_detectada && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {seguidor.cidade_detectada}, {seguidor.estado_detectado}
                                </span>
                              )}
                              {seguidor.cargo && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {seguidor.cargo}
                                </span>
                              )}
                            </div>
                          )}

                          {seguidor.seguindo_imobiliaria && (
                            <p className="text-sm text-muted-foreground">
                              🏢 Segue: <span className="text-foreground">@{seguidor.seguindo_imobiliaria}</span>
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`https://instagram.com/${seguidor.instagram_username}`, '_blank')}
                            >
                              <Instagram className="h-4 w-4 mr-1" />
                              Instagram
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>

                            {seguidor.linkedin_url ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(seguidor.linkedin_url!, '_blank')}
                              >
                                <Linkedin className="h-4 w-4 mr-1" />
                                LinkedIn
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled
                              >
                                <Linkedin className="h-4 w-4 mr-1" />
                                Buscar LinkedIn
                              </Button>
                            )}

                            {!seguidor.contatado && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => marcarContatado(seguidor.id)}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Marcar Contatado
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {seguidores.length === 0 && !loading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Instagram className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum seguidor encontrado</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Selecione bairros e clique em "Buscar Seguidores" para encontrar pessoas que seguem imobiliárias concorrentes.
                  </p>
                </CardContent>
              </Card>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
