import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, RefreshCw, Shield, BookOpen, Gavel, Search, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface KnowledgeSegment {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface KnowledgeRule {
  id: string;
  segment_id: string;
  ordem: number;
  regra: string;
  motivo: string | null;
  ativa: boolean;
}

interface KnowledgeTopic {
  id: string;
  segment_id: string;
  titulo: string;
  tags: string[];
  conteudo_tecnico: string | null;
  traducao_leve: string;
  exemplo: string | null;
  ativa: boolean;
}

export default function AdminBaseConhecimento() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [segments, setSegments] = useState<KnowledgeSegment[]>([]);
  const [rules, setRules] = useState<KnowledgeRule[]>([]);
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<string>("all");

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Acesso negado", description: "Você precisa estar logado.", variant: "destructive" });
        navigate("/login");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const isAdminByEmail = user.email === "expo@atombrasildigital.com";

      if ((roleError || !roleData) && !isAdminByEmail) {
        toast({ title: "Acesso negado", description: "Você não tem permissão para acessar esta página.", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      await loadData();
    } catch (error) {
      console.error("Erro ao verificar acesso:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: segmentsData, error: segmentsError }, { data: rulesData, error: rulesError }, { data: topicsData, error: topicsError }] = await Promise.all([
        supabase.from("agent_knowledge_segments").select("*").eq("ativo", true).order("nome"),
        supabase.from("agent_knowledge_rules").select("*").eq("ativa", true).order("ordem", { ascending: true }),
        supabase.from("agent_knowledge_topics").select("*").eq("ativa", true).order("titulo", { ascending: true }),
      ]);

      if (segmentsError) throw segmentsError;
      if (rulesError) throw rulesError;
      if (topicsError) throw topicsError;

      setSegments(segmentsData || []);
      setRules(rulesData || []);
      setTopics(topicsData || []);
    } catch (error) {
      console.error("Erro ao carregar base de conhecimento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a base de conhecimento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = useMemo(() => {
    let result = rules;
    if (activeSegment !== "all") {
      result = result.filter((r) => r.segment_id === activeSegment);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.regra.toLowerCase().includes(term) ||
          (r.motivo && r.motivo.toLowerCase().includes(term))
      );
    }
    return result;
  }, [rules, activeSegment, search]);

  const filteredTopics = useMemo(() => {
    let result = topics;
    if (activeSegment !== "all") {
      result = result.filter((t) => t.segment_id === activeSegment);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.titulo.toLowerCase().includes(term) ||
          t.tags.some((tag) => tag.toLowerCase().includes(term)) ||
          t.traducao_leve.toLowerCase().includes(term) ||
          (t.conteudo_tecnico && t.conteudo_tecnico.toLowerCase().includes(term))
      );
    }
    return result;
  }, [topics, activeSegment, search]);

  const activeSegmentName = useMemo(() => {
    if (activeSegment === "all") return "Todos os segmentos";
    return segments.find((s) => s.id === activeSegment)?.nome || activeSegment;
  }, [activeSegment, segments]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando base de conhecimento...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                Base de Conhecimento
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={loadData} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Visão geral
            </CardTitle>
            <CardDescription>
              Visualize as travas de compliance e os tópicos consultáveis por segmento.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Segmentos ativos</p>
              <p className="text-2xl font-bold">{segments.length}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Travas de compliance</p>
              <p className="text-2xl font-bold">{rules.length}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Tópicos de conhecimento</p>
              <p className="text-2xl font-bold">{topics.length}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por palavra-chave, tag ou conteúdo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={activeSegment}
            onChange={(e) => setActiveSegment(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:w-[280px]"
          >
            <option value="all">Todos os segmentos</option>
            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.nome}
              </option>
            ))}
          </select>
        </div>

        <Tabs defaultValue="rules" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="rules" className="gap-2">
              <Gavel className="h-4 w-4" />
              Travas ({filteredRules.length})
            </TabsTrigger>
            <TabsTrigger value="topics" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Tópicos ({filteredTopics.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-6 space-y-4">
            {filteredRules.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Nenhuma trava encontrada para os filtros selecionados.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredRules.map((rule) => (
                  <Card key={rule.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <CardTitle className="text-base leading-relaxed font-semibold">
                            {rule.ordem}. {rule.regra}
                          </CardTitle>
                          <CardDescription>
                            Segmento: {segments.find((s) => s.id === rule.segment_id)?.nome || rule.segment_id}
                          </CardDescription>
                        </div>
                        <Badge variant="destructive" className="shrink-0">Trava</Badge>
                      </div>
                    </CardHeader>
                    {rule.motivo && (
                      <CardContent className="pt-0">
                        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                          <p className="text-sm font-medium text-destructive mb-1">Motivo / Fundamento:</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rule.motivo}</p>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="topics" className="mt-6 space-y-4">
            {filteredTopics.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Nenhum tópico encontrado para os filtros selecionados.</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {filteredTopics.map((topic) => (
                  <AccordionItem key={topic.id} value={topic.id} className="border rounded-lg px-4 bg-card">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex flex-col items-start text-left gap-1 pr-4">
                        <span className="text-base font-semibold">{topic.titulo}</span>
                        <span className="text-xs text-muted-foreground">
                          {segments.find((s) => s.id === topic.segment_id)?.nome || topic.segment_id}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-4">
                      {topic.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {topic.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="gap-1">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Tradução leve (uso no atendimento):</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{topic.traducao_leve}</p>
                      </div>

                      {topic.conteudo_tecnico && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Conteúdo técnico:</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{topic.conteudo_tecnico}</p>
                        </div>
                      )}

                      {topic.exemplo && (
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-sm font-medium mb-1">Exemplo de uso:</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{topic.exemplo}</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
