"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Send, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  listaId: string;
  listaNome: string;
  onDisparoConcluido?: () => void;
}

interface TemplateConvite {
  id: string;
  nome_meta: string;
  idioma: string;
  status_meta: string;
}

interface DryRunResult {
  success: boolean;
  dry_run?: boolean;
  candidatos?: number;
  bloqueados_stop_universal?: number;
  teto_restante?: number;
  reason?: string;
  motivo?: string;
  candidatos_brutos?: number;
}

interface DisparoResult {
  success: boolean;
  enviados?: number;
  pulados?: number;
  falhas?: number;
  corridas?: number;
  bloqueados_stop_universal?: number;
  teto_diario?: number;
  restante_apos_batch?: number;
  reason?: string;
  motivo?: string;
  erros?: Array<{ telefone: string; erro: string }>;
}

export default function EnviarConviteOptinModal({
  open,
  onClose,
  listaId,
  listaNome,
  onDisparoConcluido,
}: Props) {
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templates, setTemplates] = useState<TemplateConvite[]>([]);
  const [templateId, setTemplateId] = useState<string>("");

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<DryRunResult | null>(null);

  const [disparando, setDisparando] = useState(false);
  const [resultado, setResultado] = useState<DisparoResult | null>(null);

  useEffect(() => {
    if (!open) {
      setTemplates([]);
      setTemplateId("");
      setPreview(null);
      setResultado(null);
      return;
    }
    loadTemplates();
  }, [open]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoadingTemplates(false);
      return;
    }
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("id, nome_meta, idioma, status_meta, tipo_uso")
      .eq("user_id", userData.user.id)
      .in("tipo_uso", ["convite", "convite_optin"])
      .eq("status_meta", "aprovado")
      .order("nome_meta", { ascending: true });
    setTemplates((data as TemplateConvite[]) || []);
    setLoadingTemplates(false);
  };

  const handlePreview = async () => {
    if (!templateId) return;
    setLoadingPreview(true);
    setPreview(null);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-convite-optin", {
        body: { lista_id: listaId, template_id: templateId, dry_run: true },
      });
      if (error) throw error;
      setPreview(data as DryRunResult);
      if ((data as DryRunResult)?.success === false) {
        toast.error(`Preview: ${(data as DryRunResult).reason || "erro"}`);
      }
    } catch (e) {
      toast.error("Falha no preview: " + (e as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDisparar = async () => {
    if (!templateId || !preview || preview.success === false) return;
    setDisparando(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-convite-optin", {
        body: { lista_id: listaId, template_id: templateId, dry_run: false },
      });
      if (error) throw error;
      const r = data as DisparoResult;
      setResultado(r);
      if (r.success === false) {
        toast.error(`Falha: ${r.reason || "erro"}`);
      } else {
        toast.success(`Convites enviados: ${r.enviados ?? 0}`);
        onDisparoConcluido?.();
      }
    } catch (e) {
      toast.error("Falha no disparo: " + (e as Error).message);
    } finally {
      setDisparando(false);
    }
  };

  const podeDisparar =
    !!templateId &&
    !!preview &&
    preview.success !== false &&
    (preview.candidatos ?? 0) > 0 &&
    !disparando &&
    !resultado;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar convite de opt-in</DialogTitle>
          <DialogDescription>
            Segmento: <strong>{listaNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template selector */}
          <div>
            <Label className="text-sm">Template de convite (aprovado)</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="mt-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  Nenhum template de convite aprovado. Cadastre e aguarde aprovação da Meta em{" "}
                  <Link
                    to="/pj/whatsapp-templates"
                    className="underline font-medium"
                    onClick={onClose}
                  >
                    Templates WhatsApp
                  </Link>
                  .
                </div>
              </div>
            ) : (
              <Select
                value={templateId}
                onValueChange={(v) => {
                  setTemplateId(v);
                  setPreview(null);
                  setResultado(null);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Escolha um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome_meta} ({t.idioma})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preview */}
          {templateId && (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePreview}
                disabled={loadingPreview}
                className="w-full"
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Visualizar preview (dry-run)
              </Button>

              {preview && preview.success !== false && (
                <div className="p-3 rounded-md bg-muted/50 border text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>📨 Vão receber convite:</span>
                    <strong>{preview.candidatos ?? 0}</strong>
                  </div>
                  <div className="flex justify-between text-red-700">
                    <span>🚫 Bloqueados (STOP universal):</span>
                    <strong>{preview.bloqueados_stop_universal ?? 0}</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Teto diário restante:</span>
                    <strong>{preview.teto_restante ?? 0}</strong>
                  </div>
                  {preview.motivo && (
                    <div className="text-amber-700 pt-1">Motivo: {preview.motivo}</div>
                  )}
                </div>
              )}

              {preview && preview.success === false && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs">
                  Erro: {preview.reason}
                </div>
              )}
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Disparo concluído
              </div>
              <div className="grid grid-cols-2 gap-1 text-emerald-900">
                <div>✅ Enviados: <strong>{resultado.enviados ?? 0}</strong></div>
                <div>⏭️ Pulados: <strong>{resultado.pulados ?? 0}</strong></div>
                <div>❌ Falhas: <strong>{resultado.falhas ?? 0}</strong></div>
                <div>🔀 Corridas: <strong>{resultado.corridas ?? 0}</strong></div>
                <div className="col-span-2">
                  🚫 Bloqueados STOP: <strong>{resultado.bloqueados_stop_universal ?? 0}</strong>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={handleDisparar} disabled={!podeDisparar}>
              {disparando ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Disparar convite
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
