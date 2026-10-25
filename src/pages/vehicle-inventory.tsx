import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CarFront,
  CheckCircle2,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AgendarStoryFotoModal } from "@/components/AgendarStoryFotoModal";
import { CriarCampanhaWhatsAppModal } from "@/components/CriarCampanhaWhatsAppModal";
import { PostarFacebookModal } from "@/components/PostarFacebookModal";
import { PostarInstagramModal } from "@/components/PostarInstagramModal";
import { PostarLinkedInModal } from "@/components/PostarLinkedInModal";
import { EngagementModeSelector } from "@/components/produtos/EngagementModeSelector";
import { TextosPersonalizadosProdutoModal } from "@/components/produtos/TextosPersonalizadosProdutoModal";
import { ProductImageCarousel } from "@/components/ProductImageCarousel";
import { PublicarSimultaneoModal } from "@/components/PublicarSimultaneoModal";
import { snapshotInputFiles } from "@/lib/file-input-snapshot";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PublishableItem } from "@/lib/publishable-item";
import {
  VeiculoCustosInternosForm,
  type VeiculoCustosSaveHandle,
} from "@/components/veiculos/VeiculoCustosInternosForm.tsx";
import { MlInventoryStrip } from "@/components/ml/MlInventoryStrip";
import { MlQuestionsPanel } from "@/components/ml/MlQuestionsPanel";
import { MlVehicleActions, type VeiculoPortalMl } from "@/components/ml/MlVehicleActions";
import { OlxVehicleActions, type OlxVehicleListing } from "@/components/olx/OlxVehicleActions";
import {
  WebmotorsVehicleActions,
  type VeiculoPortalWebmotors,
} from "@/components/webmotors/WebmotorsVehicleActions";
import { VeiculoGestaoLucroPanel } from "@/components/gestao/VeiculoGestaoLucroPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readAmzAutoModePreference, isEffectiveAmzAutoMode } from "@/lib/amz-auto-mode";
import { VehicleVideosTab } from "@/components/veiculos/VehicleVideosTab";
import { validarLiberacaoVitrine } from "../../supabase/functions/_shared/veiculo-estoque-status.ts";

type Vehicle = Database["public"]["Tables"]["veiculos_estoque"]["Row"] & {
  placa?: string | null;
};
type VehicleStatus = "disponivel" | "reservado" | "vendido" | "em_preparacao";

type VehicleSegmento = "carro" | "moto";

type VehicleForm = {
  segmento: VehicleSegmento;
  marca: string;
  modelo: string;
  versao: string;
  ano_fabricacao: string;
  ano_modelo: string;
  km: string;
  preco: string;
  cor: string;
  combustivel: string;
  cambio: string;
  portas: string;
  cilindrada_cc: string;
  estilo_moto: string;
  partida: string;
  refrigeracao: string;
  blindado: boolean;
  nivel_blindagem: string;
  opcionais: string;
  caracteristicas: string;
  descricao: string;
  fotos: string;
  status: VehicleStatus;
  destaque: boolean;
  placa: string;
};

const EMPTY_FORM: VehicleForm = {
  segmento: "carro",
  marca: "",
  modelo: "",
  versao: "",
  ano_fabricacao: "",
  ano_modelo: "",
  km: "",
  preco: "",
  cor: "",
  combustivel: "",
  cambio: "",
  portas: "",
  cilindrada_cc: "",
  estilo_moto: "",
  partida: "",
  refrigeracao: "",
  blindado: false,
  nivel_blindagem: "",
  opcionais: "",
  caracteristicas: "",
  descricao: "",
  fotos: "",
  status: "disponivel",
  destaque: false,
  placa: "",
};

const MOTO_ESTILO_OPTIONS = [
  { value: "naked", label: "Naked" },
  { value: "esportiva", label: "Esportiva" },
  { value: "custom", label: "Custom" },
  { value: "trail", label: "Trail / Big trail" },
  { value: "scooter", label: "Scooter" },
  { value: "touring", label: "Touring" },
  { value: "street", label: "Street" },
  { value: "off_road", label: "Off-road" },
] as const;

const STATUS_LABELS: Record<VehicleStatus, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  em_preparacao: "Em preparação",
};

