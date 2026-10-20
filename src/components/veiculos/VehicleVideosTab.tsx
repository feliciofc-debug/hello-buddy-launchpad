import { useCallback, useEffect, useMemo, useState } from "react";
import { useVeiculoVideoJobPoll } from "@/hooks/useVeiculoVideoJobPoll";
import { VehicleVideoJobProgressCard } from "@/components/veiculos/VehicleVideoJobProgressCard";
import { Film, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CriarVideoProduto } from "@/components/videos/CriarVideoProduto";
import { CriarVideoAnimado } from "@/components/videos/CriarVideoAnimado";
import { ReelsGeradosGrid } from "@/components/videos/ReelsGeradosGrid";
import { VideosAgendadosLista } from "@/components/VideosAgendadosLista";
import { ModalProgressoReel } from "@/components/videos/ModalProgressoReel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGerarReel } from "@/hooks/useGerarReel";
import {
  type VehicleVideoStockRow,
  publicVehicleStockPhotos,
  vehicleRowToPublishableItem,
  vehicleSlideshowPhotoUrls,
  vehicleVideoDisplayTitle,
  vehicleVideoPriceForOverlay,
} from "@/lib/vehicle-video-source-adapter";

type VehicleOption = VehicleVideoStockRow & { status: string };

const TODOS_VEICULOS = "__all__";

