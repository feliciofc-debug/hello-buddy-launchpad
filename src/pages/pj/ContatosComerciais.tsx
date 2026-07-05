import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  Briefcase,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  Mail,
  Building2,
  ArrowLeft,
  Bot,
} from "lucide-react";

interface ContatoComercial {
  id: string;
  nome: string;
  empresa: string | null;
  cargo: string | null;
  whatsapp: string;
  email: string | null;
  tipo_relacionamento: string;
  contexto: string | null;
  proximos_passos: string | null;
  tags: string[] | null;
  ultima_interacao: string | null;
  permite_jarvis_contatar: boolean;
  ativo: boolean;
  created_at: string;
}

const TIPOS = [
  { value: "cliente", label: "Cliente" },
  { value: "parceiro", label: "Parceiro" },
  { value: "prospect", label: "Prospect" },
  { value: "investidor", label: "Investidor" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "outro", label: "Outro" },
];

const emptyForm = {
  nome: "",
  empresa: "",
  cargo: "",
  whatsapp: "",
  email: "",
  tipo_relacionamento: "cliente",
  contexto: "",
  proximos_passos: "",
  tags: "",
  permite_jarvis_contatar: true,
};

export default function ContatosComerciais() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [contatos, setContatos] = useState<ContatoComercial[]>([]);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContatoComercial | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/login");
        return;
      }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, []);

  const load = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contatos_comerciais")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar contatos");
      console.error(error);
    } else {
      setContatos((data as ContatoComercial[]) || []);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: ContatoComercial) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      empresa: c.empresa || "",
      cargo: c.cargo || "",
      whatsapp: c.whatsapp,
      email: c.email || "",
      tipo_relacionamento: c.tipo_relacionamento,
      contexto: c.contexto || "",
      proximos_passos: c.proximos_passos || "",
      tags: (c.tags || []).join(", "),
      permite_jarvis_contatar: c.permite_jarvis_contatar,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!userId) return;
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.whatsapp.trim()) {
      toast.error("WhatsApp é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      nome: form.nome.trim(),
      empresa: form.empresa.trim() || null,
      cargo: form.cargo.trim() || null,
      whatsapp: form.whatsapp.replace(/\D/g, ""),
      email: form.email.trim() || null,
      tipo_relacionamento: form.tipo_relacionamento,
      contexto: form.contexto.trim() || null,
      proximos_passos: form.proximos_passos.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      permite_jarvis_contatar: form.permite_jarvis_contatar,
    };
    const { error } = editing
      ? await supabase.from("contatos_comerciais").update(payload).eq("id", editing.id)
      : await supabase.from("contatos_comerciais").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(editing ? "Contato atualizado" : "Contato cadastrado");
    setModalOpen(false);
    load(userId);
  };

  const remove = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("contatos_comerciais").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Contato removido");
    load(userId);
  };

  const filtered = contatos.filter((c) => {
    if (filtroTipo !== "todos" && c.tipo_relacionamento !== filtroTipo) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.nome.toLowerCase().includes(s) ||
      (c.empresa || "").toLowerCase().includes(s) ||
      c.whatsapp.includes(s) ||
      (c.email || "").toLowerCase().includes(s)
    );
  });

  const tipoColor = (t: string) =>
    ({
      cliente: "bg-blue-100 text-blue-800",
      parceiro: "bg-purple-100 text-purple-800",
      prospect: "bg-amber-100 text-amber-800",
      investidor: "bg-emerald-100 text-emerald-800",
      fornecedor: "bg-slate-100 text-slate-800",
      outro: "bg-gray-100 text-gray-800",
    } as Record<string, string>)[t] || "bg-gray-100 text-gray-800";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Contatos Comerciais
          </h1>
          <p className="text-sm text-muted-foreground">
            Clientes, parceiros e contatos próximos — o Jarvis pode acionar sob sua ordem
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo Contato
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa, WhatsApp ou email..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filtered.length} contato{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {contatos.length === 0
                  ? "Nenhum contato comercial cadastrado ainda."
                  : "Nenhum contato encontrado com esse filtro."}
              </p>
              {contatos.length === 0 && (
                <Button onClick={openNew} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar primeiro contato
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4 border rounded-lg hover:bg-muted/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold">{c.nome}</h3>
                      <Badge className={`${tipoColor(c.tipo_relacionamento)} border-0 text-xs capitalize`}>
                        {c.tipo_relacionamento}
                      </Badge>
                      {c.permite_jarvis_contatar && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Bot className="h-3 w-3" /> Jarvis autorizado
                        </Badge>
                      )}
                    </div>
                    {(c.empresa || c.cargo) && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {[c.cargo, c.empresa].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.whatsapp}
                      </span>
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {c.email}
                        </span>
                      )}
                    </div>
                    {c.contexto && (
                      <p className="text-sm mt-2 text-foreground/80 line-clamp-2">{c.contexto}</p>
                    )}
                    {c.proximos_passos && (
                      <p className="text-xs mt-1 text-primary">
                        <strong>Próximos passos:</strong> {c.proximos_passos}
                      </p>
                    )}
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.tags.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir contato</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir <strong>{c.nome}</strong>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove(c.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar contato" : "Novo contato comercial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Marcelo Silva"
                />
              </div>
              <div>
                <Label>Tipo de relacionamento *</Label>
                <Select
                  value={form.tipo_relacionamento}
                  onValueChange={(v) => setForm({ ...form, tipo_relacionamento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa</Label>
                <Input
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  placeholder="Ex: Ademicon"
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  placeholder="Ex: Diretor Comercial"
                />
              </div>
              <div>
                <Label>WhatsApp *</Label>
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="Ex: 5562999999999"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="marcelo@ademicon.com.br"
                />
              </div>
            </div>

            <div>
              <Label>Contexto do relacionamento</Label>
              <Textarea
                value={form.contexto}
                onChange={(e) => setForm({ ...form, contexto: e.target.value })}
                placeholder="Ex: Parceiro há 2 anos, tocamos projeto de blindagem juntos, sempre topa novas ideias..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                O Jarvis usa esse contexto para conversar de forma humanizada com o contato.
              </p>
            </div>

            <div>
              <Label>Próximos passos</Label>
              <Textarea
                value={form.proximos_passos}
                onChange={(e) => setForm({ ...form, proximos_passos: e.target.value })}
                placeholder="Ex: Enviar proposta revisada até sexta, agendar call quinta 10h"
                rows={2}
              />
            </div>

            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Ex: vip, decisor, follow-up mensal"
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label className="flex items-center gap-2">
                  <Bot className="h-4 w-4" /> Jarvis pode contatar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se desligado, o Jarvis nunca liga/envia mensagem para esse contato.
                </p>
              </div>
              <Switch
                checked={form.permite_jarvis_contatar}
                onCheckedChange={(v) => setForm({ ...form, permite_jarvis_contatar: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
