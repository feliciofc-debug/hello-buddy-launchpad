import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { parseGestaoMoneyBr } from "@/lib/gestao-money.ts";
import { GESTAO_TROCA_FOTO_ETIQUETAS } from "@/lib/gestao-troca-fotos.ts";
import {
  fetchLatestGestaoTrocaLaudo,
  invokeGestaoTrocaAnalisarFotos,
  invokeGestaoTrocaConfirmarKm,
  invokeGestaoTrocaDecidirItemIa,
  invokeGestaoTrocaStatusAnalise,
} from "@/lib/gestao-troca-ia-api.ts";
import { humanizeGestaoTrocaIaErro } from "@/lib/gestao-troca-ia-erro.ts";
import {
  GESTAO_TROCA_IA_DISCLAIMER,
  type GestaoTrocaIaAnalise,
  type GestaoTrocaIaItem,
} from "@/lib/gestao-troca-ia-types.ts";

const POLL_MS = 5000;
const POLL_MAX_MS = 4 * 60 * 1000;

const ANGULOS_PADRAO = GESTAO_TROCA_FOTO_ETIQUETAS.filter(
  (e) => e !== "Documento (CRLV)" && e !== "Outra",
);

function labelCampo(raw: string): string {
  return raw.replace(/_/g, " ");
}

type Props = {
  trocaId: string;
  kmFicha: number | null;
  kmPainelConferido: boolean;
  disabled?: boolean;
  onKmConferido?: () => void;
  onPreparacaoChange?: (preparacao: number) => void;
  onLaudoState?: (state: { alertaKm: boolean; kmConferido: boolean }) => void;
};

