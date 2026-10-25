import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSmartBack } from "@/lib/app-back-nav.ts";

export default function GestaoOsConfigPage() {
  const goBack = useSmartBack("/gestao/operacoes");
  const [userId, setUserId] = useState("");
  const [form, setForm] = useState({ os: "7", preparacao: "15", legal: "90", contratual: "", vencimento: "0" });
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
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
  </div></div>;
}
