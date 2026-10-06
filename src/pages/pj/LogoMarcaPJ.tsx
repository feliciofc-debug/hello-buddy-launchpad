import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "tenant-logos";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ACEITOS = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export default function LogoMarcaPJ() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const darkFileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [darkPath, setDarkPath] = useState<string | null>(null);
  const [darkNomeArquivo, setDarkNomeArquivo] = useState<string | null>(null);
  const [darkPreviewUrl, setDarkPreviewUrl] = useState<string | null>(null);
  const [darkGenerated, setDarkGenerated] = useState(false);
  const [backgroundWarning, setBackgroundWarning] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const gerarPreview = async (
    storagePath: string,
    setter = setPreviewUrl,
  ) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 600);
    if (error) {
      console.error("[logo-marca] preview:", error.message);
      setter(null);
      return;
    }
    setter(data?.signedUrl ?? null);
  };

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUserId(user.id);

      // Escopo por tenant: sempre por user_id (RLS reforça no banco).
      const { data, error } = await supabase
        .from("tenant_logos")
        .select("id, storage_path, file_name, variant, generated_automatically, background_warning")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .in("variant", ["default", "dark_background"]);

      if (error) throw error;

      const current = data?.find((item) => item.variant === "default");
      const dark = data?.find((item) => item.variant === "dark_background");
      setBackgroundWarning(current?.background_warning || dark?.background_warning || null);
      if (current?.storage_path) {
        setPath(current.storage_path);
        setNomeArquivo(current.file_name ?? null);
        await gerarPreview(current.storage_path);
      } else {
        setPath(null);
        setNomeArquivo(null);
        setPreviewUrl(null);
      }
      setDarkPath(dark?.storage_path ?? null);
      setDarkNomeArquivo(dark?.file_name ?? null);
      setDarkGenerated(dark?.generated_automatically === true);
      if (dark?.storage_path) {
        await gerarPreview(dark.storage_path, setDarkPreviewUrl);
      } else setDarkPreviewUrl(null);
    } catch (e: any) {
      console.error("[logo-marca] load:", e?.message);
      toast.error("Não foi possível carregar sua marca");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (
    file: File,
    variant: "default" | "dark_background" = "default",
  ) => {
    if (!userId) return;

    if (!ACEITOS.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPEG ou WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("O arquivo passou de 5MB. Reduza a imagem e tente de novo.");
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
      // Prefixo com o user_id = isolamento por tenant no Storage (bucket privado).
      const novoPath = `${userId}/incoming/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(novoPath, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: managed, error: manageError } = await supabase.functions
        .invoke("manage-tenant-logo", {
          body: {
            action: "set",
            storage_path: novoPath,
            file_name: file.name,
            mime_type: file.type,
            variant,
          },
        });
      if (manageError || !managed?.ok) {
        await supabase.storage.from(BUCKET).remove([novoPath]);
        throw manageError || new Error(managed?.error || "Falha ao processar a logo");
      }
      await load();
      toast.success("Marca salva! Peça ao seu agente para usar quando quiser.");
    } catch (e: any) {
      console.error("[logo-marca] upload:", e?.message);
      toast.error(e?.message || "Falha ao enviar a imagem");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (darkFileRef.current) darkFileRef.current.value = "";
    }
  };

  const handleRemover = async () => {
    if (!userId || (!path && !darkPath)) return;
    if (!window.confirm("Remover as duas logos? As imagens passam a sair sem marca.")) return;
    setRemovendo(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-tenant-logo",
        { body: { action: "remove" } },
      );
      if (error || !data?.ok) throw error || new Error(data?.error || "Erro ao remover");
      setPath(null);
      setNomeArquivo(null);
      setPreviewUrl(null);
      setDarkPath(null);
      setDarkNomeArquivo(null);
      setDarkPreviewUrl(null);
      setDarkGenerated(false);
      setBackgroundWarning(null);
      toast.success("Marca removida.");
    } catch (e: any) {
      console.error("[logo-marca] remover:", e?.message);
      toast.error(e?.message || "Erro ao remover");
    } finally {
      setRemovendo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Minha Marca</h1>
            <p className="text-muted-foreground text-sm">
              A marca que seu agente usa nas imagens quando você pedir
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Logo da empresa
                </CardTitle>
                <CardDescription>
                  Por padrão as imagens saem <strong>sem</strong> marca. Ela só entra quando você pedir
                  ao agente — por exemplo: “gera uma imagem do produto <em>com a minha marca</em>”.
                </CardDescription>
              </div>
              <Badge variant={path ? "default" : "secondary"}>
                {path ? "Configurada" : "Sem marca"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <p className="text-sm font-medium text-foreground">
              Use PNG com fundo transparente (só as letras e o ícone).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4 space-y-4">
                <p className="font-medium text-foreground">Logo para fundo claro</p>
                <div className="rounded-lg border min-h-44 p-5 flex items-center justify-center bg-white">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={nomeArquivo || "Logo para fundo claro"}
                      className="max-h-32 max-w-full object-contain"
                    />
                  ) : <ImageIcon className="h-10 w-10 text-slate-400" />}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleUpload(file, "default");
                  }}
                />
                <Button
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {path ? "Trocar" : "Enviar logo para fundo claro"}
                </Button>
                <p className="text-xs text-muted-foreground truncate min-h-4">
                  {nomeArquivo ? `Arquivo: ${nomeArquivo}` : ""}
                </p>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">Logo para fundo escuro</p>
                  {darkGenerated && (
                    <Badge variant="secondary">Gerada automaticamente</Badge>
                  )}
                </div>
                <div className="rounded-lg border min-h-44 p-5 flex items-center justify-center bg-black">
                  {(darkPreviewUrl || previewUrl) ? (
                    <img
                      src={darkPreviewUrl || previewUrl || ""}
                      alt={darkNomeArquivo || "Logo para fundo escuro"}
                      className="max-h-32 max-w-full object-contain"
                    />
                  ) : <ImageIcon className="h-10 w-10 text-slate-500" />}
                </div>
                <input
                  ref={darkFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleUpload(file, "dark_background");
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => darkFileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {darkPath ? "Trocar" : "Enviar logo para fundo escuro"}
                </Button>
                <p className="text-xs text-muted-foreground truncate min-h-4">
                  {darkNomeArquivo ? `Arquivo: ${darkNomeArquivo}` : ""}
                </p>
              </div>
            </div>

            {backgroundWarning && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {backgroundWarning}
              </p>
            )}

            {(path || darkPath) && (
              <Button variant="destructive" onClick={handleRemover} disabled={removendo}>
                {removendo ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Remover logos
              </Button>
            )}

            <div className="space-y-1 text-sm text-muted-foreground border-t border-border pt-4">
              <p>Recomendado: PNG com fundo transparente, boa resolução.</p>
              <p>Aceitos: PNG, JPEG e WEBP. Tamanho máximo: 5MB.</p>
              <p>Sua marca é privada e nunca aparece nas imagens de outro cliente.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
