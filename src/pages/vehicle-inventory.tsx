import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CarFront,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
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
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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

    const result = editing
      ? await supabase
        .from("veiculos_estoque")
        .update(values)
        .eq("id", editing.id)
        .eq("user_id", user.id)
      : await supabase
        .from("veiculos_estoque")
        .insert({ ...values, user_id: user.id });

    setSaving(false);
    if (result.error) {
      toast.error("Não foi possível salvar o veículo.");
      return;
    }

    toast.success(editing ? "Veículo atualizado." : "Veículo adicionado.");
    setFormOpen(false);
    await loadVehicles();
  };

  const markAsSold = async (vehicle: Vehicle) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
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
                    <img
                      src={vehicle.fotos[0]}
                      alt={`${vehicle.marca} ${vehicle.modelo}`}
                      className="h-full w-full object-cover"
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
              <Textarea rows={4} value={form.fotos} onChange={(event) => setForm({ ...form, fotos: event.target.value })} />
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
