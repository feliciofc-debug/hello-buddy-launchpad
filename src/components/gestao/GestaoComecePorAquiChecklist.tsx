import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { loadGestaoVendedores } from "@/lib/gestao-equipe-load.ts";
import { gestaoLucroUrl } from "@/lib/gestao-nav.ts";

const STORAGE_KEY = "gestao_checklist_collapsed";

type Props = {
  userId: string;
  veiculos: GestaoVeiculoEnriched[];
  focusConnected: boolean;
  zapsignConnected: boolean;
  onRegistrarVenda: () => void;
  onOpenEstoque: () => void;
};

export function GestaoComecePorAquiChecklist({
  userId,
  veiculos,
  focusConnected,
  zapsignConnected,
  onRegistrarVenda,
  onOpenEstoque,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [vendedoresCount, setVendedoresCount] = useState(0);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    void loadGestaoVendedores(userId).then((v) => setVendedoresCount(v.length));
  }, [userId]);

  const temCompra = veiculos.some((v) => v.valorCompra != null && v.valorCompra > 0);
  const temVenda = veiculos.some((v) => v.dataVenda != null);

  const items = useMemo(() => [
    {
      id: "compra",
      done: temCompra,
      label: "Cadastrar valores de compra nos carros",
      action: <Button size="sm" variant="outline" onClick={onOpenEstoque}>Abrir estoque</Button>,
    },
    {
      id: "venda",
      done: temVenda,
      label: "Registrar uma venda",
      action: <Button size="sm" onClick={onRegistrarVenda}>Registrar venda</Button>,
    },
    {
      id: "nfe",
      done: focusConnected,
      label: "Conectar emissão de NF-e (Focus)",
      action: (
        <Button size="sm" variant="outline" asChild>
          <Link to="/configuracoes/integracoes">Conectar NF-e</Link>
        </Button>
      ),
    },
    {
      id: "contratos",
      done: zapsignConnected,
      label: "Conectar contratos (ZapSign)",
      action: (
        <Button size="sm" variant="outline" asChild>
          <Link to="/configuracoes/integracoes">Conectar contratos</Link>
        </Button>
      ),
    },
    {
      id: "vendedores",
      done: vendedoresCount > 0,
      label: "Cadastrar vendedores",
      action: (
        <Button size="sm" variant="outline" asChild>
          <Link to={gestaoLucroUrl("equipe")}>Equipe</Link>
        </Button>
      ),
    },
  ], [temCompra, temVenda, focusConnected, zapsignConnected, vendedoresCount, onOpenEstoque, onRegistrarVenda]);

  const allDone = items.every((i) => i.done);
  if (allDone) return null;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Comece por aqui</CardTitle>
        <Button variant="ghost" size="sm" onClick={toggle}>
          {collapsed ? "Expandir" : "Recolher"}
          {collapsed ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronUp className="ml-1 h-4 w-4" />}
        </Button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/80 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${item.done ? "bg-emerald-500/20 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {item.done ? <Check className="h-4 w-4" /> : "·"}
                </span>
                <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
              </div>
              {!item.done && item.action}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
