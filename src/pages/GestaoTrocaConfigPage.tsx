import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_GESTAO_TROCA_CONFIG } from "@/lib/calc-troca-preco.ts";

export default function GestaoTrocaConfigPage() {
  const [cfg, setCfg] = useState({ ...DEFAULT_GESTAO_TROCA_CONFIG });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("gestao_troca_config" as "veiculos_estoque")
        .select("*").eq("user_id", user.id).maybeSingle();
      if (data) setCfg({ ...DEFAULT_GESTAO_TROCA_CONFIG, ...(data as typeof cfg) });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("gestao_troca_config" as "veiculos_estoque").upsert({
      user_id: user.id,
      ...cfg,
    });
    if (error) toast.error("Falha ao salvar.");
    else toast.success("Configuração salva.");
  };

  if (loading) return null;

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
      <div className="mx-auto max-w-lg space-y-4">
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
        <Button onClick={() => void save()}>Salvar</Button>
      </div>
    </div>
  );
}
