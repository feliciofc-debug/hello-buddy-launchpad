import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  classificarEspessuraMap,
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

export function GestaoTrocaEspessuraCard({ value, disabled, faixas, onChange }: Props) {
  const parsed = parseGestaoTrocaEspessuraJson(value);
  const cls = classificarEspessuraMap(parsed, faixas);

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
      <h2 className="font-semibold">Espessura de pintura (µm)</h2>
      <p className="text-xs text-muted-foreground">
        Medição manual com medidor. Vazio = não medido. Original ≤180 · repintura 181–300 · massa &gt;300 (configurável).
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {GESTAO_TROCA_ESPESSURA_PAINEIS.map(({ id, label }) => (
          <div key={id}>
            <Label className="text-xs">{label}</Label>
            <Input
              type="number"
              min={0}
              disabled={disabled}
              placeholder="—"
              value={parsed[id] ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                const next = { ...parsed };
                if (!raw) delete next[id];
                else next[id] = Number(raw);
                onChange(next);
              }}
            />
            {cls[id] !== "nao_medido" && (
              <p className="text-xs text-muted-foreground">{cls[id]}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
