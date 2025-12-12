import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Trash2, AlertTriangle, CheckCircle, Clock, ArrowLeft, RefreshCw, Upload, Package, Users, ListChecks, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface DeletionRequest {
  id: string;
  email: string;
  user_id: string | null;
  reason: string | null;
  status: string;
  requested_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface SecurityReport {
  id: string;
  reporter_name: string | null;
  reporter_email: string;
  vulnerability_type: string;
  description: string;
  steps_to_reproduce: string | null;
  severity: string;
  status: string;
  disclosed_publicly: boolean;
  created_at: string;
  resolved_at: string | null;
  notes: string | null;
}

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [securityReports, setSecurityReports] = useState<SecurityReport[]>([]);
  const [selectedDeletion, setSelectedDeletion] = useState<DeletionRequest | null>(null);
  const [selectedSecurity, setSelectedSecurity] = useState<SecurityReport | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Acesso negado",
          description: "Você precisa estar logado para acessar esta página.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleData) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta página.",
          variant: "destructive",
        });
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
    await Promise.all([loadDeletionRequests(), loadSecurityReports()]);
  };

  const loadDeletionRequests = async () => {
    const { data, error } = await supabase
      .from("deletion_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar solicitações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as solicitações de exclusão.",
        variant: "destructive",
      });
      return;
    }

    setDeletionRequests(data || []);
  };

  const loadSecurityReports = async () => {
    const { data, error } = await supabase
      .from("security_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar relatórios:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os relatórios de segurança.",
        variant: "destructive",
      });
      return;
    }

    setSecurityReports(data || []);
  };

  const updateDeletionStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("deletion_requests")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Status atualizado com sucesso!",
    });

    await loadDeletionRequests();
    setSelectedDeletion(null);
  };

  const updateSecurityStatus = async (id: string, status: string, notes?: string) => {
    const updates: any = { status };
    if (notes) updates.notes = notes;
    if (status === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("security_reports")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o relatório.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Relatório atualizado com sucesso!",
    });

    await loadSecurityReports();
    setSelectedSecurity(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "outline", label: "Pendente" },
      new: { variant: "outline", label: "Novo" },
      processing: { variant: "secondary", label: "Em análise" },
      in_progress: { variant: "secondary", label: "Em progresso" },
      completed: { variant: "default", label: "Concluído" },
      resolved: { variant: "default", label: "Resolvido" },
      rejected: { variant: "destructive", label: "Rejeitado" },
      invalid: { variant: "destructive", label: "Inválido" },
    };

    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      "Crítica": "bg-red-500 text-white",
      "Alta": "bg-orange-500 text-white",
      "Média": "bg-yellow-500 text-black",
      "Baixa": "bg-green-500 text-white",
    };

    return (
      <Badge className={colors[severity] || "bg-gray-500 text-white"}>
        {severity}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/dashboard")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Painel de Administração
              </h1>
            </div>
            <Button onClick={loadData} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          
          <Card 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate('/admin/importar')}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Importar Base</h3>
                <p className="text-sm text-muted-foreground">Importação em massa</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate('/admin/produtos')}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Package className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">Produtos</h3>
                <p className="text-sm text-muted-foreground">Gerenciar produtos</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate('/vendedores')}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <ListChecks className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Vendedores</h3>
                <p className="text-sm text-muted-foreground">Gerenciar equipe</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="deletions" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="deletions" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Exclusão de Dados ({deletionRequests.length})
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Vulnerabilidades ({securityReports.length})
            </TabsTrigger>
          </TabsList>

          {/* Deletion Requests Tab */}
          <TabsContent value="deletions" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {deletionRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{request.email}</CardTitle>
                        <CardDescription>
                          Solicitado em {format(new Date(request.requested_at), "dd/MM/yyyy 'às' HH:mm")}
                        </CardDescription>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {request.reason && (
                      <div>
                        <p className="text-sm font-medium mb-1">Motivo:</p>
                        <p className="text-sm text-muted-foreground">{request.reason}</p>
                      </div>
                    )}
                    {request.error_message && (
                      <div className="p-3 bg-destructive/10 rounded-lg">
                        <p className="text-sm font-medium text-destructive mb-1">Erro:</p>
                        <p className="text-sm text-destructive/80">{request.error_message}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Select
                        value={request.status}
                        onValueChange={(value) => updateDeletionStatus(request.id, value)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="processing">Em processamento</SelectItem>
                          <SelectItem value="completed">Concluído</SelectItem>
                          <SelectItem value="rejected">Rejeitado</SelectItem>
                        </SelectContent>
                      </Select>
                      {request.completed_at && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Concluído em {format(new Date(request.completed_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {deletionRequests.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">Nenhuma solicitação de exclusão encontrada.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Security Reports Tab */}
          <TabsContent value="security" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {securityReports.map((report) => (
                <Card key={report.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{report.vulnerability_type}</CardTitle>
                          {getSeverityBadge(report.severity)}
                        </div>
                        <CardDescription>
                          Reportado em {format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm")}
                          {report.reporter_name && ` por ${report.reporter_name}`}
                        </CardDescription>
                      </div>
                      {getStatusBadge(report.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Email do Reporter:</p>
                      <p className="text-sm text-muted-foreground">{report.reporter_email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Descrição:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.description}</p>
                    </div>
                    {report.steps_to_reproduce && (
                      <div>
                        <p className="text-sm font-medium mb-1">Steps to Reproduce:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.steps_to_reproduce}</p>
                      </div>
                    )}
                    {report.notes && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Notas Internas:</p>
                        <p className="text-sm text-muted-foreground">{report.notes}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Select
                        value={report.status}
                        onValueChange={(value) => updateSecurityStatus(report.id, value)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="in_progress">Em progresso</SelectItem>
                          <SelectItem value="resolved">Resolvido</SelectItem>
                          <SelectItem value="invalid">Inválido</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectedSecurity?.id === report.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Adicionar notas internas..."
                            defaultValue={report.notes || ""}
                            id={`notes-${report.id}`}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                const notes = (document.getElementById(`notes-${report.id}`) as HTMLTextAreaElement)?.value;
                                updateSecurityStatus(report.id, report.status, notes);
                              }}
                            >
                              Salvar Notas
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedSecurity(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSecurity(report)}
                        >
                          Adicionar Notas
                        </Button>
                      )}
                      {report.resolved_at && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                          <CheckCircle className="h-4 w-4" />
                          Resolvido em {format(new Date(report.resolved_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {securityReports.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">Nenhum relatório de segurança encontrado.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
