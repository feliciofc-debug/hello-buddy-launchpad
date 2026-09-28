import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { combineSaoPauloDateTimeToIso } from "@/lib/sao-paulo-time";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EnviarWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensagem: string;
  imagemUrl?: string | null;
}

type DestinationType = "list" | "individual";

type ListItem = {
  id: string;
  nome: string;
  total: number;
  confirmed: number;
  ignored: number;
};

type ContactItem = {
  id: string;
  nome: string | null;
  telefone: string;
  opt_in_status: string;
  lista_id: string;
};

type TemplateItem = {
  id: string;
  nome_meta: string;
  body_text: string | null;
  variaveis_map: unknown;
  header: unknown;
};

type PreviewSummary = {
  recipients: Array<{ phone: string; name: string | null; send_mode: "session" | "template" }>;
  inside_window: number;
  need_template: number;
  ignored_without_opt_in: number;
  duplicates: number;
};

type CampaignReport = {
  id: string;
  status: string;
  scheduled_at: string;
  total_recipients: number;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  total_skipped: number;
  stop_reason?: string | null;
};

async function invokeCampaign(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("whatsapp-campanha-enviar", { body });
  if (error) {
    let detail = error.message;
    try {
      const response = (error as any)?.context as Response | undefined;
      if (response?.clone) {
        const parsed = await response.clone().json();
        detail = parsed?.error || detail;
      }
    } catch {
      // Mantém o erro original da função.
    }
    throw new Error(detail);
  }
  if (data?.success === false) throw new Error(data.error || "Não consegui concluir a operação.");
  return data;
}

function templateVariableCount(template: TemplateItem | null): number {
  if (!template) return 0;
  const bodyMatches = [...String(template.body_text || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)]
    .map((match) => Number(match[1]));
  if (bodyMatches.length) return Math.max(...bodyMatches);
  if (Array.isArray(template.variaveis_map)) return template.variaveis_map.length;
  if (template.variaveis_map && typeof template.variaveis_map === "object") {
    return Object.keys(template.variaveis_map as Record<string, unknown>).length;
  }
  return 0;
}