function listFromText(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function vehicleToForm(vehicle: Vehicle): VehicleForm {
  const segmento = (vehicle as Vehicle & { segmento?: string }).segmento === "moto"
    ? "moto"
    : "carro";
  return {
    segmento,
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    versao: vehicle.versao || "",
    ano_fabricacao: vehicle.ano_fabricacao?.toString() || "",
    ano_modelo: vehicle.ano_modelo?.toString() || "",
    km: vehicle.km?.toString() || "",
    preco: vehicle.preco?.toString() || "",
    cor: vehicle.cor || "",
    combustivel: vehicle.combustivel || "",
    cambio: vehicle.cambio || "",
    portas: vehicle.portas?.toString() || "",
    cilindrada_cc: (vehicle as Vehicle & { cilindrada_cc?: number | null }).cilindrada_cc?.toString() || "",
    estilo_moto: (vehicle as Vehicle & { estilo_moto?: string | null }).estilo_moto || "",
    partida: (vehicle as Vehicle & { partida?: string | null }).partida || "",
    refrigeracao: (vehicle as Vehicle & { refrigeracao?: string | null }).refrigeracao || "",
    blindado: vehicle.blindado,
    nivel_blindagem: vehicle.nivel_blindagem || "",
    opcionais: vehicle.opcionais.join(", "),
    caracteristicas: vehicle.caracteristicas.join(", "),
    descricao: vehicle.descricao || "",
    fotos: vehicle.fotos.join("\n"),
    status: vehicle.status as VehicleStatus,
    destaque: vehicle.destaque,
    placa: vehicle.placa ?? "",
  };
}

function normalizePlaca(value: string): string | null {
  const p = value.replace(/\W/g, "").toUpperCase();
  return p.length >= 7 ? p : p.length ? p : null;
}

function formatPrice(value: number | null): string {
  if (value == null) return "Preço sob consulta";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatKm(value: number | null): string {
  if (value == null) return "Km não informado";
  return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

function vehicleAsPublishableItem(vehicle: Vehicle): PublishableItem {
  const facts = [
    vehicle.ano_fabricacao || vehicle.ano_modelo
      ? `Ano ${vehicle.ano_fabricacao || "—"}/${vehicle.ano_modelo || "—"}`
      : null,
    vehicle.km != null ? formatKm(vehicle.km) : null,
    vehicle.cor ? `Cor ${vehicle.cor}` : null,
    vehicle.cambio ? `Câmbio ${vehicle.cambio}` : null,
    vehicle.blindado
      ? `Blindado${vehicle.nivel_blindagem ? ` ${vehicle.nivel_blindagem}` : ""}`
      : null,
  ].filter(Boolean);

  return {
    id: vehicle.id,
    item_tipo: "veiculo",
    veiculo: {
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      versao: vehicle.versao,
      ano_fabricacao: vehicle.ano_fabricacao,
      ano_modelo: vehicle.ano_modelo,
      km: vehicle.km,
      cambio: vehicle.cambio,
      combustivel: vehicle.combustivel,
      blindado: vehicle.blindado,
      nivel_blindagem: vehicle.nivel_blindagem,
      cor: vehicle.cor,
      opcionais: vehicle.opcionais?.slice(0, 8) ?? [],
    },
    nome: [vehicle.marca, vehicle.modelo, vehicle.versao]
      .filter(Boolean)
      .join(" "),
    descricao: [vehicle.descricao, ...facts].filter(Boolean).join("\n"),
    preco: vehicle.preco,
    imagem_url: vehicle.fotos[0] || null,
    imagens: vehicle.fotos,
    link: vehicle.url_origem,
    incluir_cta_whatsapp: vehicle.incluir_cta_whatsapp,
    categoria: "Veículo",
    modo_postagem_fb: vehicle.modo_postagem_fb ?? null,
    engajamento_estilos: vehicle.engajamento_estilos ?? null,
    usa_textos_personalizados: vehicle.usa_textos_personalizados ?? false,
  };
}

async function getVehicleSessionUser() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const sessionUser = sessionData.session?.user ?? null;
  if (!sessionUser) {
    return {
      user: null,
      reason: sessionError?.message || "sessão local ausente",
    };
  }

  const { data: verifiedData, error: verificationError } =
    await supabase.auth.getUser();
  if (verificationError) {
    console.warn(
      "[vehicle-inventory] validação complementar do usuário falhou:",
      verificationError.message,
    );
  }

  return {
    user: verifiedData.user ?? sessionUser,
    reason: null,
  };
}

export default function VehicleInventory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showVideosTab = isEffectiveAmzAutoMode(readAmzAutoModePreference());
  const inventoryTab = searchParams.get("tab") === "videos" && showVideosTab ? "videos" : "estoque";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandFilter, setBrandFilter] = useState("todas");
  const [segmentFilter, setSegmentFilter] = useState<"todos" | VehicleSegmento>("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [armoredOnly, setArmoredOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [draftVehicleId, setDraftVehicleId] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [publishableItem, setPublishableItem] = useState<PublishableItem | null>(null);
  const [simultaneousOpen, setSimultaneousOpen] = useState(false);
  const [facebookOpen, setFacebookOpen] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [engagementOpen, setEngagementOpen] = useState(false);
  const [textosOpen, setTextosOpen] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [mlConnected, setMlConnected] = useState(false);
  const [mlPortals, setMlPortals] = useState<Record<string, VeiculoPortalMl>>({});
  const [wmConnected, setWmConnected] = useState(false);
  const [wmPortals, setWmPortals] = useState<Record<string, VeiculoPortalWebmotors>>({});
  const [olxConnected, setOlxConnected] = useState(false);
  const [olxListings, setOlxListings] = useState<Record<string, OlxVehicleListing>>({});
  const [portalReadinessBase, setPortalReadinessBase] = useState({
    hasCep: false,
    hasPhone: false,
    hasMlPackage: false,
    mlPackLabel: null as string | null,
    phonePreview: null as string | null,
  });
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [compraVeiculoIds, setCompraVeiculoIds] = useState<Set<string>>(new Set());
  const [custosExpanded, setCustosExpanded] = useState(false);
  const custosRef = useRef<VeiculoCustosSaveHandle>(null);

  const loadPortalMeta = useCallback(async () => {
    const [{ data: stMl }, { data: stWm }, { data: stOlx }] = await Promise.all([
      supabase.functions.invoke("ml-status"),
      supabase.functions.invoke("webmotors-status"),
      supabase.functions.invoke("olx-status"),
    ]);
    setMlConnected(!!stMl?.connected);
    setWmConnected(!!stWm?.connected);
    setOlxConnected(!!stOlx?.connected);
    setPortalReadinessBase({
      hasCep: !!stMl?.has_location,
      hasPhone: !!stMl?.has_seller_phone,
      hasMlPackage: !!stMl?.ml_has_vehicle_package,
      mlPackLabel: stMl?.ml_listing_pack_label != null ? String(stMl.ml_listing_pack_label) : null,
      phonePreview: stMl?.seller_phone_preview != null ? String(stMl.seller_phone_preview) : null,
    });
    const { data: portals } = await supabase
      .from("veiculos_portais" as "veiculos_estoque")
      .select("veiculo_id, portal, status, permalink, last_error");
    const mlMap: Record<string, VeiculoPortalMl> = {};
    const wmMap: Record<string, VeiculoPortalWebmotors> = {};
    for (const row of (portals ?? []) as Array<{
      veiculo_id: string;
      portal: string;
      status: string;
      permalink: string | null;
      last_error: string | null;
    }>) {
      const entry = {
        status: row.status,
        permalink: row.permalink,
        last_error: row.last_error,
      };
      if (row.portal === "mercadolivre") mlMap[row.veiculo_id] = entry;
      if (row.portal === "webmotors") wmMap[row.veiculo_id] = entry;
    }
    setMlPortals(mlMap);
    setWmPortals(wmMap);

    const { data: olxRows } = await supabase
      .from("olx_vehicle_listing" as "veiculos_estoque")
      .select("veiculo_id, status, olx_url, last_error");
    const olxMap: Record<string, OlxVehicleListing> = {};
    for (const row of (olxRows ?? []) as Array<{
      veiculo_id: string;
      status: string;
      olx_url: string | null;
      last_error: string | null;
    }>) {
      olxMap[row.veiculo_id] = {
        status: row.status,
        olx_url: row.olx_url,
        last_error: row.last_error,
      };
    }
    setOlxListings(olxMap);
  }, []);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    const { user, reason } = await getVehicleSessionUser();
    if (!user) {
      console.warn(
        "[vehicle-inventory] redirecionando para login:",
        reason,
      );
      navigate("/login");
      return;
    }
    setSessionUserId(user.id);

    const { data, error } = await supabase
      .from("veiculos_estoque")
      .select("*")
      .eq("user_id", user.id)
      .order("destaque", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar o estoque.");
    } else {
      setVehicles(data || []);
    }
    const { data: compras } = await supabase
      .from("veiculo_compra" as "veiculos_estoque")
      .select("veiculo_id")
      .eq("user_id", user.id);
    setCompraVeiculoIds(new Set((compras ?? []).map((c: { veiculo_id: string }) => c.veiculo_id)));
    await loadPortalMeta();
    setLoading(false);
  }, [loadPortalMeta, navigate]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    const ml = searchParams.get("ml");
    if (!ml) return;
    if (ml === "conectado") toast.success("Mercado Livre conectado.");
    else if (ml === "erro") {
      const motivo = searchParams.get("motivo") ?? "erro";
      const msg = motivo === "conta_ml_em_uso"
        ? "Esta conta Mercado Livre já está conectada em outra loja AMZ. Desconecte lá ou use outra conta ML."
        : motivo === "state_expirado"
        ? "A autorização expirou (10 min). Clique em Conectar Mercado Livre novamente."
        : `Mercado Livre: ${motivo}`;
      toast.error(msg);
    }
    searchParams.delete("ml");
    searchParams.delete("motivo");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const brands = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.marca))].sort(),
    [vehicles],
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const seg = (vehicle as Vehicle & { segmento?: string }).segmento === "moto" ? "moto" : "carro";
        return (brandFilter === "todas" || vehicle.marca === brandFilter) &&
          (segmentFilter === "todos" || seg === segmentFilter) &&
          (statusFilter === "todos" || vehicle.status === statusFilter) &&
          (!armoredOnly || vehicle.blindado);
      }),
    [armoredOnly, brandFilter, segmentFilter, statusFilter, vehicles],
  );

  const openCreate = () => {
    setEditing(null);
    setDraftVehicleId(crypto.randomUUID());
    setForm(EMPTY_FORM);
    setCustosExpanded(false);
    setFormOpen(true);
  };

  const openEdit = (vehicle: Vehicle, opts?: { focusCustos?: boolean }) => {
    setEditing(vehicle);
    setDraftVehicleId(null);
    setForm(vehicleToForm(vehicle));
    setCustosExpanded(!!opts?.focusCustos);
    setDetailsOpen(false);
    setFormOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !vehicles.length) return;
    const vehicle = vehicles.find((v) => v.id === editId);
    if (!vehicle) return;
    openEdit(vehicle);
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, vehicles]);

  const openDetails = (vehicle: Vehicle) => {
    setSelected(vehicle);
    setSelectedPhoto(0);
    setDetailsOpen(true);
  };

  const saveVehicle = async () => {
    if (!form.marca.trim() || !form.modelo.trim()) {
      toast.error("Informe marca e modelo.");
      return;
    }
    const placaNormalizada = normalizePlaca(form.placa);
    if (placaNormalizada && placaNormalizada.length !== 7) {
      toast.error("A placa deve ter 7 caracteres.");
      return;
    }
    if (form.status === "disponivel" && editing?.status === "em_preparacao") {
      const liberacao = validarLiberacaoVitrine({
        fotos: listFromText(form.fotos),
        preco: optionalNumber(form.preco),
      });
      if (!liberacao.ok) {
        toast.error(
          `Para liberar na vitrine, informe ${liberacao.faltantes.join(" e ")}.`,
        );
        return;
      }
    }

    setSaving(true);
    const { user, reason } = await getVehicleSessionUser();
    if (!user) {
      console.warn(
        "[vehicle-inventory] redirecionando para login:",
        reason,
      );
      setSaving(false);
      navigate("/login");
      return;
    }
    if (form.status === "disponivel" && editing?.status === "em_preparacao") {
      const { data: osPreparacao, error: osError } = await supabase
        .from("gestao_os" as "veiculos_estoque")
        .select("status")
        .eq("user_id", user.id)
        .eq("veiculo_id", editing.id)
        .eq("tipo", "preparacao");
      if (osError) {
        setSaving(false);
        toast.error("Não foi possível validar as ordens de serviço.");
        return;
      }
      const aberta = (osPreparacao ?? []).some((item) =>
        !["concluida", "cancelada"].includes(
          String((item as unknown as { status: string }).status),
        )
      );
      if (aberta) {
        setSaving(false);
        toast.error("Conclua ou cancele todas as OS de preparação antes de liberar.");
        return;
      }
    }

    const isMoto = form.segmento === "moto";
    const values = {
      segmento: form.segmento,
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      versao: form.versao.trim() || null,
      ano_fabricacao: optionalNumber(form.ano_fabricacao),
      ano_modelo: optionalNumber(form.ano_modelo),
      km: optionalNumber(form.km),
      preco: optionalNumber(form.preco),
      cor: form.cor.trim() || null,
      combustivel: isMoto ? null : (form.combustivel.trim() || null),
      cambio: isMoto ? null : (form.cambio.trim() || null),
      portas: isMoto ? null : optionalNumber(form.portas),
      cilindrada_cc: isMoto ? optionalNumber(form.cilindrada_cc) : null,
      estilo_moto: isMoto && form.estilo_moto ? form.estilo_moto : null,
      partida: isMoto && form.partida ? form.partida : null,
      refrigeracao: isMoto && form.refrigeracao ? form.refrigeracao : null,
      blindado: isMoto ? false : form.blindado,
      nivel_blindagem: form.blindado
        ? form.nivel_blindagem.trim() || null
        : null,
      opcionais: listFromText(form.opcionais),
      caracteristicas: listFromText(form.caracteristicas),
      descricao: form.descricao.trim() || null,
      fotos: listFromText(form.fotos),
      status: form.status,
      destaque: form.destaque,
      vendido_at: form.status === "vendido"
        ? editing?.vendido_at || new Date().toISOString()
        : null,
      placa: placaNormalizada,
    };

    const vehicleId = editing?.id || draftVehicleId || crypto.randomUUID();
    const result = editing
      ? await supabase
        .from("veiculos_estoque")
        .update(values)
        .eq("id", editing.id)
        .eq("user_id", user.id)
      : await supabase
        .from("veiculos_estoque")
        .insert({ ...values, id: vehicleId, user_id: user.id });

    setSaving(false);
    if (result.error) {
      toast.error("Não foi possível salvar o veículo.");
      return;
    }

    const custosOk = await custosRef.current?.save(user.id, vehicleId);
    if (custosOk === false) {
      return;
    }

    toast.success(editing ? "Veículo atualizado." : "Veículo adicionado.");
    setFormOpen(false);
    await loadVehicles();
    if (editing?.id && mlPortals[editing.id]) {
      await supabase.functions.invoke("ml-vehicle-sync", {
        body: { veiculo_id: editing.id },
      });
      await loadPortalMeta();
    }
  };

  const uploadVehiclePhotos = async (files: File[]) => {
    if (!files.length) return;

    const { user, reason } = await getVehicleSessionUser();
    if (!user) {
      console.warn("[vehicle-inventory] upload cancelado por falta de sessão:", reason);
      toast.error("Faça login novamente para enviar as fotos.");
      return;
    }

    const vehicleId = editing?.id || draftVehicleId || crypto.randomUUID();
    if (!editing && !draftVehicleId) setDraftVehicleId(vehicleId);

    setUploadingPhotos(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const filePath = `${user.id}/veiculos/${vehicleId}/${fileName}`;
        const { error } = await supabase.storage
          .from("produtos")
          .upload(filePath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });
        if (error) throw error;

        const { data } = supabase.storage.from("produtos").getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }

      setForm((current) => ({
        ...current,
        fotos: [...listFromText(current.fotos), ...uploadedUrls].join("\n"),
      }));
      toast.success(
        uploadedUrls.length === 1
          ? "Foto enviada."
          : `${uploadedUrls.length} fotos enviadas.`,
      );
    } catch (error) {
      console.error("[vehicle-inventory] falha no upload de fotos:", error);
      toast.error("Não foi possível enviar as fotos.");
    } finally {
      setUploadingPhotos(false);
    }
  };

  const markAsSold = async (vehicle: Vehicle) => {
    const { user, reason } = await getVehicleSessionUser();
    if (!user) {
      console.warn(
        "[vehicle-inventory] ação cancelada por falta de sessão:",
        reason,
      );
      return;
    }
    const { error } = await supabase
      .from("veiculos_estoque")
      .update({
        status: "vendido",
        vendido_at: new Date().toISOString(),
      })
      .eq("id", vehicle.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Não foi possível marcar o veículo como vendido.");
      return;
    }
    toast.success("Veículo marcado como vendido.");
    setDetailsOpen(false);
    await loadVehicles();
  };

  const liberarNaVitrine = async (vehicle: Vehicle) => {
    const liberacao = validarLiberacaoVitrine({
      fotos: vehicle.fotos ?? [],
      preco: vehicle.preco == null ? null : Number(vehicle.preco),
    });
    if (!liberacao.ok) {
      toast.error(
        `Complete ${liberacao.faltantes.join(" e ")} antes de liberar na vitrine.`,
      );
      return;
    }
    const { user } = await getVehicleSessionUser();
    if (!user) {
      toast.error("Sua sessão expirou. Entre novamente.");
      navigate("/login");
      return;
    }
    const { error } = await supabase.from("veiculos_estoque")
      .update({ status: "disponivel" })
      .eq("id", vehicle.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Não foi possível liberar o veículo na vitrine.");
      return;
    }
    toast.success("Veículo liberado na vitrine.");
    setDetailsOpen(false);
    await loadVehicles();
  };

  const setVehicleWhatsappCta = async (vehicle: Vehicle, checked: boolean) => {
    const { user, reason } = await getVehicleSessionUser();
    if (!user) {
      console.warn("[vehicle-inventory] CTA cancelado por falta de sessão:", reason);
      return;
    }
    const { error } = await supabase
      .from("veiculos_estoque")
      .update({ incluir_cta_whatsapp: checked })
      .eq("id", vehicle.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Não foi possível atualizar o Chama no WhatsApp.");
      return;
    }
    setVehicles((current) =>
      current.map((item) =>
        item.id === vehicle.id
          ? { ...item, incluir_cta_whatsapp: checked }
          : item
      )
    );
    toast.success(
      checked
        ? "Chama no WhatsApp ativado para este veículo."
        : "Chama no WhatsApp desativado.",
    );
  };

  const openMarketingTool = (
    vehicle: Vehicle,
    tool:
      | "simultaneous"
      | "facebook"
      | "instagram"
      | "campaign"
      | "engagement"
      | "linkedin"
      | "story"
      | "textos",
  ) => {
    setPublishableItem(vehicleAsPublishableItem(vehicle));
    if (tool === "simultaneous") setSimultaneousOpen(true);
    if (tool === "facebook") setFacebookOpen(true);
    if (tool === "instagram") setInstagramOpen(true);
    if (tool === "campaign") setCampaignOpen(true);
    if (tool === "engagement") setEngagementOpen(true);
    if (tool === "linkedin") setLinkedinOpen(true);
    if (tool === "story") setStoryOpen(true);
    if (tool === "textos") setTextosOpen(true);
  };

  const patchVehicleMarketingFlags = (
    vehicleId: string,
    patch: Partial<
      Pick<
        Vehicle,
        | "modo_postagem_fb"
        | "engajamento_estilos"
        | "usa_textos_personalizados"
      >
    >,
  ) => {
    setVehicles((current) =>
      current.map((item) => (item.id === vehicleId ? { ...item, ...patch } : item)),
    );
    setPublishableItem((current) =>
      current && current.id === vehicleId
        ? { ...current, ...patch }
        : current,
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <CarFront className="h-6 w-6 text-primary" />
                Estoque de Veículos
              </h1>
              <p className="text-sm text-muted-foreground">
                Estoque exclusivo da sua revenda
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/veiculos/financiamento")}>
              Financiamento
            </Button>
            <Button variant="outline" onClick={() => navigate("/gestao/trocas")}>
              Trocas
            </Button>
            <Button variant="outline" onClick={() => navigate("/gestao/lucro")}>
              Gestão · Lucro
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar veículo
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        {showVideosTab && (
          <Tabs
            value={inventoryTab}
            onValueChange={(v) => {
              const next = new URLSearchParams(searchParams);
              if (v === "videos") next.set("tab", "videos");
              else next.delete("tab");
              setSearchParams(next, { replace: true });
            }}
          >
            <TabsList>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
              <TabsTrigger value="videos">Vídeos</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {showVideosTab && inventoryTab === "videos" ? (
          <VehicleVideosTab />
        ) : (
        <>
        <MlInventoryStrip />
        <Card>
          <CardContent className="grid gap-4 p-4 md:grid-cols-4">
            <div>
              <Label>Segmento</Label>
              <Select
                value={segmentFilter}
                onValueChange={(v) => setSegmentFilter(v as "todos" | VehicleSegmento)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Carros e motos</SelectItem>
                  <SelectItem value="carro">Carros</SelectItem>
                  <SelectItem value="moto">Motos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marca</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as marcas</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="em_preparacao">Em preparação</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <Checkbox
                checked={armoredOnly}
                onCheckedChange={(checked) => setArmoredOnly(checked === true)}
              />
              Somente blindados
            </label>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredVehicles.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CarFront className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              <p className="font-medium">Nenhum veículo encontrado.</p>
              <p className="text-sm text-muted-foreground">
                Ajuste os filtros ou adicione o primeiro veículo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <Card
                key={vehicle.id}
                className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
                onClick={() => openDetails(vehicle)}
              >
                <div className="aspect-[4/3] bg-muted">
                  {vehicle.fotos[0] ? (
                    <ProductImageCarousel
                      imagem_url={vehicle.fotos[0]}
                      imagens={vehicle.fotos}
                      alt={`${vehicle.marca} ${vehicle.modelo}`}
                      size="card"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <CarFront className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {vehicle.marca} {vehicle.modelo}
                      </h2>
                      {vehicle.versao && (
                        <p className="text-sm text-muted-foreground">{vehicle.versao}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!compraVeiculoIds.has(vehicle.id) && vehicle.status !== "vendido" && (
                        <Badge
                          variant="outline"
                          className="cursor-pointer border-amber-500/60 text-amber-800 dark:text-amber-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(vehicle, { focusCustos: true });
                          }}
                        >
                          Custo pendente
                        </Badge>
                      )}
                      <Badge variant={vehicle.status === "disponivel" ? "default" : "secondary"}>
                        {STATUS_LABELS[vehicle.status as VehicleStatus] || vehicle.status}
                      </Badge>
                      {vehicle.status === "em_preparacao" && (
                        <span className="max-w-48 text-right text-[10px] font-medium text-amber-700">
                          Complete o anúncio para liberar na vitrine
                        </span>
                      )}
                      {(vehicle as Vehicle & { segmento?: string }).segmento === "moto" && (
                        <Badge variant="outline">Moto</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {(vehicle.ano_fabricacao || vehicle.ano_modelo) && (
                      <span>{vehicle.ano_fabricacao || "—"}/{vehicle.ano_modelo || "—"}</span>
                    )}
                    <span>•</span>
                    <span>{formatKm(vehicle.km)}</span>
                  </div>
                  {vehicle.blindado && (
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      BLINDADO
                    </Badge>
                  )}
                  <p className="text-xl font-bold text-primary">{formatPrice(vehicle.preco)}</p>
                  {vehicle.status === "vendido" ? (
                    <p className="border-t pt-3 text-sm text-muted-foreground">
                      Publicações e campanhas encerradas para este veículo vendido.
                    </p>
                  ) : (
                    <div
                      className="space-y-2 border-t pt-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Incluir Chama no WhatsApp
                      </span>
                      <Switch
                        checked={vehicle.incluir_cta_whatsapp === true}
                        onCheckedChange={(checked) =>
                          void setVehicleWhatsappCta(vehicle, checked)}
                      />
                    </label>
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-gradient-to-r from-blue-600 to-pink-600 text-white"
                      onClick={() => openMarketingTool(vehicle, "simultaneous")}
                    >
                      <Facebook className="h-4 w-4" />
                      <Instagram className="h-4 w-4" />
                      Facebook + Instagram
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMarketingTool(vehicle, "facebook")}
                      >
                        <Facebook className="mr-2 h-4 w-4" />
                        Facebook
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMarketingTool(vehicle, "instagram")}
                      >
                        <Instagram className="mr-2 h-4 w-4" />
                        Instagram
                      </Button>
                    </div>
                    {vehicle.status === "em_preparacao" && (
                      <>
                        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                          Em preparação — complete foto e preço antes de publicar nos portais.
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => void liberarNaVitrine(vehicle)}
                        >
                          Liberar na vitrine
                        </Button>
                      </>
                    )}
                    {vehicle.status !== "em_preparacao" && (
                      <>
                    <MlVehicleActions
                      veiculoId={vehicle.id}
                      portal={mlPortals[vehicle.id] ?? null}
                      mlConnected={mlConnected}
                      readiness={{
                        connected: mlConnected,
                        hasCep: portalReadinessBase.hasCep,
                        hasPhone: portalReadinessBase.hasPhone,
                        hasMlPackage: portalReadinessBase.hasMlPackage,
                        mlPackLabel: portalReadinessBase.mlPackLabel,
                        phonePreview: portalReadinessBase.phonePreview,
                      }}
                      onChanged={() => void loadPortalMeta()}
                    />
                    <WebmotorsVehicleActions
                      veiculoId={vehicle.id}
                      portal={wmPortals[vehicle.id] ?? null}
                      wmConnected={wmConnected}
                      readiness={{
                        connected: wmConnected,
                        hasCep: portalReadinessBase.hasCep,
                        hasPhone: portalReadinessBase.hasPhone,
                        phonePreview: portalReadinessBase.phonePreview,
                      }}
                      onChanged={() => void loadPortalMeta()}
                    />
                      </>
                    )}
                    <OlxVehicleActions
                      veiculoId={vehicle.id}
                      listing={olxListings[vehicle.id] ?? null}
                      olxConnected={olxConnected}
                      readiness={{
                        connected: olxConnected,
                        hasCep: portalReadinessBase.hasCep,
                        hasPhone: portalReadinessBase.hasPhone,
                        phonePreview: portalReadinessBase.phonePreview,
                      }}
                      onChanged={() => void loadPortalMeta()}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openMarketingTool(vehicle, "engagement")}
                    >
                      ⚙️ Modo de postagem FB
                      {vehicle.modo_postagem_fb === "engajamento" && (
                        <span className="ml-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px]">
                          ENGAJ.
                        </span>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openMarketingTool(vehicle, "linkedin")}
                    >
                      <Linkedin className="mr-2 h-4 w-4" />
                      Post on LinkedIn
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openMarketingTool(vehicle, "story")}
                    >
                      📸 Story Foto (Agendar)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openMarketingTool(vehicle, "textos")}
                    >
                      📝 Textos Personalizados
                      {vehicle.usa_textos_personalizados && (
                        <span className="ml-1 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px]">
                          ON
                        </span>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openMarketingTool(vehicle, "campaign")}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Campanha WhatsApp
                    </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <MlQuestionsPanel />
        </>
        )}
      </main>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.marca} {selected.modelo} {selected.versao}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="detalhes" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="gestao">Custos e lucro</TabsTrigger>
                </TabsList>
                <TabsContent value="detalhes" className="space-y-4 mt-4">
              {selected.fotos.length > 0 && (
                <div className="space-y-3">
                  <img
                    src={selected.fotos[selectedPhoto]}
                    alt={`${selected.marca} ${selected.modelo}`}
                    className="aspect-video w-full rounded-lg bg-muted object-cover"
                  />
                  <div className="flex gap-2 overflow-x-auto">
                    {selected.fotos.map((photo, index) => (
                      <button
                        type="button"
                        key={`${photo}-${index}`}
                        onClick={() => setSelectedPhoto(index)}
                        className={`h-16 w-24 shrink-0 overflow-hidden rounded border-2 ${
                          selectedPhoto === index ? "border-primary" : "border-transparent"
                        }`}
                      >
                        <img src={photo} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
                <VehicleFact label="Ano" value={
                  selected.ano_fabricacao || selected.ano_modelo
                    ? `${selected.ano_fabricacao || "—"}/${selected.ano_modelo || "—"}`
                    : null
                } />
                <VehicleFact label="Quilometragem" value={formatKm(selected.km)} />
                <VehicleFact label="Preço" value={formatPrice(selected.preco)} />
                <VehicleFact label="Cor" value={selected.cor} />
                <VehicleFact label="Combustível" value={selected.combustivel} />
                <VehicleFact label="Câmbio" value={selected.cambio} />
                <VehicleFact label="Portas" value={selected.portas?.toString()} />
                <VehicleFact
                  label="Blindagem"
                  value={selected.blindado ? selected.nivel_blindagem || "Sim" : "Não"}
                />
                <VehicleFact
                  label="Status"
                  value={STATUS_LABELS[selected.status as VehicleStatus] || selected.status}
                />
                <VehicleFact label="Placa (interno)" value={selected.placa ?? undefined} />
              </div>
              {selected.status === "em_preparacao" && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-medium">
                    Em preparação — complete o anúncio para liberar na vitrine
                  </p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => void liberarNaVitrine(selected)}
                  >
                    Liberar na vitrine
                  </Button>
                </div>
              )}
              {selected.descricao && <p className="text-sm">{selected.descricao}</p>}
              <VehicleTags title="Características" values={selected.caracteristicas} />
              <VehicleTags title="Opcionais" values={selected.opcionais} />
              <DialogFooter>
                {selected.status !== "vendido" && (
                  <Button variant="outline" onClick={() => void markAsSold(selected)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marcar como vendido
                  </Button>
                )}
                <Button onClick={() => openEdit(selected)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </DialogFooter>
                </TabsContent>
                <TabsContent value="gestao" className="mt-4">
                  {sessionUserId && (
                    <VeiculoGestaoLucroPanel
                      veiculoId={selected.id}
                      userId={sessionUserId}
                      precoAnunciado={selected.preco}
                      statusVeiculo={selected.status}
                      onVendaMarcouVendido={() => {
                        void loadVehicles();
                        setSelected((cur) =>
                          cur ? { ...cur, status: "vendido" } : cur,
                        );
                      }}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar veículo" : "Adicionar veículo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Segmento *">
              <Select
                value={form.segmento}
                onValueChange={(segmento: VehicleSegmento) =>
                  setForm({
                    ...form,
                    segmento,
                    blindado: segmento === "moto" ? false : form.blindado,
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="carro">Carro</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Marca *">
              <Input value={form.marca} onChange={(event) => setForm({ ...form, marca: event.target.value })} />
            </FormField>
            <FormField label="Modelo *">
              <Input value={form.modelo} onChange={(event) => setForm({ ...form, modelo: event.target.value })} />
            </FormField>
            <FormField label="Versão">
              <Input value={form.versao} onChange={(event) => setForm({ ...form, versao: event.target.value })} />
            </FormField>
            <FormField label="Cor">
              <Input value={form.cor} onChange={(event) => setForm({ ...form, cor: event.target.value })} />
            </FormField>
            <FormField label="Ano de fabricação">
              <Input type="number" value={form.ano_fabricacao} onChange={(event) => setForm({ ...form, ano_fabricacao: event.target.value })} />
            </FormField>
            <FormField label="Ano do modelo">
              <Input type="number" value={form.ano_modelo} onChange={(event) => setForm({ ...form, ano_modelo: event.target.value })} />
            </FormField>
            <FormField label="Quilometragem">
              <Input type="number" min="0" value={form.km} onChange={(event) => setForm({ ...form, km: event.target.value })} />
            </FormField>
            <FormField label="Preço">
              <Input type="number" min="0" step="0.01" value={form.preco} onChange={(event) => setForm({ ...form, preco: event.target.value })} />
            </FormField>
            {form.segmento === "carro" ? (
              <>
                <FormField label="Combustível">
                  <Input value={form.combustivel} onChange={(event) => setForm({ ...form, combustivel: event.target.value })} />
                </FormField>
                <FormField label="Câmbio">
                  <Input value={form.cambio} onChange={(event) => setForm({ ...form, cambio: event.target.value })} />
                </FormField>
                <FormField label="Portas">
                  <Input type="number" min="1" value={form.portas} onChange={(event) => setForm({ ...form, portas: event.target.value })} />
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Cilindrada (cc)">
                  <Input type="number" min="1" value={form.cilindrada_cc} onChange={(event) => setForm({ ...form, cilindrada_cc: event.target.value })} />
                </FormField>
                <FormField label="Estilo">
                  <Select
                    value={form.estilo_moto || "none"}
                    onValueChange={(v) => setForm({ ...form, estilo_moto: v === "none" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {MOTO_ESTILO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Partida">
                  <Select
                    value={form.partida || "none"}
                    onValueChange={(v) => setForm({ ...form, partida: v === "none" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="eletrica">Elétrica</SelectItem>
                      <SelectItem value="pedal">Pedal</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Refrigeração">
                  <Select
                    value={form.refrigeracao || "none"}
                    onValueChange={(v) => setForm({ ...form, refrigeracao: v === "none" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="ar">Ar</SelectItem>
                      <SelectItem value="liquida">Líquida</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            )}
            <FormField label="Placa (uso interno)">
              <div className="space-y-1">
                <Input
                  value={form.placa}
                  onChange={(event) => setForm({ ...form, placa: event.target.value })}
                  placeholder="Ex.: ABC1D23 — não aparece no anúncio"
                />
                <p className="text-xs text-muted-foreground">
                  Obrigatória para publicar na Webmotors. Não é exibida para o comprador.
                </p>
              </div>
            </FormField>
            <FormField label="Status">
              <Select
                value={form.status}
                onValueChange={(status: VehicleStatus) => setForm({ ...form, status })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="em_preparacao">Em preparação</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {form.segmento === "carro" && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={form.blindado}
                  onCheckedChange={(checked) => setForm({ ...form, blindado: checked === true })}
                />
                Veículo blindado
              </label>
            )}
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={form.destaque}
                onCheckedChange={(checked) => setForm({ ...form, destaque: checked === true })}
              />
              Destacar no estoque
            </label>
            {form.blindado && (
              <FormField label="Nível da blindagem">
                <Input value={form.nivel_blindagem} onChange={(event) => setForm({ ...form, nivel_blindagem: event.target.value })} />
              </FormField>
            )}
            <FormField label="Fotos (uma URL por linha)" className="sm:col-span-2">
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingPhotos}
                  onChange={(event) => {
                    const lista = snapshotInputFiles(event.target.files);
                    event.target.value = "";
                    void uploadVehiclePhotos(lista);
                  }}
                />
                {uploadingPhotos && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando fotos...
                  </p>
                )}
                {!uploadingPhotos && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    As fotos enviadas são adicionadas às URLs abaixo.
                  </p>
                )}
                <Textarea
                  rows={4}
                  value={form.fotos}
                  onChange={(event) => setForm({ ...form, fotos: event.target.value })}
                />
              </div>
            </FormField>
            <FormField label="Características (separadas por vírgula)" className="sm:col-span-2">
              <Textarea rows={3} value={form.caracteristicas} onChange={(event) => setForm({ ...form, caracteristicas: event.target.value })} />
            </FormField>
            <FormField label="Opcionais (separados por vírgula)" className="sm:col-span-2">
              <Textarea rows={3} value={form.opcionais} onChange={(event) => setForm({ ...form, opcionais: event.target.value })} />
            </FormField>
            <FormField label="Descrição" className="sm:col-span-2">
              <Textarea rows={4} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} />
            </FormField>
            <VeiculoCustosInternosForm
              ref={custosRef}
              vehicleId={editing?.id ?? draftVehicleId}
              defaultExpanded={custosExpanded}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={() => void saveVehicle()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar veículo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {publishableItem && (
        <>
          <PublicarSimultaneoModal
            open={simultaneousOpen}
            onOpenChange={setSimultaneousOpen}
            produto={publishableItem}
          />
          <PostarFacebookModal
            open={facebookOpen}
            onOpenChange={setFacebookOpen}
            produto={publishableItem}
            modo_postagem_fb={publishableItem.modo_postagem_fb ?? null}
            engajamento_estilos={publishableItem.engajamento_estilos ?? null}
          />
          <PostarInstagramModal
            open={instagramOpen}
            onOpenChange={setInstagramOpen}
            produto={publishableItem}
          />
          <CriarCampanhaWhatsAppModal
            open={campaignOpen}
            onOpenChange={setCampaignOpen}
            produto={publishableItem}
            onSuccess={loadVehicles}
          />
          <PostarLinkedInModal
            open={linkedinOpen}
            onOpenChange={setLinkedinOpen}
            produto={publishableItem}
          />
          <AgendarStoryFotoModal
            open={storyOpen}
            onOpenChange={setStoryOpen}
            produto={publishableItem}
          />
          <EngagementModeSelector
            open={engagementOpen}
            onOpenChange={setEngagementOpen}
            produto={{
              id: publishableItem.id,
              nome: publishableItem.nome,
              item_tipo: "veiculo",
              modo_postagem_fb: publishableItem.modo_postagem_fb,
              engajamento_estilos: publishableItem.engajamento_estilos,
              usa_textos_personalizados: publishableItem.usa_textos_personalizados,
            }}
            onSaved={(vehicleId, modo, estilos) => {
              patchVehicleMarketingFlags(vehicleId, {
                modo_postagem_fb: modo,
                engajamento_estilos: modo === "engajamento" ? estilos : publishableItem.engajamento_estilos,
              });
            }}
          />
          <TextosPersonalizadosProdutoModal
            open={textosOpen}
            onOpenChange={(open) => {
              setTextosOpen(open);
              if (!open) void loadVehicles();
            }}
            produto={{
              id: publishableItem.id,
              nome: publishableItem.nome,
              item_tipo: "veiculo",
              descricao: publishableItem.descricao,
              preco: publishableItem.preco,
              usa_textos_personalizados: publishableItem.usa_textos_personalizados,
            }}
            onModoChange={(vehicleId, ativado) => {
              patchVehicleMarketingFlags(vehicleId, {
                usa_textos_personalizados: ativado,
              });
            }}
          />
        </>
      )}
    </div>
  );
}
function FormField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function VehicleFact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function VehicleTags({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => <Badge key={value} variant="secondary">{value}</Badge>)}
      </div>
    </div>
  );
}
