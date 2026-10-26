import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSmartBack } from "@/lib/app-back-nav.ts";
import { deveExibirMotivoRejeicaoMetaTemplate } from "../../supabase/functions/_shared/gestao-os-cotacao-contato.ts";

export default function GestaoOsConfigPage() {
  const goBack = useSmartBack("/gestao/operacoes");
  const [userId, setUserId] = useState("");
  const [form, setForm] = useState({ os: "7", preparacao: "15", legal: "90", contratual: "", vencimento: "0" });
  const [template, setTemplate] = useState<{
    id: string;
    status_meta: string;
    motivo_rejeicao_meta: string | null;
  } | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const templateBody = "Olá, {{1}}! A {{2}} tem um pedido de cotação de serviço para o veículo {{3}}. Podemos enviar os detalhes e as fotos por aqui?";
  const carregarTemplate = async (uid: string) => {
    const { data } = await supabase.from("whatsapp_templates")
      .select("id,status_meta,motivo_rejeicao_meta")
      .eq("user_id", uid)
      .eq("body_text", templateBody)
      .eq("idioma", "pt_BR")
      .maybeSingle();
    setTemplate(data as typeof template);
  };
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await carregarTemplate(user.id);
      const { data } = await supabase.from("gestao_os_config" as "veiculos_estoque").select("*").eq("user_id", user.id).maybeSingle();
      const c = data as unknown as Record<string, number | null> | null;
      if (c) setForm({
        os: String(c.alerta_os_parada_dias ?? 7),
        preparacao: String(c.alerta_preparacao_parada_dias ?? 15),
        legal: String(c.garantia_legal_dias ?? 90),
        contratual: c.garantia_contratual_dias == null ? "" : String(c.garantia_contratual_dias),
        vencimento: String(c.conta_pagar_vencimento_dias ?? 0),
      });
    })();
  }, []);
  const salvar = async () => {
    const { error } = await supabase.from("gestao_os_config" as "veiculos_estoque").upsert({
      user_id: userId,
      alerta_os_parada_dias: Number(form.os),
      alerta_preparacao_parada_dias: Number(form.preparacao),
      garantia_legal_dias: Number(form.legal),
      garantia_contratual_dias: form.contratual ? Number(form.contratual) : null,
      conta_pagar_vencimento_dias: Number(form.vencimento),
    } as never);
    if (error) toast.error(error.message);
    else toast.success("Configuração salva.");
  };
  const ativarConvite = async () => {
    if (!userId) return;
    setTemplateBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "gestao-os-cotacao-template-activate",
      );
      if (error) throw new Error(error.message);
      if (data?.success !== true) throw new Error(data?.error ?? "Falha ao enviar modelo à Meta");
      await carregarTemplate(userId);
      toast.success("Convite enviado para análise da Meta.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar convite");
    } finally {
      setTemplateBusy(false);
    }
  };
  const atualizarTemplate = async () => {
    if (!template) return;
    setTemplateBusy(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-template-refresh", {
      body: { template_id: template.id },
    });
    if (error) toast.error(error.message);
    else if (data?.success !== true) toast.error(data?.error ?? "Falha ao consultar a Meta");
    await carregarTemplate(userId);
    setTemplateBusy(false);
  };
  const templateStatus = template?.status_meta === "aprovado"
    ? "Aprovado ✅"
    : template?.status_meta === "pendente"
    ? "Em análise na Meta"
    : template?.status_meta === "rejeitado"
    ? "Rejeitado"
    : template?.status_meta === "rascunho"
    ? "Rascunho"
    : "Não ativado";
  return <div className="min-h-screen bg-muted/30 p-6"><div className="mx-auto max-w-2xl space-y-5">
    <button type="button" onClick={goBack} className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</button>
    <div><h1 className="text-2xl font-bold">Configuração de Operações</h1><p className="text-sm text-muted-foreground">Alertas, garantia e vencimento da conta do fornecedor.</p></div>
    <section className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2">
      <div><Label>Alertar OS parada após (dias)</Label><Input type="number" min="1" value={form.os} onChange={(e) => setForm((f) => ({ ...f, os: e.target.value }))} /></div>
      <div><Label>Alertar carro em preparação após (dias)</Label><Input type="number" min="1" value={form.preparacao} onChange={(e) => setForm((f) => ({ ...f, preparacao: e.target.value }))} /></div>
      <div><Label>Garantia legal padrão (dias)</Label><Input type="number" min="0" value={form.legal} onChange={(e) => setForm((f) => ({ ...f, legal: e.target.value }))} /></div>
      <div><Label>Garantia contratual (dias, opcional)</Label><Input type="number" min="0" value={form.contratual} onChange={(e) => setForm((f) => ({ ...f, contratual: e.target.value }))} /></div>
      <div><Label>Vencimento da conta após conclusão (dias)</Label><Input type="number" min="0" value={form.vencimento} onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))} /></div>
      <div className="flex items-end"><Button onClick={() => void salvar()}>Salvar</Button></div>
    </section>
    <section className="space-y-3 rounded-lg border bg-background p-4">
      <div>
        <h2 className="font-semibold">Convite de cotação no WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Permite iniciar pedidos com parceiros fora da janela de 24 horas.
        </p>
      </div>
      <p className="text-sm">Status: <strong>{templateStatus}</strong></p>
      {deveExibirMotivoRejeicaoMetaTemplate(
        template?.status_meta,
        template?.motivo_rejeicao_meta,
      ) && (
        <p className="text-sm text-destructive">{template!.motivo_rejeicao_meta}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {(!template || template.status_meta === "rascunho") && (
          <Button disabled={templateBusy} onClick={() => void ativarConvite()}>
            Ativar convite de cotação no WhatsApp
          </Button>
        )}
        {template && template.status_meta !== "rascunho" && (
          <Button variant="outline" disabled={templateBusy} onClick={() => void atualizarTemplate()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar status
          </Button>
        )}
      </div>
    </section>
  </div></div>;
}
