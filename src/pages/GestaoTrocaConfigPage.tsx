import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_GESTAO_TROCA_CONFIG } from "@/lib/calc-troca-preco.ts";
import {
  invokeGestaoTrocaCustosListar,
  invokeGestaoTrocaCustosSalvar,
} from "@/lib/gestao-troca-ia-api.ts";
import {
  GESTAO_TROCA_IA_CUSTO_CATEGORIAS,
  GESTAO_TROCA_IA_GRAVIDADES,
  type GestaoTrocaIaCustoRow,
} from "@/lib/gestao-troca-ia-types.ts";

export default function GestaoTrocaConfigPage() {
  const [cfg, setCfg] = useState({ ...DEFAULT_GESTAO_TROCA_CONFIG });
  const [custos, setCustos] = useState<GestaoTrocaIaCustoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("gestao_troca_config" as "veiculos_estoque")
        .select("*").eq("user_id", user.id).maybeSingle();
      if (data) setCfg({ ...DEFAULT_GESTAO_TROCA_CONFIG, ...(data as typeof cfg) });
      const listed = await invokeGestaoTrocaCustosListar();
      if (listed.error && listed.custos.length === 0) {
        toast.error(listed.error);
      }
      setCustos(listed.custos);
      setLoading(false);
    })();
  }, []);

  const custoMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of custos) m.set(`${c.categoria}:${c.gravidade}`, c.valor);
    return m;
  }, [custos]);

  const setCusto = (categoria: string, gravidade: string, valor: number) => {
    setCustos((prev) => {
      const rest = prev.filter((r) => !(r.categoria === categoria && r.gravidade === gravidade));
      return [...rest, { categoria, gravidade, valor }];
    });
  };

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("gestao_troca_config" as "veiculos_estoque").upsert({
      user_id: user.id,
      ...cfg,
    });
    if (error) {
      setSaving(false);
      toast.error("Falha ao salvar parâmetros de preço.");
      return;
    }
    const custosSave = await invokeGestaoTrocaCustosSalvar(custos);
    setSaving(false);
    if (custosSave.error) {
      toast.error(custosSave.error);
      return;
    }
    toast.success("Configuração salva.");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const field = (key: keyof typeof cfg, label: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        step="any"
        value={cfg[key]}
        onChange={(e) => setCfg({ ...cfg, [key]: Number(e.target.value) })}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/gestao/trocas" className="flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Trocas
        </Link>
        <h1 className="text-2xl font-bold">Configuração — Trocas</h1>
        <div className="grid gap-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          {field("margem_alvo_pct", "Margem alvo (%)")}
          {field("km_ref_mes_padrao", "KM/mês referência")}
          {field("bonus_km_baixo_pct", "Bônus km baixo (%)")}
          {field("desconto_km_alto_pct_por_faixa", "Desconto km alto por faixa 0,25 (%)")}
          {field("desconto_km_alto_teto_pct", "Teto desconto km alto (%)")}
          {field("fator_troca_sobre_fipe", "Fator troca × FIPE")}
          {field("fator_loja_sobre_fipe", "Fator loja × FIPE")}
          {field("custo_dia_estoque", "Custo dia estoque (R$)")}
          {field("dias_giro_padrao", "Dias giro padrão")}
          {field("desconto_leilao_pct", "Desconto leilão/sinistro (%)")}
        </div>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Custos de reparo (Laudo IA)</h2>
          <p className="text-xs text-muted-foreground">
            Valores usados pela regra automática após a pré-análise visual. Edite por categoria e gravidade.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-2 font-medium">Categoria</th>
                  {GESTAO_TROCA_IA_GRAVIDADES.map((g) => (
                    <th key={g.id} className="px-2 py-2 font-medium">{g.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GESTAO_TROCA_IA_CUSTO_CATEGORIAS.map(({ id, label }) => (
                  <tr key={id} className="border-b">
                    <td className="py-2 pr-2 text-muted-foreground">{label}</td>
                    {GESTAO_TROCA_IA_GRAVIDADES.map((g) => {
                      const key = `${id}:${g.id}`;
                      const val = custoMap.get(key) ?? 0;
                      return (
                        <td key={g.id} className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            className="h-8"
                            value={val}
                            onChange={(e) => setCusto(id, g.id, Number(e.target.value) || 0)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar
        </Button>
      </div>
    </div>
  );
}
