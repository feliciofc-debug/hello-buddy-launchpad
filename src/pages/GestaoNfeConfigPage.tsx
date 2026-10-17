import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defaultGestaoNfeOperacoes,
  type GestaoNfeOperacaoKey,
} from "../../supabase/functions/_shared/gestao-nfe-config-default.ts";
import { fetchGestaoNfeConfig, saveGestaoNfeConfig, type GestaoNfeConfigRow } from "@/lib/gestao-nfe-load.ts";
import { useSmartBack, withVoltarParam } from "@/lib/app-back-nav.ts";

const OP_KEYS: GestaoNfeOperacaoKey[] = ["entrada_compra_pf", "saida_venda", "consignacao"];
const OP_TITLES: Record<GestaoNfeOperacaoKey, string> = {
  entrada_compra_pf: "Entrada — compra de pessoa física",
  saida_venda: "Saída — venda",
  consignacao: "Consignação",
};

export default function GestaoNfeConfigPage() {
  const location = useLocation();
  const goBack = useSmartBack("/gestao/lucro");
  const returnTo = `${location.pathname}${location.search}`;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<GestaoNfeConfigRow | null>(null);

  useEffect(() => {
    void (async () => {
      const c = await fetchGestaoNfeConfig();
      setConfig(c ?? {
        cnpj: "",
        inscricao_estadual: "",
        regime_tributario: "",
        razao_social: "",
        nome_fantasia: "",
        logradouro: "",
        numero: "",
        complemento: null,
        bairro: "",
        municipio: "",
        uf: "",
        cep: "",
        operacoes_json: defaultGestaoNfeOperacoes(),
      });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!config) return;
    setBusy(true);
    const { data, error } = await saveGestaoNfeConfig(config);
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Erro ao salvar.");
      return;
    }
    toast.success("Configuração salva.");
  };

  const patchOp = (key: GestaoNfeOperacaoKey, field: string, value: string) => {
    if (!config) return;
    const ops = { ...config.operacoes_json };
    const cur = { ...(ops[key] ?? defaultGestaoNfeOperacoes()[key]!), is_exemplo: false };
    (cur as Record<string, string>)[field] = value;
    ops[key] = cur;
    setConfig({ ...config, operacoes_json: ops });
  };

  if (loading || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-4">
        <div className="container mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Configuração fiscal (NF-e)</h1>
            <p className="text-sm text-amber-700 dark:text-amber-500">
              Configuração deve ser validada pelo contador da loja (CFOP, natureza, CST/CSOSN).
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section className="grid gap-3 sm:grid-cols-2">
          <div><Label>CNPJ</Label><Input value={config.cnpj} onChange={(e) => setConfig({ ...config, cnpj: e.target.value })} /></div>
          <div><Label>Inscrição estadual</Label><Input value={config.inscricao_estadual} onChange={(e) => setConfig({ ...config, inscricao_estadual: e.target.value })} /></div>
          <div className="sm:col-span-2">
            <Label>Regime tributário</Label>
            <Select value={config.regime_tributario || "simples_nacional"} onValueChange={(v) => setConfig({ ...config, regime_tributario: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido">Lucro presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro real</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>Razão social</Label><Input value={config.razao_social} onChange={(e) => setConfig({ ...config, razao_social: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Nome fantasia</Label><Input value={config.nome_fantasia} onChange={(e) => setConfig({ ...config, nome_fantasia: e.target.value })} /></div>
          <div><Label>Logradouro</Label><Input value={config.logradouro} onChange={(e) => setConfig({ ...config, logradouro: e.target.value })} /></div>
          <div><Label>Número</Label><Input value={config.numero} onChange={(e) => setConfig({ ...config, numero: e.target.value })} /></div>
          <div><Label>Bairro</Label><Input value={config.bairro} onChange={(e) => setConfig({ ...config, bairro: e.target.value })} /></div>
          <div><Label>Município</Label><Input value={config.municipio} onChange={(e) => setConfig({ ...config, municipio: e.target.value })} /></div>
          <div><Label>UF</Label><Input maxLength={2} value={config.uf} onChange={(e) => setConfig({ ...config, uf: e.target.value.toUpperCase() })} /></div>
          <div><Label>CEP</Label><Input value={config.cep} onChange={(e) => setConfig({ ...config, cep: e.target.value })} /></div>
        </section>

        {OP_KEYS.map((key) => {
          const op = config.operacoes_json[key] ?? defaultGestaoNfeOperacoes()[key]!;
          return (
            <section key={key} className="space-y-3 rounded-lg border p-4">
              <h2 className="font-semibold">{OP_TITLES[key]}</h2>
              {op.is_exemplo && (
                <p className="text-xs text-muted-foreground">Valores abaixo são exemplos — substitua após validação do contador.</p>
              )}
              <div><Label>Natureza da operação</Label><Input value={op.natureza_operacao} onChange={(e) => patchOp(key, "natureza_operacao", e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label>CFOP</Label><Input value={op.cfop} onChange={(e) => patchOp(key, "cfop", e.target.value)} /></div>
                <div><Label>CST ICMS</Label><Input value={op.cst_icms} onChange={(e) => patchOp(key, "cst_icms", e.target.value)} /></div>
                <div><Label>CSOSN</Label><Input value={op.csosn} onChange={(e) => patchOp(key, "csosn", e.target.value)} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Alíquota ICMS (%)</Label><Input value={op.aliquota_icms} onChange={(e) => patchOp(key, "aliquota_icms", e.target.value)} /></div>
                <div><Label>NCM</Label><Input value={op.ncm} onChange={(e) => patchOp(key, "ncm", e.target.value)} /></div>
              </div>
            </section>
          );
        })}

        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void save()}>Salvar</Button>
          <Button variant="outline" asChild>
            <Link to={withVoltarParam("/configuracoes/integracoes?foco=nfe", returnTo)}>
              Integração Focus NFe
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
