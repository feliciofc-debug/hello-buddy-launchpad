import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Key, Loader2, Plug, Plus, ShoppingBag, AlertTriangle, ArrowLeft } from "lucide-react";

interface ApiKeyRow {
  id: string;
  nome: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function Integracoes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const [revealOpen, setRevealOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, nome, key_prefix, created_at, last_used_at, revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(t("integracoes.errors.load"));
    setKeys((data as ApiKeyRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-api-key", {
        body: { nome: newName.trim() || undefined },
      });
      if (error || !data?.api_key) throw new Error(error?.message || "Erro");
      setCreatedKey(data.api_key);
      setCreateOpen(false);
      setRevealOpen(true);
      setNewName("");
      load();
    } catch (err) {
      console.error(err);
      toast.error(t("integracoes.errors.create"));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    toast.success(t("integracoes.reveal.copied"));
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevoking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString(), revoke_reason: "user_revoked" })
        .eq("id", revokeId)
        .eq("user_id", user!.id);
      if (error) throw error;
      toast.success(t("integracoes.revoke.success"));
      setRevokeId(null);
      load();
    } catch {
      toast.error(t("integracoes.errors.revoke"));
    } finally {
      setRevoking(false);
    }
  };

  const fmtDate = (s: string | null) => {
    if (!s) return t("integracoes.never_used");
    return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("nav.back_to_dashboard")}
            </Button>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Plug className="h-7 w-7" />
              {t("integracoes.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("integracoes.subtitle")}</p>
          </div>
        </div>

        {/* Extensão Chrome Shopee */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle>{t("integracoes.shopee.title")}</CardTitle>
                <CardDescription className="mt-1">{t("integracoes.shopee.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast.info(t("integracoes.shopee.coming_soon"))}>
              📥 {t("integracoes.shopee.download")}
            </Button>
            <Button variant="ghost" onClick={() => toast.info(t("integracoes.shopee.coming_soon"))}>
              📖 {t("integracoes.shopee.instructions")}
            </Button>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {t("integracoes.keys.title")}
              </CardTitle>
              <CardDescription>{t("integracoes.keys.description")}</CardDescription>
            </div>
            {keys.length > 0 && (
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("integracoes.keys.new")}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <Key className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="font-medium">{t("integracoes.keys.empty_title")}</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {t("integracoes.keys.empty_subtitle")}
                </p>
                <Button onClick={() => setCreateOpen(true)} size="lg" className="mt-2">
                  <Key className="h-4 w-4 mr-2" />
                  {t("integracoes.keys.empty_cta")}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("integracoes.keys.col_name")}</TableHead>
                    <TableHead>{t("integracoes.keys.col_prefix")}</TableHead>
                    <TableHead>{t("integracoes.keys.col_created")}</TableHead>
                    <TableHead>{t("integracoes.keys.col_last_used")}</TableHead>
                    <TableHead>{t("integracoes.keys.col_status")}</TableHead>
                    <TableHead className="text-right">{t("integracoes.keys.col_action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{k.key_prefix}…</TableCell>
                      <TableCell>{fmtDate(k.created_at)}</TableCell>
                      <TableCell>{fmtDate(k.last_used_at)}</TableCell>
                      <TableCell>
                        {k.revoked_at ? (
                          <Badge variant="secondary">{t("integracoes.keys.revoked")}</Badge>
                        ) : (
                          <Badge>{t("integracoes.keys.active")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!k.revoked_at && (
                          <Button variant="ghost" size="sm" onClick={() => setRevokeId(k.id)}>
                            {t("integracoes.keys.revoke")}
                          </Button>
                        )}
                        {k.revoked_at && (
                          <span className="text-xs text-muted-foreground">{fmtDate(k.revoked_at)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Outras integrações */}
        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="text-base">{t("integracoes.others.title")}</CardTitle>
            <CardDescription>{t("integracoes.others.description")}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("integracoes.create.title")}</DialogTitle>
            <DialogDescription>{t("integracoes.create.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">{t("integracoes.create.name_label")}</Label>
            <Input
              id="key-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("integracoes.create.name_placeholder")}
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
              {t("integracoes.create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal dialog */}
      <Dialog open={revealOpen} onOpenChange={(open) => { if (!open) { setRevealOpen(false); setCreatedKey(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              {t("integracoes.reveal.title")}
            </DialogTitle>
            <DialogDescription>{t("integracoes.reveal.description")}</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 font-mono text-sm break-all border">
            {createdKey}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              {t("integracoes.reveal.copy")}
            </Button>
            <Button onClick={() => { setRevealOpen(false); setCreatedKey(null); }}>
              {t("integracoes.reveal.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeId} onOpenChange={(open) => { if (!open) setRevokeId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("integracoes.revoke.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("integracoes.revoke.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("integracoes.revoke.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
