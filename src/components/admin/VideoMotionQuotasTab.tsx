import { useEffect, useState } from "react";
import { Infinity as InfinityIcon, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Plano = {
  id: string;
  nome: string;
  slug: string;
  videos_motion_dia: number;
};

type Conta = {
  user_id: string;
  email: string;
  nome: string | null;
  plano_nome: string | null;
  plano_limite: number | null;
  limite_individual: number | null;
  limite_efetivo: number;
  origem_limite: string;
  usado_hoje: number;
};

const rotuloLimite = (limite: number | null) => limite === -1 ? "Ilimitado" : String(limite ?? "—");

export function VideoMotionQuotasTab() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [valoresPlano, setValoresPlano] = useState<Record<string, string>>({});
  const [valoresConta, setValoresConta] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [planosResult, contasResult] = await Promise.all([
      supabase.from("planos").select("id, nome, slug, videos_motion_dia").order("ordem"),
      supabase.rpc("admin_list_video_motion_quotas"),
    ]);

    if (planosResult.error || contasResult.error) {
      toast({
        title: "Não foi possível carregar as cotas",
        description: planosResult.error?.message || contasResult.error?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const novosPlanos = (planosResult.data ?? []) as Plano[];
    const novasContas = (contasResult.data ?? []) as Conta[];
    setPlanos(novosPlanos);
    setContas(novasContas);
    setValoresPlano(Object.fromEntries(novosPlanos.map((plano) => [plano.id, String(plano.videos_motion_dia)])));
    setValoresConta(Object.fromEntries(novasContas.map((conta) => [conta.user_id, conta.limite_individual == null ? "" : String(conta.limite_individual)])));
    setLoading(false);
  };

  useEffect(() => { void carregar(); }, []);

  const salvarPlano = async (plano: Plano) => {
    const limite = Number(valoresPlano[plano.id]);
    if (!Number.isInteger(limite) || (limite !== -1 && limite <= 0)) {
      toast({ title: "Valor inválido", description: "Use -1 para ilimitado ou um número maior que zero.", variant: "destructive" });
      return;
    }
    setSalvando(`plano-${plano.id}`);
    const { error } = await supabase.from("planos").update({ videos_motion_dia: limite }).eq("id", plano.id);
    setSalvando(null);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cota do plano atualizada" });
    await carregar();
  };

  const salvarConta = async (conta: Conta) => {
    const valor = valoresConta[conta.user_id]?.trim() ?? "";
    const limite = valor === "" ? null : Number(valor);
    if (limite !== null && (!Number.isInteger(limite) || (limite !== -1 && limite <= 0))) {
      toast({ title: "Valor inválido", description: "Deixe vazio para usar o plano, use -1 para ilimitado ou informe um número maior que zero.", variant: "destructive" });
      return;
    }
    setSalvando(`conta-${conta.user_id}`);
    const { error } = await supabase.rpc("admin_set_video_motion_quota", { p_user_id: conta.user_id, p_limite: limite } as never);
    setSalvando(null);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cota da conta atualizada" });
    await carregar();
  };

  if (loading) {
    return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Limite padrão por plano</h2>
          <p className="text-sm text-muted-foreground">Use -1 para deixar um plano ilimitado.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {planos.map((plano) => (
            <Card key={plano.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{plano.nome}</CardTitle>
                <CardDescription>{rotuloLimite(plano.videos_motion_dia)} por dia</CardDescription>
              </CardHeader>
              <CardContent className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`plano-${plano.id}`}>Vídeos por dia</Label>
                  <Input id={`plano-${plano.id}`} type="number" min={-1} value={valoresPlano[plano.id] ?? ""} onChange={(e) => setValoresPlano((atual) => ({ ...atual, [plano.id]: e.target.value }))} />
                </div>
                <Button size="icon" onClick={() => salvarPlano(plano)} disabled={salvando === `plano-${plano.id}`} title="Salvar cota do plano">
                  {salvando === `plano-${plano.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Exceções por conta</h2>
          <p className="text-sm text-muted-foreground">Vazio usa o plano. Administradores permanecem ilimitados.</p>
        </div>
        <div className="space-y-3">
          {contas.map((conta) => (
            <Card key={conta.user_id}>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] md:items-end">
                <div className="min-w-0">
                  <p className="truncate font-medium">{conta.nome || conta.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{conta.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{conta.plano_nome || "Sem plano"}</Badge>
                    <Badge variant={conta.limite_efetivo === -1 ? "default" : "secondary"}>
                      {conta.limite_efetivo === -1 && <InfinityIcon className="mr-1 h-3 w-3" />}
                      {rotuloLimite(conta.limite_efetivo)} · {conta.origem_limite}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Uso de hoje</p>
                  <p className="text-lg font-semibold">{conta.usado_hoje} / {rotuloLimite(conta.limite_efetivo)}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`conta-${conta.user_id}`}>Exceção da conta</Label>
                  <Input id={`conta-${conta.user_id}`} type="number" min={-1} placeholder="Usar o plano" value={valoresConta[conta.user_id] ?? ""} onChange={(e) => setValoresConta((atual) => ({ ...atual, [conta.user_id]: e.target.value }))} />
                </div>
                <Button size="icon" onClick={() => salvarConta(conta)} disabled={salvando === `conta-${conta.user_id}`} title="Salvar cota da conta">
                  {salvando === `conta-${conta.user_id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}