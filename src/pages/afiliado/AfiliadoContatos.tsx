import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AfiliadoLayout } from "@/components/afiliado/AfiliadoLayout";
import AfiliadoImportador from "@/components/afiliado/AfiliadoImportador";
import {
  Upload,
  Download,
  Search,
  Trash2,
  UserPlus,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LeadCapturado {
  id: string;
  phone: string;
  nome: string | null;
  categorias: string[] | null;
  created_at: string;
  tipo: "lead" | "cadastro";
  origem?: string | null;
}

export default function AfiliadoContatos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showImportador, setShowImportador] = useState(false);
  const [leads, setLeads] = useState<LeadCapturado[]>([]);
  const [deletingLead, setDeletingLead] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth session to be fully restored before querying
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/login");
        return;
      }
      setUserId(session.user.id);
      loadContatos(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        navigate("/login");
        return;
      }
      if (session.user.id !== userId) {
        setUserId(session.user.id);
        loadContatos(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadContatos = async (uid?: string) => {
    const currentUserId = uid || userId;
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      const { data: cadastrosData, error } = await supabase
        .from("cadastros")
        .select("id, nome, whatsapp, origem, tags, created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        console.error("Erro ao buscar contatos:", error);
        toast.error("Erro ao carregar contatos");
        return;
      }

      console.log(`[AfiliadoContatos] Carregados ${cadastrosData?.length || 0} contatos para user ${currentUserId}`);

      setLeads((cadastrosData || []).map((c: any) => ({
        id: c.id,
        phone: c.whatsapp,
        nome: c.nome,
        categorias: Array.isArray(c.tags) ? c.tags : null,
        created_at: c.created_at,
        tipo: "cadastro" as const,
        origem: c.origem,
      })));
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar contatos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLead = async (lead: LeadCapturado) => {
    setDeletingLead(lead.id);
    try {
      await supabase.from("cadastros").delete().eq("id", lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      toast.success("Contato removido");
    } catch (error) {
      toast.error("Erro ao deletar contato");
    } finally {
      setDeletingLead(null);
    }
  };

  const filtered = leads.filter(
    (l) =>
      !search ||
      l.phone.includes(search) ||
      l.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const totalContatos = leads.length;

  if (loading) {
    return (
      <AfiliadoLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AfiliadoLayout>
    );
  }

  return (
    <AfiliadoLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
            <p className="text-sm text-muted-foreground">
              {totalContatos} contatos cadastrados
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!userId) return;
                toast.info("Gerando CSV...");
                try {
                  const { data, error } = await supabase.functions.invoke("exportar-contatos-csv", {
                    body: { user_id: userId, tabela: "cadastros" },
                  });
                  if (error) throw error;
                  const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "contatos-export.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("CSV baixado com sucesso!");
                } catch (e: any) {
                  console.error(e);
                  toast.error("Erro ao exportar CSV");
                }
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={() => setShowImportador(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Importar Contatos
            </Button>
          </div>

        {showImportador && (
          <AfiliadoImportador
            onSuccess={() => loadContatos(userId || undefined)}
            onClose={() => setShowImportador(false)}
          />
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Todos os Contatos ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum contato encontrado</p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{lead.nome || "Contato"}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                        {lead.origem && (
                          <p className="text-xs text-muted-foreground">{lead.origem}</p>
                        )}
                        {lead.categorias && lead.categorias.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lead.categorias.slice(0, 3).map((cat, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs capitalize">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={deletingLead === lead.id}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar Contato</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja deletar <strong>{lead.nome || lead.phone}</strong>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLead(lead)} className="bg-destructive hover:bg-destructive/90">
                                Deletar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AfiliadoLayout>
  );
}
