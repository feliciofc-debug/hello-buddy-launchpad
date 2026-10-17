import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GestaoHelpTip } from "@/components/gestao/GestaoHelpTip.tsx";
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
  onConnectNfe: () => void;
  onConnectContratos: () => void;
};

export function GestaoComecePorAquiChecklist({
  userId,
  veiculos,
  focusConnected,
  zapsignConnected,
  onRegistrarVenda,
  onOpenEstoque,
  onConnectNfe,
  onConnectContratos,
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

  const totalCarros = veiculos.length;
  const comCompra = veiculos.filter((v) => v.valorCompra != null && v.valorCompra > 0).length;
  const temVenda = veiculos.some((v) => v.dataVenda != null);

  const items = useMemo(
    () => [
      {
        id: "nfe",
        done: focusConnected,
        once: true,
        title: "Ativar emissão de nota fiscal",
        help: "Emita a nota da venda com 1 clique. Certificado digital fica na Focus NFe.",
        progress: focusConnected ? "✓ Ativado" : null,
        action: focusConnected ? null : (
          <Button size="sm" variant="outline" onClick={onConnectNfe}>
            Conectar NF-e
          </Button>
        ),
      },
      {
        id: "contratos",
        done: zapsignConnected,
        once: true,
        title: "Ativar contratos com assinatura no celular",
        help: "O cliente assina pelo celular, sem papel (ZapSign).",
        progress: zapsignConnected ? "✓ Ativado" : null,
        action: zapsignConnected ? null : (
          <Button size="sm" variant="outline" onClick={onConnectContratos}>
            Conectar contratos
          </Button>
        ),
      },
      {
        id: "compra",
        done: totalCarros > 0 && comCompra === totalCarros,
        once: false,
        title: "Informar quanto pagou em cada carro",
        help: "Para ver o lucro de cada venda.",
        progress:
          totalCarros === 0
            ? "Nenhum carro no estoque ainda"
            : `✓ ${comCompra} de ${totalCarros} carros com valor de compra`,
        action: (
          <Button size="sm" variant="outline" onClick={onOpenEstoque}>
            Completar
          </Button>
        ),
      },
      {
        id: "venda",
        done: temVenda,
        once: false,
        title: "Registrar uma venda",
        help: "Seu faturamento e lucro aparecem na hora.",
        progress: temVenda ? "✓ Pelo menos uma venda registrada" : null,
        action: (
          <Button size="sm" onClick={onRegistrarVenda}>
            Registrar venda
          </Button>
        ),
      },
      {
        id: "vendedores",
        done: vendedoresCount > 0,
        once: false,
        title: "Cadastrar vendedores",
        help: "Para calcular comissões e ranking.",
        progress:
          vendedoresCount > 0
            ? `✓ ${vendedoresCount} vendedor${vendedoresCount === 1 ? "" : "es"} cadastrado${vendedoresCount === 1 ? "" : "s"}`
            : null,
        action: (
          <Button size="sm" variant="outline" asChild>
            <Link to={gestaoLucroUrl("equipe")}>+ Adicionar vendedor</Link>
          </Button>
        ),
      },
    ],
    [
      focusConnected,
      zapsignConnected,
      totalCarros,
      comCompra,
      temVenda,
      vendedoresCount,
      onOpenEstoque,
      onRegistrarVenda,
      onConnectNfe,
      onConnectContratos,
    ],
  );

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
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/80 px-3 py-2"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      item.done ? "bg-emerald-500/20 text-emerald-700" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.done ? <Check className="h-4 w-4" /> : "·"}
                  </span>
                  <span>{item.title}</span>
                  <GestaoHelpTip text={item.help} />
                </div>
                {item.progress && (
                  <p
                    className={`pl-8 text-xs ${
                      item.once && item.done ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                    }`}
                  >
                    {item.progress}
                  </p>
                )}
              </div>
              {item.action}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