export function GestaoTrocaLaudoIaPanel({
  trocaId,
  kmFicha,
  kmPainelConferido,
  disabled,
  onKmConferido,
  onPreparacaoChange,
  onLaudoState,
}: Props) {
  const [analise, setAnalise] = useState<GestaoTrocaIaAnalise | null>(null);
  const [itens, setItens] = useState<GestaoTrocaIaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [valorDraft, setValorDraft] = useState<Record<string, string>>({});
  const pollStarted = useRef<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setPolling(false);
    pollStarted.current = null;
  }, []);

  const applyLaudo = useCallback(
    (nextAnalise: GestaoTrocaIaAnalise | null, nextItens: GestaoTrocaIaItem[]) => {
      setAnalise(nextAnalise);
      setItens(nextItens);
      onLaudoState?.({
        alertaKm: nextAnalise?.alerta_km === true,
        kmConferido: kmPainelConferido,
      });
    },
    [kmPainelConferido, onLaudoState],
  );

  const refresh = useCallback(async () => {
    const { analise: a, itens: list } = await fetchLatestGestaoTrocaLaudo(trocaId);
    applyLaudo(a, list);
    return a;
  }, [applyLaudo, trocaId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    onLaudoState?.({
      alertaKm: analise?.alerta_km === true,
      kmConferido: kmPainelConferido,
    });
  }, [analise?.alerta_km, kmPainelConferido, onLaudoState]);

  useEffect(() => {
    const paths = new Set<string>();
    for (const item of itens) {
      if (item.foto_path) paths.add(item.foto_path);
    }
    for (const q of analise?.qualidade_json ?? []) {
      if (q.path && q.etiqueta !== "Documento (CRLV)") paths.add(q.path);
    }
    if (!paths.size) return;
    void (async () => {
      const next: Record<string, string> = {};
      for (const path of paths) {
        const { data } = await supabase.storage.from("trocas").createSignedUrl(path, 3600);
        if (data?.signedUrl) next[path] = data.signedUrl;
      }
      setThumbUrls(next);
    })();
  }, [analise?.qualidade_json, itens]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (analiseId: string) => {
      stopPolling();
      setPolling(true);
      pollStarted.current = Date.now();
      pollTimer.current = setInterval(() => {
        void (async () => {
          if (pollStarted.current && Date.now() - pollStarted.current > POLL_MAX_MS) {
            stopPolling();
            toast.error("Tempo máximo de análise atingido (4 min).");
            return;
          }
          const { analise: a, itens: list } = await invokeGestaoTrocaStatusAnalise(analiseId);
          if (!a) return;
          applyLaudo(a, list);
          if (a.status !== "processando") {
            stopPolling();
            if (a.status === "concluida") toast.success("Laudo IA concluído.");
            else if (a.status === "rejeitada") {
              toast.error("Análise rejeitada. Revise as fotos e tente novamente.");
            } else if (a.status === "erro") {
              toast.error(humanizeGestaoTrocaIaErro(a.erro));
            }
          }
        })();
      }, POLL_MS);
    },
    [applyLaudo, stopPolling],
  );

  useEffect(() => {
    if (analise?.status === "processando" && analise.id && !polling) {
      startPolling(analise.id);
    }
  }, [analise?.id, analise?.status, polling, startPolling]);

  const iniciarAnalise = async () => {
    setBusy(true);
    const { analise_id, error } = await invokeGestaoTrocaAnalisarFotos(trocaId);
    setBusy(false);
    if (error || !analise_id) {
      toast.error(error ?? "Não foi possível iniciar.");
      return;
    }
    toast.message("Analisando… pode levar até 2 min.");
    await invokeGestaoTrocaStatusAnalise(analise_id).then(({ analise: a, itens: list }) => {
      applyLaudo(a, list);
    });
    startPolling(analise_id);
  };

  const confirmarKm = async () => {
    setBusy(true);
    const r = await invokeGestaoTrocaConfirmarKm(trocaId);
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "Falha.");
      return;
    }
    toast.success("KM do painel conferido.");
    onKmConferido?.();
    onLaudoState?.({ alertaKm: analise?.alerta_km === true, kmConferido: true });
  };

  const decidir = async (item: GestaoTrocaIaItem, decisao: "confirmado" | "descartado") => {
    let valorFinal: number | null | undefined;
    if (decisao === "confirmado" && item.tipo !== "luz_alerta") {
      const raw = valorDraft[item.id] ?? String(item.valor_estimado ?? "");
      valorFinal = parseGestaoMoneyBr(raw);
      if (valorFinal == null && item.valor_estimado != null) {
        valorFinal = item.valor_estimado;
      }
    }
    if (decisao === "confirmado" && item.tipo === "luz_alerta") {
      valorFinal = null;
    }
    setBusy(true);
    const r = await invokeGestaoTrocaDecidirItemIa({
      item_id: item.id,
      decisao,
      valor_final: valorFinal,
    });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "Falha.");
      return;
    }
    if (r.preparacao_estimada != null) onPreparacaoChange?.(r.preparacao_estimada);
    await refresh();
  };

  const angulosFaltando = useMemo(() => {
    const present = new Set(
      (analise?.qualidade_json ?? []).filter((q) => q.usada).map((q) => q.etiqueta),
    );
    const missing = ANGULOS_PADRAO.filter((a) => !present.has(a));
    if (analise?.aviso_carroceria && missing.length === 0) {
      return ["Cobertura externa insuficiente (frente, traseira ou laterais)"];
    }
    return missing;
  }, [analise?.aviso_carroceria, analise?.qualidade_json]);

  const qualidadeProblemas = useMemo(
    () => (analise?.qualidade_json ?? []).filter((q) => !q.usada || q.motivo_skip),
    [analise?.qualidade_json],
  );

  const pendentes = itens.filter((i) => i.decisao === "pendente");
  const analisando = analise?.status === "processando" || polling;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{GESTAO_TROCA_IA_DISCLAIMER}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => void iniciarAnalise()}
          disabled={disabled || busy || analisando}
        >
          {analisando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" /> Analisar fotos com IA
            </>
          )}
        </Button>
        {analisando && (
          <span className="text-xs text-muted-foreground">Analisando… pode levar até 2 min</span>
        )}
      </div>

      {(analise?.status === "erro" || analise?.status === "rejeitada") && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {analise.status === "rejeitada"
            ? "A análise foi rejeitada. Verifique a qualidade das fotos e inicie novamente."
            : humanizeGestaoTrocaIaErro(analise.erro)}
        </div>
      )}

      {analise && analise.status === "processando" && (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Análise em andamento… a lista de itens será atualizada automaticamente.
        </div>
      )}

      {analise && analise.status !== "processando" && analise.status !== "rejeitada" && (
        <>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Quilometragem</p>
            <p>
              Painel: {analise.km_painel_lido != null ? `${analise.km_painel_lido.toLocaleString("pt-BR")} km` : "—"}
              {" · "}
              Informado: {kmFicha != null ? `${kmFicha.toLocaleString("pt-BR")} km` : "—"}
            </p>
            {analise.alerta_km && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>KM do painel diverge do informado na ficha.</span>
                {!kmPainelConferido && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void confirmarKm()}>
                    Km conferido
                  </Button>
                )}
                {kmPainelConferido && (
                  <span className="text-xs text-muted-foreground">Conferência registrada.</span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-md border p-2">
              <p className="font-medium">Luzes de alerta no painel</p>
              <p className="text-muted-foreground">
                {analise.luzes_painel === true
                  ? "Sim — verificar diagnóstico"
                  : analise.luzes_painel === false
                  ? "Não identificadas"
                  : "Sem foto de painel legível"}
              </p>
            </div>
            <div className="rounded-md border p-2">
              <p className="font-medium">Qualidade das fotos</p>
              {qualidadeProblemas.length === 0 ? (
                <p className="text-muted-foreground">Todas as fotos usadas na análise.</p>
              ) : (
                <ul className="list-disc pl-4 text-muted-foreground">
                  {qualidadeProblemas.slice(0, 8).map((q) => (
                    <li key={q.path}>
                      {q.etiqueta}
                      {q.motivo_skip ? ` (${q.motivo_skip.replace(/_/g, " ")})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {angulosFaltando.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <p className="font-medium">Ângulos faltando</p>
              <p className="text-muted-foreground">{angulosFaltando.join(" · ")}</p>
            </div>
          )}

          {analise.resumo && (
            <p className="text-sm text-muted-foreground">{analise.resumo}</p>
          )}

          <div className="space-y-2">
            <p className="font-medium text-sm">
              Itens sugeridos ({pendentes.length} pendente{pendentes.length === 1 ? "" : "s"})
            </p>
            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item detectado.</p>
            ) : (
              <ul className="space-y-3">
                {itens.map((item) => {
                  const thumb = item.foto_path ? thumbUrls[item.foto_path] : undefined;
                  const valorKey = item.id;
                  const isLuz = item.tipo === "luz_alerta";
                  const valorStr = valorDraft[valorKey] ?? String(item.valor_estimado ?? "");
                  const decided = item.decisao !== "pendente";
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="h-16 w-24 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                          Sem foto
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium">
                          {labelCampo(item.area)} · {labelCampo(item.tipo)} · {item.gravidade}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Confiança: {item.confianca}
                          {isLuz
                            ? " · Sem valor — verificar diagnóstico"
                            : item.valor_estimado != null
                            ? ` · Sugerido: ${formatGestaoMoney(item.valor_estimado)}`
                            : " · Verificar pessoalmente"}
                        </p>
                        <p className="text-sm">{item.descricao}</p>
                        {item.decisao === "confirmado" && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">Confirmado</p>
                        )}
                        {item.decisao === "descartado" && (
                          <p className="text-xs text-muted-foreground">Descartado</p>
                        )}
                        {!decided && (
                          <div className="flex flex-wrap items-end gap-2 pt-1">
                            {!isLuz && (
                              <div className="min-w-[140px] flex-1">
                                <GestaoMoneyInput
                                  label="Valor ao confirmar"
                                  value={valorStr}
                                  onChange={(v) =>
                                    setValorDraft((d) => ({ ...d, [valorKey]: v }))}
                                />
                              </div>
                            )}
                            <Button
                              size="sm"
                              disabled={disabled || busy}
                              onClick={() => void decidir(item, "confirmado")}
                            >
                              <Check className="mr-1 h-4 w-4" /> Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={disabled || busy}
                              onClick={() => void decidir(item, "descartado")}
                            >
                              <X className="mr-1 h-4 w-4" /> Descartar
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
