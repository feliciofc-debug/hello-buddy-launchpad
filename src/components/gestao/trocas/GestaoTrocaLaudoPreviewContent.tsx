import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import {
  GESTAO_TROCA_CHECKLIST_ITENS,
  normalizeGestaoTrocaChecklist,
} from "@/lib/gestao-troca-checklist.ts";
import type { GestaoTrocaLaudoPdfSection } from "@/lib/gestao-troca-laudo-pdf-section.ts";
import type { GestaoTrocaProcedenciaLaudo } from "@/lib/gestao-troca-procedencia-display.ts";
import type { GestaoTrocaEvento, GestaoTrocaRow } from "@/lib/gestao-troca-types.ts";
import { GestaoTrocaProcedenciaResumo } from "@/components/gestao/trocas/GestaoTrocaProcedenciaResumo.tsx";

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

type Props = {
  troca: GestaoTrocaRow;
  eventos: GestaoTrocaEvento[];
  laudo: GestaoTrocaLaudoPdfSection | null;
  procedencia: GestaoTrocaProcedenciaLaudo | null;
  finalizadoPor?: string | null;
};

export function GestaoTrocaLaudoPreviewContent({
  troca,
  eventos,
  laudo,
  procedencia,
  finalizadoPor,
}: Props) {
  const checklist = normalizeGestaoTrocaChecklist(troca.checklist_json);
  const laudoFinal = troca.laudo_status === "finalizado";

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2 text-sm">
      {laudoFinal && troca.laudo_numero && (
        <p className="rounded-md border bg-muted/40 p-2 font-medium">
          Laudo nº {troca.laudo_numero} · versão {troca.laudo_versao ?? 1}
          {finalizadoPor || troca.laudo_finalizado_em ? (
            <>
              {" "}
              · finalizado por {finalizadoPor ?? "—"} em {formatDt(troca.laudo_finalizado_em)}
            </>
          ) : null}
        </p>
      )}
      <div>
        <p className="font-semibold">Veículo</p>
        <p>
          {troca.marca} {troca.modelo} {troca.ano_modelo ?? ""} · {troca.placa ?? "—"}
        </p>
        <p className="text-muted-foreground">
          Status: {troca.status} · Semáforo: {troca.semaforo ?? "—"}
        </p>
      </div>
      <div>
        <p className="font-semibold">Preço</p>
        <p>
          Faixa verde: {formatGestaoMoney(troca.faixa_verde_min ?? 0)} –{" "}
          {formatGestaoMoney(troca.faixa_verde_max ?? 0)}
        </p>
        <p>
          Sugerido: {formatGestaoMoney(troca.valor_sugerido ?? 0)} · Teto:{" "}
          {formatGestaoMoney(troca.teto ?? 0)}
        </p>
        <p>
          Proposto: {formatGestaoMoney(troca.valor_proposto ?? 0)} · Preparação:{" "}
          {formatGestaoMoney(troca.preparacao_estimada ?? 0)}
        </p>
      </div>
      <div className="space-y-1">
        <p className="font-semibold">Procedência veicular</p>
        <GestaoTrocaProcedenciaResumo procedencia={procedencia} laudoMode />
      </div>
      <div>
        <p className="font-semibold">Checklist (itens com apontamento)</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          {GESTAO_TROCA_CHECKLIST_ITENS.filter(({ id }) => checklist[id].condicao !== "bom").map(
            ({ id, label }) => {
              const item = checklist[id];
              return (
                <li key={id}>
                  {label}: {item.condicao}
                  {item.valor_estimado ? ` (${formatGestaoMoney(item.valor_estimado)})` : ""}
                </li>
              );
            },
          )}
        </ul>
      </div>
      {laudo && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="font-semibold">Pré-análise visual por IA</p>
          <p className="text-xs text-muted-foreground">{laudo.disclaimer}</p>
          <p>
            Painel:{" "}
            {laudo.kmPainel != null ? `${laudo.kmPainel.toLocaleString("pt-BR")} km` : "—"} · Ficha:{" "}
            {laudo.kmInformado != null ? `${laudo.kmInformado.toLocaleString("pt-BR")} km` : "—"}
          </p>
          {laudo.alertaKm && (
            <p className="text-amber-700 dark:text-amber-400">
              Divergência de KM
              {laudo.kmPainelConferido ? " (conferido)" : " (não conferido)"}
            </p>
          )}
          <p>
            Luzes:{" "}
            {laudo.luzesPainel === true
              ? "sim"
              : laudo.luzesPainel === false
              ? "não identificadas"
              : "sem painel legível"}
          </p>
          {laudo.angulosFaltando.length > 0 && (
            <p>Ângulos faltando: {laudo.angulosFaltando.join(" · ")}</p>
          )}
          {laudo.resumo && <p className="text-muted-foreground">{laudo.resumo}</p>}
          <p className="font-medium">Itens confirmados</p>
          {laudo.itensConfirmados.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma avaria relevante identificada.</p>
          ) : (
            <ul className="list-disc pl-5">
              {laudo.itensConfirmados.map((item, i) => (
                <li key={i}>
                  {item.area.replace(/_/g, " ")} · {item.descricao}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {laudo.modeloIa ?? "—"} · {formatDt(laudo.analiseConcluidaEm)}
          </p>
        </div>
      )}
      <div>
        <p className="font-semibold">Linha do tempo (amostra)</p>
        <ul className="space-y-1 text-muted-foreground">
          {eventos.slice(0, 12).map((e) => (
            <li key={e.id}>
              {e.created_at.slice(0, 10)} — {e.descricao}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
