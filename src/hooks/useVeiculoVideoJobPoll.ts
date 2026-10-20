import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { VehicleMotionJobSnapshot } from "@/components/veiculos/VehicleVideoJobProgressCard";

export type EtapaMotionJob =
  | "na_fila"
  | "preparando"
  | "renderizando"
  | "enviando"
  | "concluido"
  | "erro";

type MotionJobRow = {
  id: string;
  status: string;
  titulo: string | null;
  erro_mensagem: string | null;
  metadata?: { veiculo_id?: string; library?: string; tipo?: string } | null;
  created_at?: string;
  claimed_at?: string | null;
  progresso_pct?: number | null;
  etapa?: string | null;
  progresso_atualizado_em?: string | null;
};

const STALE_MS = 10 * 60 * 1000;

function isVeiculoLibraryJob(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  return m.library === "veiculo" || m.tipo === "veiculo";
}

function isVeiculoJobFor(metadata: unknown, veiculoId: string): boolean {
  if (!isVeiculoLibraryJob(metadata)) return false;
  return String((metadata as Record<string, unknown>).veiculo_id ?? "") === veiculoId;
}

function parseEtapa(raw: unknown): EtapaMotionJob | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (
    v === "na_fila" || v === "preparando" || v === "renderizando" || v === "enviando"
    || v === "concluido" || v === "erro"
  ) return v;
  return null;
}

function heartbeatMs(job: MotionJobRow): number {
  const t = job.progresso_atualizado_em || job.claimed_at || job.created_at;
  return t ? new Date(t).getTime() : 0;
}

function estimateEta(elapsedSec: number, pct: number): number | null {
  if (pct < 8 || elapsedSec < 20) return null;
  const total = elapsedSec / (pct / 100);
  const rest = Math.round(total - elapsedSec);
  return rest > 0 ? rest : null;
}

export type VeiculoJobFinishedInfo = {
  jobId: string;
  veiculoId?: string;
  titulo?: string | null;
};

export function useVeiculoVideoJobPoll(
  veiculoId: string | undefined,
  watchJobId: string | null,
  onJobFinished: (info: VeiculoJobFinishedInfo) => void,
) {
  const [trackedJob, setTrackedJob] = useState<VehicleMotionJobSnapshot | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const sessionActiveJobRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from("video_motion_jobs")
        .select(
          "id, status, titulo, erro_mensagem, metadata, created_at, claimed_at, progresso_pct, etapa, progresso_atualizado_em",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelled) return;

      const vehicleJobs = ((data ?? []) as MotionJobRow[]).filter((j) =>
        isVeiculoLibraryJob(j.metadata),
      );

      const watched = watchJobId
        ? vehicleJobs.find((j) => j.id === watchJobId)
        : null;

      const forSelected = veiculoId
        ? vehicleJobs.find((j) =>
          isVeiculoJobFor(j.metadata, veiculoId)
          && (j.status === "pendente" || j.status === "processando"),
        )
        : null;

      const anyActive = vehicleJobs.find((j) =>
        j.status === "pendente" || j.status === "processando",
      );

      const current = watched ?? forSelected ?? anyActive ?? null;

      if (current && (current.status === "pendente" || current.status === "processando")) {
        sessionActiveJobRef.current = current.id;
      }

      if (current) {
        const now = Date.now();
        const started = new Date(current.claimed_at || current.created_at || now).getTime();
        const elapsed_sec = Math.max(0, Math.round((now - started) / 1000));
        const pct = current.progresso_pct ?? 0;
        const hb = heartbeatMs(current);
        const stale = current.status === "processando"
          && hb > 0
          && now - hb > STALE_MS;

        let posicao_fila: number | null = null;
        if (current.status === "pendente") {
          const { data: pos } = await supabase.rpc("video_motion_fila_posicao", {
            p_job_id: current.id,
          });
          posicao_fila = typeof pos === "number" ? pos : null;
        }

        setTrackedJob({
          id: current.id,
          status: current.status,
          titulo: current.titulo,
          erro_mensagem: current.erro_mensagem,
          etapa: parseEtapa(current.etapa) ?? (current.status === "pendente" ? "na_fila" : "renderizando"),
          progresso_pct: pct,
          posicao_fila,
          elapsed_sec,
          eta_sec: estimateEta(elapsed_sec, pct),
          stale,
        });
      } else {
        setTrackedJob(null);
      }

      const terminal = current && ["concluido", "falha", "falha_definitiva"].includes(
        current.status,
      );
      if (!current || !terminal || notifiedRef.current.has(current.id)) return;

      const shouldNotify = current.id === watchJobId
        || current.id === sessionActiveJobRef.current;
      if (!shouldNotify) return;

      notifiedRef.current.add(current.id);
      sessionActiveJobRef.current = null;

      const finishedVeiculoId = String(current.metadata?.veiculo_id ?? "") || undefined;

      if (current.status === "concluido") {
        onJobFinished({
          jobId: current.id,
          veiculoId: finishedVeiculoId,
          titulo: current.titulo,
        });
      } else {
        toast.error(current.erro_mensagem || "Não foi possível renderizar o vídeo.");
        onJobFinished({
          jobId: current.id,
          veiculoId: finishedVeiculoId,
          titulo: current.titulo,
        });
      }
    };

    void tick();
    const interval = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [veiculoId, watchJobId, onJobFinished]);

  return { trackedJob };
}
