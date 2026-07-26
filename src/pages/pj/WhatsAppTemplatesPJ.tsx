import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, RefreshCw, Send, Copy, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TemplateFormModal, TemplateFormValue } from "@/components/pj/TemplateFormModal";

interface Template {
  id: string;
  nome_meta: string;
  idioma: string;
  categoria_meta: string;
  tipo_uso: string;
  body_text: string;
  status_meta: string;
  motivo_rejeicao_meta: string | null;
  meta_template_id: string | null;
  header: any;
  botoes: any;
  created_at: string;
}

const statusVariant: Record<string, { label: string; className: string }> = {
  rascunho:  { label: "Rascunho",  className: "bg-slate-200 text-slate-700" },
  pendente:  { label: "Pendente",  className: "bg-yellow-100 text-yellow-800" },
  aprovado:  { label: "Aprovado",  className: "bg-green-100 text-green-800" },
  rejeitado: { label: "Rejeitado", className: "bg-red-100 text-red-800" },
  pausado:   { label: "Pausado",   className: "bg-orange-100 text-orange-800" },
};

const tipoLabel: Record<string, string> = {
  convite_optin: "Convite (opt-in)",
  campanha: "Campanha",
  transacional: "Transacional",
};

export default function WhatsAppTemplatesPJ() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateFormValue | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTemplates((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("whatsapp-template-submit", {
      body: { template_id: id },
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    if (data?.success === false) return toast.error(data.error ?? "Erro ao submeter");
    toast.success("Template submetido à Meta");
    load();
  };

  const refresh = async (id?: string) => {
    if (id) setBusyId(id);
    else setRefreshingAll(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-template-refresh", {
      body: id ? { template_id: id } : { all: true },
    });
    if (id) setBusyId(null);
    else setRefreshingAll(false);
    if (error) return toast.error(error.message);
    if (data?.success === false) return toast.error(data.error ?? "Erro ao atualizar");
    toast.success("Status atualizado");
    load();
  };

  const duplicate = async (tpl: Template) => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return;
    const { error } = await supabase.from("whatsapp_templates").insert({
      user_id: user.id,
      nome_meta: `${tpl.nome_meta}_copia`,
      idioma: tpl.idioma,
      categoria_meta: tpl.categoria_meta,
      tipo_uso: tpl.tipo_uso,
      body_text: tpl.body_text,
      header: tpl.header,
      botoes: tpl.botoes,
      status_meta: "rascunho",
    });
    if (error) return toast.error(error.message);
    toast.success("Template duplicado");
    load();
  };

  const openEdit = (tpl: Template) => {
    setEditing({
      id: tpl.id,
      nome_meta: tpl.nome_meta,
      idioma: tpl.idioma,
      categoria_meta: tpl.categoria_meta as any,
      tipo_uso: tpl.tipo_uso as any,
      body_text: tpl.body_text,
      header: tpl.header ?? null,
      botoes: Array.isArray(tpl.botoes) ? tpl.botoes : [],
    });
    setModalOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Templates WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre e submeta templates à Meta. Campanhas só podem usar templates <b>aprovados</b>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refresh()} disabled={refreshingAll}>
            {refreshingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar todos
          </Button>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum template cadastrado ainda. Clique em <b>Novo template</b> para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const st = statusVariant[tpl.status_meta] ?? statusVariant.rascunho;
            const isBusy = busyId === tpl.id;
            return (
              <Card key={tpl.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {tpl.nome_meta}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{tipoLabel[tpl.tipo_uso] ?? tpl.tipo_uso}</Badge>
                        <Badge variant="outline">{tpl.categoria_meta}</Badge>
                        <Badge variant="outline">{tpl.idioma}</Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Badge className={st.className}>{st.label}</Badge>
                              </span>
                            </TooltipTrigger>
                            {tpl.motivo_rejeicao_meta && (
                              <TooltipContent>
                                <p className="max-w-xs">{tpl.motivo_rejeicao_meta}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        {tpl.meta_template_id && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            id: {tpl.meta_template_id}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {tpl.status_meta === "rascunho" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={() => submit(tpl.id)} disabled={isBusy}>
                            {isBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                            Submeter à Meta
                          </Button>
                        </>
                      )}
                      {["pendente", "aprovado", "pausado", "rejeitado"].includes(tpl.status_meta) && (
                        <Button size="sm" variant="outline" onClick={() => refresh(tpl.id)} disabled={isBusy}>
                          {isBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                          Atualizar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => duplicate(tpl)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                    {tpl.body_text}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TemplateFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editing}
        onSaved={load}
      />
    </div>
  );
}
