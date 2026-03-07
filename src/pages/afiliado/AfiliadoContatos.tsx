import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AfiliadoLayout } from "@/components/afiliado/AfiliadoLayout";
import ImportContactsWhatsAppCSVModal from "@/components/ImportContactsWhatsAppCSVModal";
import {
  Contact,
  Upload,
  Search,
  Trash2,
  UserPlus,
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
}

export default function AfiliadoContatos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [totalContatos, setTotalContatos] = useState(0);
  const [leads, setLeads] = useState<LeadCapturado[]>([]);
  const [deletingLead, setDeletingLead] = useState<string | null>(null);

  useEffect(() => {
    loadContatos();
  }, []);

  const loadContatos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const [contatosRes, leadsRes] = await Promise.all([
        supabase.from("cadastros").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("leads_ebooks").select("id, phone, nome, categorias, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      ]);

      setTotalContatos(contatosRes.count || 0);
      setLeads((leadsRes.data || []).map((c: any) => ({
        id: c.id,
        phone: c.phone,
        nome: c.nome,
        categorias: Array.isArray(c.categorias) ? c.categorias : null,
        created_at: c.created_at,
      })));
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLead = async (leadId: string, phone: string) => {
    setDeletingLead(leadId);
    try {
      await Promise.all([
        supabase.from("leads_ebooks").delete().eq("id", leadId),
        supabase.from("afiliado_clientes_ebooks").delete().eq("phone", phone),
        supabase.from("afiliado_user_states").delete().eq("phone", phone),
        supabase.from("afiliado_conversas").delete().eq("phone", phone),
        supabase.from("afiliado_cliente_preferencias").delete().eq("phone", phone),
        supabase.from("afiliado_cashback").delete().eq("phone", phone),
      ]);
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      toast.success("Lead removido");
    } catch (error) {
      toast.error("Erro ao deletar lead");
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
            <p className="text-sm text-muted-foreground">{totalContatos} contatos cadastrados • {leads.length} leads capturados</p>
          </div>
          <Button onClick={() => setShowImportModal(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Leads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-green-500" />
              Leads Capturados ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead encontrado</p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{lead.nome || "Lead"}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                        {lead.categorias && lead.categorias.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lead.categorias.map((cat, idx) => (
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
                              <AlertDialogTitle>Deletar Lead</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja deletar <strong>{lead.nome || lead.phone}</strong>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLead(lead.id, lead.phone)} className="bg-destructive hover:bg-destructive/90">
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

      <ImportContactsWhatsAppCSVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadContatos}
      />
    </AfiliadoLayout>
  );
}
