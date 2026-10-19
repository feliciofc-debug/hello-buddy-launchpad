import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  classificarEspessuraMap,
  DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
  gestaoTrocaEspessuraClassificacaoLabel,
  GESTAO_TROCA_ESPESSURA_PAINEIS,
  parseGestaoTrocaEspessuraJson,
  type GestaoTrocaEspessuraFaixas,
} from "@/lib/gestao-troca-espessura.ts";

type Props = {
  value: unknown;
  disabled?: boolean;
  faixas?: GestaoTrocaEspessuraFaixas;
  onChange: (next: Record<string, number | null>) => void;
};

function espessuraCorClass(cor: "verde" | "amarelo" | "vermelho" | "muted"): string {
  if (cor === "verde") return "text-emerald-700 dark:text-emerald-400";
  if (cor === "amarelo") return "text-amber-700 dark:text-amber-400";
  if (cor === "vermelho") return "text-red-700 dark:text-red-400";
  return "text-muted-foreground";
}

export function GestaoTrocaEspessuraCard({
  value,
  disabled,
  faixas = DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
  onChange,
}: Props) {
  const parsed = parseGestaoTrocaEspessuraJson(value);
  const [draftText, setDraftText] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const { id } of GESTAO_TROCA_ESPESSURA_PAINEIS) {
      next[id] = parsed[id] != null ? String(parsed[id]) : "";
    }
    setDraftText(next);
    setErrors({});
  }, [value]);

  const cls = classificarEspessuraMap(
    Object.fromEntries(
      GESTAO_TROCA_ESPESSURA_PAINEIS.map(({ id }) => {
        const raw = draftText[id]?.trim();
        if (!raw) return [id, undefined];
        const n = Number(raw);
        return [id, Number.isFinite(n) ? n : undefined];
      }),
    ) as Partial<Record<string, number>>,
    faixas,
  );

  const commitPainel = (id: string) => {
    const raw = (draftText[id] ?? "").trim();
    const next = { ...parsed };
    if (!raw) {
      delete next[id as keyof typeof next];
      setErrors((e) => ({ ...e, [id]: "" }));
      onChange(next);
      return;
    }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 20 || n > 2000) {
      setErrors((e) => ({ ...e, [id]: "Informe um inteiro entre 20 e 2000 µm." }));
      return;
    }
    setErrors((e) => ({ ...e, [id]: "" }));
    next[id as keyof typeof next] = n;
    onChange(next);
  };

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
      <h2 className="font-semibold">Espessura de pintura (µm)</h2>
      <p className="text-xs text-muted-foreground">
        Medição manual com medidor. Salva ao sair do campo. Original ≤{faixas.original_max} · Repintura
        provável ≤{faixas.repintura_max} · Massa provável &gt;{faixas.repintura_max}.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {GESTAO_TROCA_ESPESSURA_PAINEIS.map(({ id, label }) => {
          const { rotulo, cor } = gestaoTrocaEspessuraClassificacaoLabel(cls[id]);
          return (
            <div key={id}>
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                min={20}
                max={2000}
                step={1}
                disabled={disabled}
                placeholder="—"
                value={draftText[id] ?? ""}
                onChange={(e) =>
                  setDraftText((d) => ({ ...d, [id]: e.target.value }))}
                onBlur={() => commitPainel(id)}
              />
              {errors[id] ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors[id]}</p>
              ) : cls[id] !== "nao_medido" ? (
                <p className={`text-xs ${espessuraCorClass(cor)}`}>{rotulo}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
