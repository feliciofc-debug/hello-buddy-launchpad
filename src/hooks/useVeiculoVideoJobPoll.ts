import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { VehicleMotionJobSnapshot } from "@/components/veiculos/VehicleVideoJobProgressCard";

type MotionJobRow = VehicleMotionJobSnapshot & {
  metadata?: { veiculo_id?: string; library?: string; tipo?: string } | null;
  created_at?: string;
};

function isVeiculoJobFor(metadata: unknown, veiculoId: string): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  if (m.library !== "veiculo" && m.tipo !== "veiculo") return false;
  return String(m.veiculo_id ?? "") === veiculoId;
}

export function useVeiculoVideoJobPoll(
  veiculoId: string | undefined,
  watchJobId: string | null,
  onJobFinished: () => void,
) {
  const [trackedJob, setTrackedJob] = useState<VehicleMotionJobSnapshot | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const sessionActiveJobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!veiculoId) {
      setTrackedJob(null);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from("video_motion_jobs")
        .select("id, status, titulo, erro_mensagem, metadata, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);

      if (cancelled) return;

      const vehicleJobs = ((data ?? []) as MotionJobRow[]).filter((j) =>
        isVeiculoJobFor(j.metadata, veiculoId),
      );

      const active = vehicleJobs.find((j) =>
        j.status === "pendente" || j.status === "processando",
      );
      if (active) sessionActiveJobRef.current = active.id;

      const watched = watchJobId
        ? vehicleJobs.find((j) => j.id === watchJobId)
        : null;
      const current = watched ?? active ?? null;

      if (current) {
        setTrackedJob({
          id: current.id,
          status: current.status,
          titulo: current.titulo,
          erro_mensagem: current.erro_mensagem,
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

      if (current.status === "concluido") {
        toast.success("Vídeo pronto! Está na grade abaixo.");
        onJobFinished();
      } else {
        toast.error(current.erro_mensagem || "Não foi possível renderizar o vídeo.");
        onJobFinished();
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
