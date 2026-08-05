import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export interface TemplateFormValue {
  id?: string;
  nome_meta: string;
  idioma: string;
  categoria_meta: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  tipo_uso: "convite_optin" | "campanha" | "transacional";
  body_text: string;
  header?: { format: "TEXT" | "IMAGE"; text?: string; example_url?: string } | null;
  botoes?: any[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: TemplateFormValue | null;
  onSaved: () => void;
}

const NAME_RE = /^[a-z0-9_]+$/;

export function TemplateFormModal({ open, onOpenChange, initial, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TemplateFormValue>({
    nome_meta: "",
    idioma: "pt_BR",
    categoria_meta: "UTILITY",
    tipo_uso: "convite_optin",
    body_text: "",
    header: null,
    botoes: [],
  });

  useEffect(() => {
    if (open) {
      setForm(
        initial ?? {
          nome_meta: "",
          idioma: "pt_BR",
          categoria_meta: "UTILITY",
          tipo_uso: "convite_optin",
          body_text: "Olá {{1}}! Aqui é a {{2}}. Podemos te enviar novidades e ofertas? Responda SIM para confirmar ou NÃO para não receber.",
          header: null,
          botoes: [],
        }
      );
    }
  }, [open, initial]);

  const setTipoUso = (v: TemplateFormValue["tipo_uso"]) => {
    setForm((f) => ({
      ...f,
      tipo_uso: v,
      categoria_meta: v === "convite_optin" ? "UTILITY" : v === "campanha" ? "MARKETING" : f.categoria_meta,
    }));
  };

  const handleSave = async () => {
    if (!NAME_RE.test(form.nome_meta)) {
      toast.error("Nome deve conter apenas letras minúsculas, números e underscore.");
      return;
    }
    if (!form.body_text.trim()) {
      toast.error("O corpo do template é obrigatório.");
      return;
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      toast.error("Sessão expirada");
      setSaving(false);
      return;
    }

    const payload: any = {
      user_id: user.id,
      nome_meta: form.nome_meta,
      idioma: form.idioma,
      categoria_meta: form.categoria_meta,
      tipo_uso: form.tipo_uso,
      body_text: form.body_text,
      header: form.header ?? null,
      botoes: form.tipo_uso === "convite_optin"
        ? [
            { type: "QUICK_REPLY", text: "Sim, quero!" },
            { type: "QUICK_REPLY", text: "Não, obrigado" },
          ]
        : (form.botoes ?? []),
    };

    let error: any = null;
    if (initial?.id) {
      const res = await supabase.from("whatsapp_templates").update(payload).eq("id", initial.id);
      error = res.error;
    } else {
      const res = await supabase.from("whatsapp_templates").insert({ ...payload, status_meta: "rascunho" });
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(initial?.id ? "Template atualizado" : "Template criado como rascunho");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo de uso</Label>
            <RadioGroup
              value={form.tipo_uso}
              onValueChange={(v) => setTipoUso(v as any)}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="convite_optin" id="tu-convite" />
                <Label htmlFor="tu-convite" className="font-normal cursor-pointer">Convite (opt-in)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="campanha" id="tu-camp" />
                <Label htmlFor="tu-camp" className="font-normal cursor-pointer">Campanha</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="transacional" id="tu-tx" />
                <Label htmlFor="tu-tx" className="font-normal cursor-pointer">Transacional</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome (Meta)</Label>
              <Input
                value={form.nome_meta}
                onChange={(e) => setForm({ ...form, nome_meta: e.target.value.toLowerCase() })}
                placeholder="convite_optin_amz_v1"
              />
              <p className="text-xs text-muted-foreground mt-1">apenas a-z, 0-9 e _</p>
            </div>
            <div>
              <Label>Idioma</Label>
              <Select value={form.idioma} onValueChange={(v) => setForm({ ...form, idioma: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                  <SelectItem value="en_US">Inglês (EUA)</SelectItem>
                  <SelectItem value="es_ES">Espanhol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Categoria Meta</Label>
            <Select
              value={form.categoria_meta}
              onValueChange={(v) => setForm({ ...form, categoria_meta: v as any })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UTILITY">UTILITY (serviço/consentimento)</SelectItem>
                <SelectItem value="MARKETING">MARKETING (ofertas)</SelectItem>
                <SelectItem value="AUTHENTICATION">AUTHENTICATION (OTP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Corpo (body)</Label>
            <Textarea
              rows={5}
              value={form.body_text}
              onChange={(e) => setForm({ ...form, body_text: e.target.value })}
              placeholder="Use {{1}}, {{2}} para variáveis"
            />
          </div>

          {form.tipo_uso === "convite_optin" && (
            <div className="rounded-md border p-3 bg-muted/40 text-sm">
              <p className="font-medium mb-1">Botões Quick Reply</p>
              <p className="text-muted-foreground">
                Serão adicionados automaticamente: <code>[Sim, quero!]</code> e <code>[Não, obrigado]</code>. O agente de
                opt-in já interpreta essas respostas para marcar o contato como confirmado ou recusado.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar rascunho"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
