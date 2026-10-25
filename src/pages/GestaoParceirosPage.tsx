import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSmartBack } from "@/lib/app-back-nav.ts";
import { GESTAO_DESPESA_CATEGORIAS, gestaoCategoriaLabel } from "@/lib/gestao-lucro-categories.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import type { GestaoParceiroRow } from "@/lib/gestao-os-types.ts";

type Servico = {
  id: string;
  parceiro_id: string;
  nome: string;
  categoria_despesa: string;
  preco_referencia: number | null;
  prazo_medio_dias: number | null;
  ativo: boolean;
};

const TIPOS = ["mecanica", "funilaria", "estetica", "pneus", "vidros", "despachante", "outros"];

export default function GestaoParceirosPage() {
  const goBack = useSmartBack("/gestao/operacoes");
  const [userId, setUserId] = useState("");
  const [parceiros, setParceiros] = useState<GestaoParceiroRow[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [selecionado, setSelecionado] = useState<string>("");
  const [form, setForm] = useState({ nome: "", documento: "", whatsapp: "", tipos: ["mecanica"] as string[] });
  const [servico, setServico] = useState({ nome: "", categoria: "mecanica", preco: "", prazo: "" });

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [p, s] = await Promise.all([
      supabase.from("gestao_parceiro" as "veiculos_estoque").select("*").eq("user_id", user.id).order("nome"),
      supabase.from("gestao_parceiro_servico" as "veiculos_estoque").select("*").eq("user_id", user.id).order("nome"),
    ]);
    setParceiros((p.data ?? []) as unknown as GestaoParceiroRow[]);
    setServicos((s.data ?? []) as unknown as Servico[]);
  }, []);
  useEffect(() => void load(), [load]);

  const salvarParceiro = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome.");
    const { error } = await supabase.from("gestao_parceiro" as "veiculos_estoque").insert({
      user_id: userId,
      nome: form.nome.trim(),
      documento: form.documento.trim() || null,
      whatsapp_e164: form.whatsapp.trim() || null,
      tipos: form.tipos,
    } as never);
    if (error) return toast.error(error.message);
    setForm({ nome: "", documento: "", whatsapp: "", tipos: ["mecanica"] });
    toast.success("Parceiro cadastrado.");
    await load();
  };

  const salvarServico = async () => {
    if (!selecionado || !servico.nome.trim()) return toast.error("Escolha o parceiro e informe o serviço.");
    const { error } = await supabase.from("gestao_parceiro_servico" as "veiculos_estoque").insert({
      user_id: userId,
      parceiro_id: selecionado,
      nome: servico.nome.trim(),
      categoria_despesa: servico.categoria,
      preco_referencia: servico.preco ? Number(servico.preco) : null,
      prazo_medio_dias: servico.prazo ? Number(servico.prazo) : null,
    } as never);
    if (error) return toast.error(error.message);
    setServico({ nome: "", categoria: "mecanica", preco: "", prazo: "" });
    toast.success("Serviço adicionado.");
    await load();
  };

  return <div className="min-h-screen bg-muted/30 p-4 md:p-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <button type="button" onClick={goBack} className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</button>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Parceiros e serviços</h1><p className="text-sm text-muted-foreground">Documento fiscal é restrito ao dono da loja.</p></div>
        <Button variant="outline" asChild><Link to="/gestao/operacoes">Operações</Link></Button>
      </div>
      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 font-semibold">Novo parceiro</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></div>
          <div><Label>CPF/CNPJ (restrito)</Label><Input value={form.documento} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))} /></div>
          <div><Label>WhatsApp</Label><Input placeholder="+55…" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} /></div>
        </div>
        <div className="my-3 flex flex-wrap gap-2">{TIPOS.map((tipo) => <label key={tipo} className="flex items-center gap-1 rounded border px-2 py-1 text-sm"><input type="checkbox" checked={form.tipos.includes(tipo)} onChange={(e) => setForm((f) => ({ ...f, tipos: e.target.checked ? [...f.tipos, tipo] : f.tipos.filter((x) => x !== tipo) }))} />{tipo}</label>)}</div>
        <Button onClick={() => void salvarParceiro()}><Plus className="mr-2 h-4 w-4" />Cadastrar</Button>
      </section>
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <section className="rounded-lg border bg-background">
          <h2 className="border-b p-4 font-semibold">Parceiros</h2>
          {parceiros.map((p) => <button key={p.id} type="button" onClick={() => setSelecionado(p.id)} className={`block w-full border-b p-3 text-left ${selecionado === p.id ? "bg-primary/10" : "hover:bg-muted/40"}`}>
            <strong>{p.nome}</strong><div className="text-xs text-muted-foreground">{p.tipos.join(" · ")} · {p.whatsapp_e164 ?? "sem WhatsApp"}</div>
          </button>)}
        </section>
        <section className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 font-semibold">Tabela de serviços {selecionado ? `· ${parceiros.find((p) => p.id === selecionado)?.nome}` : ""}</h2>
          {selecionado && <div className="mb-4 grid gap-2 md:grid-cols-4">
            <Input placeholder="Serviço" value={servico.nome} onChange={(e) => setServico((s) => ({ ...s, nome: e.target.value }))} />
            <select className="rounded-md border bg-background px-2" value={servico.categoria} onChange={(e) => setServico((s) => ({ ...s, categoria: e.target.value }))}>{GESTAO_DESPESA_CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            <Input type="number" placeholder="Preço referência" value={servico.preco} onChange={(e) => setServico((s) => ({ ...s, preco: e.target.value }))} />
            <div className="flex gap-2"><Input type="number" placeholder="Prazo dias" value={servico.prazo} onChange={(e) => setServico((s) => ({ ...s, prazo: e.target.value }))} /><Button size="icon" onClick={() => void salvarServico()}><Plus className="h-4 w-4" /></Button></div>
          </div>}
          <div className="space-y-2">{servicos.filter((s) => s.parceiro_id === selecionado).map((s) => <div key={s.id} className="flex justify-between rounded border p-2 text-sm"><span>{s.nome} · {gestaoCategoriaLabel(s.categoria_despesa)}</span><span>{s.preco_referencia == null ? "—" : formatGestaoMoney(s.preco_referencia)} · {s.prazo_medio_dias ?? "—"} dias</span></div>)}</div>
        </section>
      </div>
    </div>
  </div>;
}
