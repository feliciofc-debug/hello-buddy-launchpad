import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PublishableItem } from "@/lib/publishable-item";

type Vehicle = Database["public"]["Tables"]["veiculos_estoque"]["Row"];
type VehicleStatus = "disponivel" | "reservado" | "vendido";

type VehicleForm = {
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
  blindado: boolean;
  nivel_blindagem: string;
  opcionais: string;
  caracteristicas: string;
  descricao: string;
  fotos: string;
  status: VehicleStatus;
  destaque: boolean;
};

const EMPTY_FORM: VehicleForm = {
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
  blindado: false,
  nivel_blindagem: "",
  opcionais: "",
  caracteristicas: "",
  descricao: "",
  fotos: "",
  status: "disponivel",
  destaque: false,
};

const STATUS_LABELS: Record<VehicleStatus, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
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
  return {
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
    blindado: vehicle.blindado,
    nivel_blindagem: vehicle.nivel_blindagem || "",
    opcionais: vehicle.opcionais.join(", "),
    caracteristicas: vehicle.caracteristicas.join(", "),
    descricao: vehicle.descricao || "",
    fotos: vehicle.fotos.join("\n"),
    status: vehicle.status as VehicleStatus,
    destaque: vehicle.destaque,
  };
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandFilter, setBrandFilter] = useState("todas");
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
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const brands = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.marca))].sort(),
    [vehicles],
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) =>
        (brandFilter === "todas" || vehicle.marca === brandFilter) &&
        (statusFilter === "todos" || vehicle.status === statusFilter) &&
        (!armoredOnly || vehicle.blindado)
      ),
    [armoredOnly, brandFilter, statusFilter, vehicles],
  );

  const openCreate = () => {
    setEditing(null);
    setDraftVehicleId(crypto.randomUUID());
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle);
    setDraftVehicleId(null);
    setForm(vehicleToForm(vehicle));
    setDetailsOpen(false);
    setFormOpen(true);
  };

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

    const values = {
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      versao: form.versao.trim() || null,
      ano_fabricacao: optionalNumber(form.ano_fabricacao),
      ano_modelo: optionalNumber(form.ano_modelo),
      km: optionalNumber(form.km),
      preco: optionalNumber(form.preco),
      cor: form.cor.trim() || null,
      combustivel: form.combustivel.trim() || null,
      cambio: form.cambio.trim() || null,
      portas: optionalNumber(form.portas),
      blindado: form.blindado,
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

    toast.success(editing ? "Veículo atualizado." : "Veículo adicionado.");
    setFormOpen(false);
    await loadVehicles();
  };

  const uploadVehiclePhotos = async (files: FileList | null) => {
    if (!files?.length) return;

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
      for (const file of Array.from(files)) {
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
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar veículo
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <Card>
          <CardContent className="grid gap-4 p-4 md:grid-cols-3">
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
                    <Badge variant={vehicle.status === "disponivel" ? "default" : "secondary"}>
                      {STATUS_LABELS[vehicle.status as VehicleStatus] || vehicle.status}
                    </Badge>
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
      </main>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.marca} {selected.modelo} {selected.versao}</DialogTitle>
              </DialogHeader>
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
              </div>
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
            <FormField label="Combustível">
              <Input value={form.combustivel} onChange={(event) => setForm({ ...form, combustivel: event.target.value })} />
            </FormField>
            <FormField label="Câmbio">
              <Input value={form.cambio} onChange={(event) => setForm({ ...form, cambio: event.target.value })} />
            </FormField>
            <FormField label="Portas">
              <Input type="number" min="1" value={form.portas} onChange={(event) => setForm({ ...form, portas: event.target.value })} />
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
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={form.blindado}
                onCheckedChange={(checked) => setForm({ ...form, blindado: checked === true })}
              />
              Veículo blindado
            </label>
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
                    void uploadVehiclePhotos(event.target.files);
                    event.target.value = "";
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