export function EnviarWhatsAppModal({
  open,
  onOpenChange,
  mensagem,
  imagemUrl,
}: EnviarWhatsAppModalProps) {
  const [destinationType, setDestinationType] = useState<DestinationType | null>(null);
  const [lists, setLists] = useState<ListItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [reportRecipients, setReportRecipients] = useState<any[]>([]);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplate) ?? null,
    [templates, selectedTemplate],
  );
  const variableCount = templateVariableCount(activeTemplate);

  const handleError = useCallback((caught: unknown) => {
    const message = caught instanceof Error ? caught.message : "Não consegui carregar os dados agora.";
    setError(message);
    setSessionExpired(/sessão expirou|session|jwt|não autenticado/i.test(message));
  }, []);

  useEffect(() => {
    if (!open) return;
    setDestinationType(null);
    setSelectedId("");
    setSelectedContact(null);
    setContactQuery("");
    setSelectedTemplate("");
    setTemplateVariables([]);
    setSummary(null);
    setError("");
    setSessionExpired(false);
    setScheduleMode("now");
    setScheduleDate(undefined);
    setCampaignId(null);
    setReport(null);
    setReportRecipients([]);
    setLoadingInitial(true);
    invokeCampaign({ action: "bootstrap", has_image: Boolean(imagemUrl) })
      .then((data) => {
        setLists(data.lists || []);
        setTemplates(data.templates || []);
      })
      .catch(handleError)
      .finally(() => setLoadingInitial(false));
  }, [open, imagemUrl, handleError]);

  useEffect(() => {
    if (destinationType !== "individual" || contactQuery.trim().length < 2 || selectedContact) {
      setContacts([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoadingContacts(true);
      invokeCampaign({ action: "search_contacts", query: contactQuery.trim() })
        .then((data) => setContacts(data.contacts || []))
        .catch(handleError)
        .finally(() => setLoadingContacts(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [contactQuery, destinationType, selectedContact, handleError]);

  const destination = useMemo(() => {
    if (destinationType === "list" && selectedId) return { type: "list", list_id: selectedId };
    if (destinationType === "individual" && selectedContact) {
      return { type: "individual", contact_id: selectedContact.id };
    }
    return null;
  }, [destinationType, selectedId, selectedContact]);

  useEffect(() => {
    if (!destination) {
      setSummary(null);
      return;
    }
    let active = true;
    setLoadingPreview(true);
    setError("");
    invokeCampaign({ action: "preview", destination })
      .then((data) => {
        if (!active) return;
        setSummary(data.summary);
        if (data.summary?.need_template > 0 && templates.length) {
          setSelectedTemplate((current) => current || templates[0].id);
        }
      })
      .catch(handleError)
      .finally(() => active && setLoadingPreview(false));
    return () => {
      active = false;
    };
  }, [destination, templates, handleError]);

  useEffect(() => {
    setTemplateVariables((current) =>
      Array.from({ length: variableCount }, (_, index) => current[index] || (index === 0 ? "{{nome}}" : ""))
    );
  }, [variableCount, selectedTemplate]);

  useEffect(() => {
    if (!campaignId || !open) return;
    const refresh = async () => {
      try {
        const data = await invokeCampaign({ action: "status", campaign_id: campaignId });
        setReport(data.campaign);
        setReportRecipients(data.recipients || []);
      } catch (caught) {
        handleError(caught);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 4_000);
    return () => window.clearInterval(timer);
  }, [campaignId, open, handleError]);

  const canSubmit = Boolean(
    destination
    && summary
    && summary.recipients.length > 0
    && (!summary.need_template || selectedTemplate)
    && templateVariables.every((value) => value.trim())
    && (scheduleMode === "now" || scheduleDate),
  );

  const submit = async () => {
    if (!destination || !summary || !canSubmit) return;
    setSending(true);
    setError("");
    try {
      const scheduledAt = scheduleMode === "later" && scheduleDate
        ? combineSaoPauloDateTimeToIso(scheduleDate, scheduleTime)
        : new Date().toISOString();
      if (scheduleMode === "later" && new Date(scheduledAt).getTime() <= Date.now() + 60_000) {
        throw new Error("Escolha um horário futuro, com pelo menos um minuto de antecedência.");
      }
      const data = await invokeCampaign({
        action: "create",
        name: `IA Marketing · ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        destination,
        message: mensagem,
        image_url: imagemUrl || null,
        template_id: selectedTemplate || null,
        template_variables: templateVariables,
        scheduled_at: scheduledAt,
      });
      setCampaignId(data.campaign.id);
      setReport(data.campaign);
      toast.success(scheduleMode === "later" ? "Campanha agendada com segurança." : "Campanha colocada na fila oficial.");
    } catch (caught) {
      handleError(caught);
    } finally {
      setSending(false);
    }
  };

  const cancelCampaign = async () => {
    if (!campaignId) return;
    try {
      await invokeCampaign({ action: "cancel", campaign_id: campaignId });
      setReport((current) => current ? { ...current, status: "cancelled" } : current);
      toast.success("Envios pendentes cancelados.");
    } catch (caught) {
      handleError(caught);
    }
  };

  const terminal = report && ["completed", "cancelled", "failed"].includes(report.status);
  const failedRecipients = reportRecipients.filter((recipient) => recipient.status === "failed");

  return (
    <Dialog open={open} onOpenChange={sending ? undefined : onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📲 Enviar pela API oficial do WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 flex gap-3 items-start">
          {imagemUrl && <img src={imagemUrl} alt="Preview" className="w-16 h-16 rounded object-cover" />}
          <p className="text-sm line-clamp-4 text-muted-foreground flex-1">{mensagem}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          A API oficial do WhatsApp não permite envio para grupos. Use uma lista de contatos que autorizaram o recebimento.
        </p>

        {loadingInitial ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando contatos e modelos...
          </div>
        ) : sessionExpired ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Sua sessão expirou. Entre novamente para enviar.
          </div>
        ) : campaignId ? (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <strong>{report?.status === "scheduled" ? "Campanha agendada" : "Relatório da campanha"}</strong>
                <Badge className="ml-auto" variant="outline">{report?.status || "carregando"}</Badge>
              </div>
              {report && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <span>Enviados: {report.total_sent}</span>
                  <span>Entregues: {report.total_delivered}</span>
                  <span>Lidos: {report.total_read}</span>
                  <span>Falhas: {report.total_failed}</span>
                  <span>Ignorados: {report.total_skipped}</span>
                  <span>Total: {report.total_recipients}</span>
                </div>
              )}
              {report?.stop_reason && <p className="text-sm text-destructive">Pausada: {report.stop_reason}</p>}
              {failedRecipients.slice(0, 5).map((recipient) => (
                <p key={recipient.phone} className="text-xs text-destructive">
                  {recipient.contact_name || recipient.phone}: {recipient.failure_reason}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              {!terminal && (
                <Button variant="destructive" onClick={cancelCampaign} className="flex-1">
                  Cancelar pendentes
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Fechar</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: "list" as const, icon: "📋", label: "Lista com autorização", description: "Somente opt-in confirmado" },
                { type: "individual" as const, icon: "👤", label: "Contato individual", description: "Um destinatário autorizado" },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    setDestinationType(item.type);
                    setSelectedId("");
                    setSelectedContact(null);
                    setSummary(null);
                  }}
                  className={cn(
                    "rounded-lg border-2 p-3 text-left",
                    destinationType === item.type ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <span className="text-xl">{item.icon}</span>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </button>
              ))}
            </div>

            {destinationType === "list" && (
              <div className="space-y-2">
                <Label>Lista</Label>
                {lists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma lista ativa encontrada.</p>
                ) : lists.map((list) => (
                  <button
                    type="button"
                    key={list.id}
                    onClick={() => setSelectedId(list.id)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left text-sm",
                      selectedId === list.id ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <strong>{list.nome}</strong>
                    <p className="text-xs text-muted-foreground">
                      {list.confirmed} autorizados · {list.ignored} sem autorização
                    </p>
                  </button>
                ))}
              </div>
            )}

            {destinationType === "individual" && (
              <div className="space-y-2">
                <Label>Contato autorizado</Label>
                {selectedContact ? (
                  <div className="flex items-center rounded-md border p-3">
                    <span className="text-sm">{selectedContact.nome || "Sem nome"} · {selectedContact.telefone}</span>
                    <Badge variant="outline" className="ml-2">{selectedContact.opt_in_status}</Badge>
                    <button type="button" className="ml-auto" onClick={() => setSelectedContact(null)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Digite pelo menos 2 letras ou números.</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={contactQuery}
                        onChange={(event) => setContactQuery(event.target.value)}
                        placeholder="Buscar nome ou telefone"
                        className="pl-9"
                      />
                    </div>
                    {loadingContacts && <p className="text-xs text-muted-foreground">Buscando contatos...</p>}
                    {!loadingContacts && contactQuery.trim().length >= 2 && contacts.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum contato encontrado.</p>
                    )}
                    {contacts.map((contact) => (
                      <button
                        type="button"
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setContactQuery("");
                          setContacts([]);
                        }}
                        className="w-full rounded border p-2 text-left text-sm hover:bg-muted"
                      >
                        {contact.nome || "Sem nome"} · {contact.telefone}
                        <Badge variant="outline" className="ml-2">{contact.opt_in_status}</Badge>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {loadingPreview && <p className="text-sm text-muted-foreground">Verificando autorização e janela de 24 horas...</p>}
            {summary && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <strong>Resumo do destino</strong>
                <p>{summary.inside_window} dentro da janela de 24h: recebem imagem e legenda livre.</p>
                <p>{summary.need_template} precisam de modelo MARKETING aprovado.</p>
                <p>{summary.ignored_without_opt_in} sem autorização ignorados.</p>
                {summary.duplicates > 0 && <p>{summary.duplicates} duplicados removidos.</p>}
              </div>
            )}

            {summary && summary.need_template > 0 && (
              <div className="space-y-3">
                <Label>Modelo aprovado para contatos fora da janela</Label>
                {templates.length === 0 ? (
                  <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                    Não há modelo MARKETING aprovado com cabeçalho compatível. O envio fora da janela está bloqueado.
                  </p>
                ) : (
                  <>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger><SelectValue placeholder="Escolha um modelo aprovado" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>{template.nome_meta}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeTemplate?.body_text && (
                      <p className="rounded border p-2 text-xs text-muted-foreground whitespace-pre-wrap">
                        {activeTemplate.body_text}
                      </p>
                    )}
                    {templateVariables.map((value, index) => (
                      <div key={index}>
                        <Label>Variável {index + 1}</Label>
                        <Input
                          value={value}
                          onChange={(event) => setTemplateVariables((current) =>
                            current.map((item, itemIndex) => itemIndex === index ? event.target.value : item)
                          )}
                          placeholder={index === 0 ? "{{nome}} para usar o nome do contato" : `Valor de {{${index + 1}}}`}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Quando enviar?</Label>
              <div className="flex gap-2">
                <Button type="button" variant={scheduleMode === "now" ? "default" : "outline"} onClick={() => setScheduleMode("now")}>
                  Enviar agora
                </Button>
                <Button type="button" variant={scheduleMode === "later" ? "default" : "outline"} onClick={() => setScheduleMode("later")}>
                  Agendar
                </Button>
              </div>
              {scheduleMode === "later" && (
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("flex-1 justify-start", !scheduleDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduleDate ? format(scheduleDate, "dd/MM/yyyy") : "Escolha a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduleDate}
                        onSelect={setScheduleDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} className="w-28" />
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              onClick={submit}
              disabled={!canSubmit || sending || loadingPreview}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
            >
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {scheduleMode === "later" ? "Agendar campanha" : "Enviar pela API oficial"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