export function VehicleVideosTab() {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [veiculoId, setVeiculoId] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1">("9:16");
  const [lojaNome, setLojaNome] = useState("");
  const { gerarReel, progresso } = useGerarReel();
  const [modalReelAberto, setModalReelAberto] = useState(false);
  const [gerandoSlideshow, setGerandoSlideshow] = useState(false);
  const [watchJobId, setWatchJobId] = useState<string | null>(null);
  const [gridReloadKey, setGridReloadKey] = useState(0);
  const [retryingJob, setRetryingJob] = useState(false);

  const onMotionJobFinished = useCallback(
    (info: { jobId: string; veiculoId?: string; titulo?: string | null }) => {
      setGridReloadKey((k) => k + 1);
      setWatchJobId(null);
      if (info.veiculoId && info.veiculoId !== veiculoId) {
        setVeiculoId(info.veiculoId);
        const nome = vehicles.find((v) => v.id === info.veiculoId);
        const label = nome ? vehicleVideoDisplayTitle(nome) : info.titulo || "veículo";
        toast.success(`Vídeo pronto do ${label} — selecionamos o carro na lista.`);
      } else {
        toast.success("Vídeo pronto! Está na grade abaixo.");
      }
    },
    [veiculoId, vehicles],
  );

  const { trackedJob } = useVeiculoVideoJobPoll(
    veiculoId || undefined,
    watchJobId,
    onMotionJobFinished,
  );

  const onVeiculoJobQueued = useCallback((jobId: string) => {
    setWatchJobId(jobId);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const [{ data: rows }, { data: profile }] = await Promise.all([
      supabase
        .from("veiculos_estoque")
        .select(
          "id, marca, modelo, versao, ano_fabricacao, ano_modelo, km, cambio, cor, combustivel, opcionais, caracteristicas, descricao, preco, fotos, status, incluir_cta_whatsapp, modo_postagem_fb, engajamento_estilos, usa_textos_personalizados, url_origem",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase.from("profiles").select("nome, nome_fantasia, logo_reel_url").eq("id", user.id).maybeSingle(),
    ]);
    const comFoto = ((rows ?? []) as VehicleOption[]).filter(
      (v) => publicVehicleStockPhotos(v).length > 0,
    );
    setVehicles(comFoto);
    const p = profile as { nome?: string; nome_fantasia?: string | null } | null;
    setLojaNome(String(p?.nome_fantasia || p?.nome || "").trim());
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const veiculo = useMemo(
    () => vehicles.find((v) => v.id === veiculoId) ?? null,
    [vehicles, veiculoId],
  );

  const gerarSlideshow = async () => {
    if (!veiculo) {
      toast.error("Escolha um veículo com foto.");
      return;
    }
    const imagens = vehicleSlideshowPhotoUrls(veiculo);
    if (imagens.length === 0) {
      toast.error("Este veículo não tem fotos públicas no estoque.");
      return;
    }
    const { preco, precoLabel } = vehicleVideoPriceForOverlay(veiculo);
    let logoUrl: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("logo_reel_url")
          .eq("id", user.id)
          .maybeSingle();
        logoUrl = (profile as { logo_reel_url?: string } | null)?.logo_reel_url ?? null;
      }
    } catch {
      logoUrl = null;
    }

    setGerandoSlideshow(true);
    setModalReelAberto(true);
    const titulo = [vehicleVideoDisplayTitle(veiculo), lojaNome].filter(Boolean).join(" · ");
    await gerarReel({
      produtoId: veiculo.id,
      nomeProduto: titulo || vehicleVideoDisplayTitle(veiculo),
      imagensUrls: imagens,
      preco: preco ?? 0,
      logoUrl,
      destinoBiblioteca: "veiculo",
      veiculoId: veiculo.id,
      aspectRatio,
      exibirPreco: precoLabel != null,
      ctaFrameText: "Chama no WhatsApp",
      minFotos: 1,
    });
    setGerandoSlideshow(false);
    await carregar();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando estoque…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5 text-primary" />
            Veículo para vídeo
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Estoque (com foto pública)</Label>
            <Select
              value={veiculoId || TODOS_VEICULOS}
              onValueChange={(v) => setVeiculoId(v === TODOS_VEICULOS ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_VEICULOS}>Todos os veículos (grade completa)</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {vehicleVideoDisplayTitle(v)}
                    {v.status === "vendido" ? " (vendido)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vehicles.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Cadastre um veículo com fotos no estoque para gerar vídeos.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Formato do slideshow</Label>
            <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as "9:16" | "1:1")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">Vertical 9:16 (Reels / Stories)</SelectItem>
                <SelectItem value="1:1">Quadrado 1:1 (feed)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Vídeo do veículo (slideshow)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Transições entre fotos do estoque, textos do carro, logo da loja e chamada &quot;Chama no WhatsApp&quot;.
            Só entram fotos públicas do estoque — nunca trocas, laudo ou documentos.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            disabled={!veiculo || veiculo.status === "vendido" || gerandoSlideshow}
            onClick={gerarSlideshow}
          >
            {gerandoSlideshow ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Film className="mr-2 h-4 w-4" />
            )}
            Gerar slideshow
          </Button>
        </CardContent>
      </Card>

      <VehicleVideoJobProgressCard
        job={trackedJob}
        retrying={retryingJob}
        onRetry={async (jobId) => {
          setRetryingJob(true);
          try {
            const { data, error } = await supabase.functions.invoke("video-motion-retry", {
              body: { job_id: jobId },
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Falha ao recriar");
            setWatchJobId(String(data.job_id));
            toast.success(`Novo job na fila (posição ${data.posicao_fila ?? "?"}).`);
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Não foi possível tentar de novo.");
          } finally {
            setRetryingJob(false);
          }
        }}
      />

      <CriarVideoProduto
        entitySource="veiculo"
        fixedVeiculoId={veiculoId || undefined}
        veiculoSelectorLocked
        lojaNome={lojaNome}
        onVeiculoJobQueued={onVeiculoJobQueued}
      />

      <CriarVideoAnimado
        videoScope="veiculo"
        veiculoId={veiculoId || undefined}
        onVeiculoJobQueued={onVeiculoJobQueued}
      />

      <ReelsGeradosGrid
        libraryKind="veiculo"
        filterVeiculoId={veiculoId || undefined}
        publishableFromVeiculo={veiculo ? vehicleRowToPublishableItem(veiculo) : null}
        reloadKey={gridReloadKey}
      />

      <VideosAgendadosLista libraryScope="veiculo" />

      <ModalProgressoReel open={modalReelAberto} onOpenChange={setModalReelAberto} progresso={progresso} />
    </div>
  );
}
