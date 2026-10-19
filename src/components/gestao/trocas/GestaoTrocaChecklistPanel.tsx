import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import {
  GESTAO_TROCA_CHECKLIST_ITENS,
  normalizeGestaoTrocaChecklist,
  somaPreparacaoChecklist,
  type GestaoTrocaChecklistJson,
} from "@/lib/gestao-troca-checklist.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { parseGestaoMoneyBr } from "@/lib/gestao-money.ts";

type Props = {
  value: GestaoTrocaChecklistJson | Record<string, unknown>;
  preparacaoManual: number;
  onChecklistChange: (checklist: GestaoTrocaChecklistJson, preparacaoSugerida: number) => void;
  onPreparacaoChange: (preparacao: number) => void;
  disabled?: boolean;
};

const REPAROS = [
  { id: "funilaria", label: "Funilaria" },
  { id: "pintura", label: "Pintura" },
  { id: "troca", label: "Troca" },
  { id: "reparo", label: "Reparo" },
] as const;

export function GestaoTrocaChecklistPanel({
  value,
  preparacaoManual,
  onChecklistChange,
  onPreparacaoChange,
  disabled,
}: Props) {
  const checklist = useMemo(() => normalizeGestaoTrocaChecklist(value), [value]);
  const soma = useMemo(() => somaPreparacaoChecklist(checklist), [checklist]);

  const patchItem = (
    id: string,
    patch: Partial<GestaoTrocaChecklistJson[string]>,
  ) => {
    const next = { ...checklist, [id]: { ...checklist[id], ...patch } };
    if (next[id].condicao === "bom") {
      next[id] = { condicao: "bom", reparo: null, valor_estimado: null };
    }
    onChecklistChange(next, somaPreparacaoChecklist(next));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Soma dos itens Regular/Ruim: {formatGestaoMoney(soma)} (atualiza preparação ao salvar)
      </p>
      <div className="space-y-2">
        {GESTAO_TROCA_CHECKLIST_ITENS.map(({ id, label }) => {
          const item = checklist[id];
          const showExtra = item.condicao === "regular" || item.condicao === "ruim";
          return (
            <div
              key={id}
              className="grid gap-2 rounded border p-2 sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <span className="text-sm font-medium">{label}</span>
              <Select
                value={item.condicao}
                onValueChange={(v) =>
                  patchItem(id, { condicao: v as "bom" | "regular" | "ruim" })}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bom">Bom</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="ruim">Ruim</SelectItem>
                </SelectContent>
              </Select>
              {showExtra ? (
                <>
                  <Select
                    value={item.reparo ?? ""}
                    onValueChange={(v) => patchItem(id, { reparo: v as typeof REPAROS[number]["id"] })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 w-[120px]">
                      <SelectValue placeholder="Reparo" />
                    </SelectTrigger>
                    <SelectContent>
                      {REPAROS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <GestaoMoneyInput
                    label=""
                    className="min-w-[120px]"
                    value={String(item.valor_estimado ?? "")}
                    onChange={(v) => {
                      const n = parseGestaoMoneyBr(v);
                      patchItem(id, { valor_estimado: n != null && n > 0 ? n : null });
                    }}
                  />
                </>
              ) : (
                <span className="col-span-2 text-xs text-muted-foreground sm:col-span-2">—</span>
              )}
            </div>
          );
        })}
      </div>
      <div>
        <Label>Preparação estimada (editável)</Label>
        <GestaoMoneyInput
          label=""
          value={String(preparacaoManual)}
          onChange={(v) => onPreparacaoChange(parseGestaoMoneyBr(v) ?? 0)}
        />
      </div>
    </div>
  );
}
