import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VEHICLE_DEALER_TENANT_TYPE } from "@/lib/business-tenant";

type AmzCadastro = {
  id: string;
  created_at: string;
  loja_nome: string;
  cnpj: string;
  responsavel: string;
  whatsapp_e164: string;
  email: string;
  cidade_uf: string;
  tipo_operacao: string;
  qtd_lojas: string;
  faixa_estoque: string;
  interesse: string;
  status: string;
  plano_interno: string | null;
  observacao_admin: string | null;
  user_id: string | null;
  liberado_at: string | null;
};

const STATUS_OPTIONS = [
  "em_analise",
  "em_contato",
  "aguardando_pagamento",
  "liberado",
  "recusado",
] as const;

const PLANO_OPTIONS = [
  { value: "atende", label: "Atende" },
  { value: "vende", label: "Vende" },
  { value: "gestao", label: "Gestão" },
] as const;

function randomPassword(length = 16): string {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function formatCnpj(digits: string): string {
  if (digits.length !== 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export default function AdminAmzAutoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AmzCadastro[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [liberarId, setLiberarId] = useState<string | null>(null);
  const [liberando, setLiberando] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdminByEmail = user.email === "expo@atombrasildigital.com";
    if (!roleData && !isAdminByEmail) {
      toast({
        title: "Acesso negado",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    let query = supabase
      .from("amz_auto_cadastros")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast({
        title: "Erro ao carregar cadastros",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setRows((data as AmzCadastro[]) ?? []);
  }, [navigate, statusFilter]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadRows();
      setLoading(false);
    })();
  }, [loadRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.loja_nome.toLowerCase().includes(q) ||
        r.cnpj.includes(q.replace(/\D/g, "")) ||
        formatCnpj(r.cnpj).includes(q),
    );
  }, [rows, search]);

  const patchRow = async (
    id: string,
    patch: Partial<Pick<AmzCadastro, "status" | "plano_interno" | "observacao_admin">>,
  ) => {
    setSavingId(id);
    const { error } = await supabase
      .from("amz_auto_cadastros")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const liberarLoja = async () => {
    const row = rows.find((r) => r.id === liberarId);
    if (!row) return;
    setLiberando(true);

    const senha = randomPassword();
    const { data: userId, error: rpcError } = await supabase.rpc(
      "admin_criar_cliente",
      {
        p_email: row.email.trim().toLowerCase(),
        p_senha: senha,
        p_nome: row.responsavel.trim() || row.loja_nome.trim(),
        p_tipo: VEHICLE_DEALER_TENANT_TYPE,
      },
    );

    if (rpcError) {
      setLiberando(false);
      setLiberarId(null);
      toast({
        title: "Não foi possível liberar a loja",
        description: rpcError.message,
        variant: "destructive",
      });
      return;
    }

    const redirectTo = `${window.location.origin}/alterar-senha`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      row.email.trim().toLowerCase(),
      { redirectTo },
    );

    const { data: { user } } = await supabase.auth.getUser();
    const { error: updError } = await supabase
      .from("amz_auto_cadastros")
      .update({
        user_id: userId as string,
        status: "liberado",
        liberado_at: new Date().toISOString(),
        liberado_por: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    setLiberando(false);
    setLiberarId(null);

    if (updError) {
      toast({
        title: "Conta criada, mas falha ao atualizar cadastro",
        description: updError.message,
        variant: "destructive",
      });
      return;
    }

    if (resetError) {
      toast({
        title: "Loja liberada",
        description: `Conta criada (${userId}). Falha ao enviar e-mail de senha: ${resetError.message}`,
      });
    } else {
      toast({
        title: "Loja liberada",
        description: "Cliente criado e e-mail de definição de senha enviado.",
      });
    }

    await loadRows();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const liberarRow = rows.find((r) => r.id === liberarId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Car className="h-6 w-6 text-primary" />
            AMZ Auto — cadastros
          </h1>
          <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => void loadRows()}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-4 px-4 py-8">
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="busca">Buscar loja ou CNPJ</Label>
            <Input
              id="busca"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou CNPJ"
            />
          </div>
          <div className="w-[220px]">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {filtered.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-lg">
                  <span>{row.loja_nome}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("pt-BR")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>CNPJ:</strong> {formatCnpj(row.cnpj)} · <strong>Responsável:</strong>{" "}
                  {row.responsavel} · <strong>E-mail:</strong> {row.email} · <strong>WhatsApp:</strong>{" "}
                  {row.whatsapp_e164}
                </p>
                <p>
                  {row.cidade_uf} · {row.tipo_operacao} · {row.qtd_lojas} · {row.faixa_estoque} ·{" "}
                  {row.interesse}
                </p>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={row.status}
                      onValueChange={(v) => void patchRow(row.id, { status: v })}
                      disabled={savingId === row.id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plano interno</Label>
                    <Select
                      value={row.plano_interno ?? ""}
                      onValueChange={(v) =>
                        void patchRow(row.id, { plano_interno: v || null })
                      }
                      disabled={savingId === row.id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLANO_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    {row.status !== "liberado" && !row.user_id ? (
                      <Button
                        className="w-full"
                        onClick={() => setLiberarId(row.id)}
                      >
                        Liberar loja
                      </Button>
                    ) : (
                      <p className="text-muted-foreground">
                        {row.user_id ? `User ${row.user_id.slice(0, 8)}…` : "—"}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Observação admin</Label>
                  <Textarea
                    defaultValue={row.observacao_admin ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (row.observacao_admin ?? "")) {
                        void patchRow(row.id, {
                          observacao_admin: v || null,
                        });
                      }
                    }}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 ? (
            <p className="text-muted-foreground">Nenhum cadastro encontrado.</p>
          ) : null}
        </div>
      </main>

      <AlertDialog open={!!liberarId} onOpenChange={(o) => !o && setLiberarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar loja?</AlertDialogTitle>
            <AlertDialogDescription>
              Será criada uma conta <strong>revenda_veiculos</strong> para{" "}
              <strong>{liberarRow?.email}</strong> ({liberarRow?.loja_nome}) via{" "}
              <code>admin_criar_cliente</code>, com e-mail para definir a senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={liberando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={liberando} onClick={() => void liberarLoja()}>
              {liberando ? "Liberando…" : "Confirmar liberação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
