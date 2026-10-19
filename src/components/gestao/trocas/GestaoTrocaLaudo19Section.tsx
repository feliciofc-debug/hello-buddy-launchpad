import { gestaoTrocaIaDescricaoIcon } from "@/lib/gestao-troca-ia-descricao-display.ts";
import {
  classificarEspessuraMap,
  DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
  gestaoTrocaEspessuraClassificacaoLabel,
  GESTAO_TROCA_ESPESSURA_PAINEIS,
  parseGestaoTrocaEspessuraJson,
  type GestaoTrocaEspessuraFaixas,
} from "@/lib/gestao-troca-espessura.ts";
import {
  GESTAO_TROCA_INDICIO_COLISAO_DISCLAIMER,
  type GestaoTrocaLaudo19Computed,
} from "@/lib/gestao-troca-laudo-19.ts";
import { GESTAO_TROCA_ROTEIRO_SLOTS } from "@/lib/gestao-troca-roteiro.ts";
import { resumoAreaIcon } from "@/lib/gestao-troca-laudo-foto-display.ts";
import type { GestaoTrocaIaFotoAnaliseRow } from "../../supabase/functions/_shared/gestao-troca-ia-foto-schema.ts";

function espessuraCorClass(cor: "verde" | "amarelo" | "vermelho" | "muted"): string {
  if (cor === "verde") return "text-emerald-700 dark:text-emerald-400";
  if (cor === "amarelo") return "text-amber-700 dark:text-amber-400";
  if (cor === "vermelho") return "text-red-700 dark:text-red-400";
  return "text-muted-foreground";
}

type Props = {
  computed: GestaoTrocaLaudo19Computed;
  espessuraRaw: unknown;
  faixas?: GestaoTrocaEspessuraFaixas;
  thumbUrls?: Record<string, string>;
};

function achadoIcon(severidade: string): string {
  if (severidade === "grave") return gestaoTrocaIaDescricaoIcon("alteracao_grave");
  if (severidade === "moderada") return gestaoTrocaIaDescricaoIcon("alteracao_moderada");
  return gestaoTrocaIaDescricaoIcon("alteracao_leve");
}

function slotLabel(slot: string): string {
  const def = GESTAO_TROCA_ROTEIRO_SLOTS.find((s) => s.id === slot);
  return def?.label ?? slot.replace(/_/g, " ");
}

function FotoRowCard({
  row,
  thumb,
}: {
  row: GestaoTrocaIaFotoAnaliseRow;
  thumb?: string;
}) {
  const mismatch = row.slot_identificado &&
    String(row.slot_identificado) !== String(row.slot_informado);
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row">
      {thumb ? (
        <img src={thumb} alt="" className="h-20 w-28 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
          Foto #{row.indice}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="font-medium">
          #{row.indice} · {slotLabel(String(row.slot_informado))} · qualidade {row.qualidade_imagem}
        </p>
        {mismatch && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Foto do slot {slotLabel(String(row.slot_informado))} parece ser{" "}
            {slotLabel(String(row.slot_identificado))}
          </p>
        )}
        <p className="text-muted-foreground">{row.descricao}</p>
        {row.achados.length > 0 && (
          <ul className="list-none space-y-1 text-xs">
            {row.achados.map((a, i) => (
              <li key={i}>
                {achadoIcon(a.severidade)} {a.tipo.replace(/_/g, " ")} ({a.local}) — {a.evidencia}
                <span className="text-muted-foreground"> · conf. {a.confianca}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function GestaoTrocaLaudo19Section({
  computed,
  espessuraRaw,
  faixas = DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
  thumbUrls = {},
}: Props) {
  const esp = parseGestaoTrocaEspessuraJson(espessuraRaw);
  const espCls = classificarEspessuraMap(esp, faixas);

  return (
    <div className="space-y-4">
      <div className="rounded-md border-2 p-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Resultado do laudo</p>
        <p className="text-base font-semibold">{computed.resultado.rotulo}</p>
        <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
          {computed.resultado.motivos.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>

      {computed.resumo_por_area.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-sm">Resumo por área</p>
          <ul className="space-y-1 text-sm">
            {computed.resumo_por_area.map((r) => {
              const fotos = r.fotos.length ? ` · fotos ${r.fotos.map((n) => `#${n}`).join(", ")}` : "";
              return (
                <li key={r.area}>
                  {resumoAreaIcon(r.condicao)} {r.area.replace(/_/g, " ")}: {r.texto || r.condicao}
                  {fotos}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-2 rounded-md border p-3 text-sm">
        <p className="font-medium">Indício de colisão (visual)</p>
        <p className="text-xs text-muted-foreground">{GESTAO_TROCA_INDICIO_COLISAO_DISCLAIMER}</p>
        {Object.entries(computed.indicio_colisao).every(([, v]) => v.nivel === "nenhum") ? (
          <p className="text-muted-foreground">Nenhum indício por região.</p>
        ) : (
          <ul className="list-disc pl-5">
            {Object.entries(computed.indicio_colisao).map(([reg, data]) =>
              data.nivel === "nenhum" ? null : (
                <li key={reg}>
                  {reg.replace(/_/g, " ")}: <strong>{data.nivel}</strong>
                  {data.evidencias.slice(0, 2).map((ev, i) => (
                    <span key={i} className="block text-xs text-muted-foreground">
                      {ev.texto}
                    </span>
                  ))}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-medium text-sm">Espessura de pintura (µm)</p>
        <p className="text-xs text-muted-foreground">
          Original ≤{faixas.original_max} · Repintura provável ≤{faixas.repintura_max} · Massa
          provável &gt;{faixas.repintura_max}
        </p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {GESTAO_TROCA_ESPESSURA_PAINEIS.map((p) => {
            const v = esp[p.id];
            if (v == null) return null;
            const { rotulo, cor } = gestaoTrocaEspessuraClassificacaoLabel(espCls[p.id]);
            return (
              <li key={p.id}>
                {p.label}: {v} µm —{" "}
                <span className={espessuraCorClass(cor)}>{rotulo}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-sm">Análise foto a foto</p>
        <ul className="space-y-2">
          {computed.fotoRows.map((row) => (
            <FotoRowCard
              key={row.indice}
              row={row}
              thumb={row.path ? thumbUrls[row.path] : undefined}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
