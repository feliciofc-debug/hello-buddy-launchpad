import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Gift, Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "tenant-ebooks";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_NOME = 80;
const MAX_CONVITE = 300;

const EXEMPLO_CONVITE = "Quer ganhar meu ebook 50 Receitas de Airfryer? 🎁 Responde SIM que eu te mando agora.";

interface EbookRow {
  id: string;
  nome: string;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  texto_convite: string | null;
  ativo: boolean;
}

export default function EbookPresentePJ() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [textoConvite, setTextoConvite] = useState("");
  const [ativo, setAtivo] = useState(false);
  const [arquivoPath, setArquivoPath] = useState<string | null>(null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUserId(user.id);

      // Escopo por tenant: a linha é sempre buscada por user_id (RLS reforça no banco).
      const { data, error } = await supabase
        .from("tenant_ebooks")
        .select("id, nome, arquivo_path, arquivo_nome, texto_convite, ativo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const row = data as EbookRow | null;
      if (row) {
        setNome(row.nome ?? "");
        setTextoConvite(row.texto_convite ?? "");
        setAtivo(!!row.ativo);
        setArquivoPath(row.arquivo_path ?? null);
        setArquivoNome(row.arquivo_nome ?? null);
      }
    } catch (e: any) {
      console.error("[ebook-presente] load:", e?.message);
      toast.error("Não foi possível carregar sua configuração");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!userId) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Só aceitamos arquivo PDF");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("O arquivo passou de 20MB. Reduza o PDF e tente de novo.");
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
      // Prefixo com o user_id = isolamento por tenant no Storage (bucket privado).
      const path = `${userId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: "application/pdf", upsert: false });

      if (upErr) throw upErr;

      // Remove o PDF antigo (evita lixo no bucket).
      if (arquivoPath && arquivoPath !== path) {
        await supabase.storage.from(BUCKET).remove([arquivoPath]);
      }

      setArquivoPath(path);
      setArquivoNome(file.name);
      toast.success("PDF enviado. Agora salve a configuração.");
    } catch (e: any) {
      console.error("[ebook-presente] upload:", e?.message);
      toast.error(e?.message || "Falha ao enviar o PDF");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleBaixar = async () => {
    if (!arquivoPath) return;
    try {
      // Bucket é PRIVADO: acesso só por URL assinada de curta duração.
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(arquivoPath, 120);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o PDF");
    }
  };

  const handleToggleAtivo = (checked: boolean) => {
    if (checked && !arquivoPath) {
      toast.error("Suba o PDF primeiro para ativar a isca de ebook");
      return;
    }
    setAtivo(checked);
  };

  const handleSave = async () => {
    if (!userId) return;

    const nomeLimpo = nome.trim();
    const conviteLimpo = textoConvite.trim();

    if (!nomeLimpo) {
      toast.error("Dê um nome ao seu ebook");
      return;
    }
    if (nomeLimpo.length > MAX_NOME) {
      toast.error(`O nome deve ter até ${MAX_NOME} caracteres`);
      return;
    }
    if (conviteLimpo.length > MAX_CONVITE) {
      toast.error(`O convite deve ter até ${MAX_CONVITE} caracteres`);
      return;
    }
    if (ativo && !arquivoPath) {
      toast.error("Suba o PDF primeiro para ativar a isca de ebook");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenant_ebooks")
        .upsert(
          {
            user_id: userId,
            nome: nomeLimpo,
            texto_convite: conviteLimpo || null,
            arquivo_path: arquivoPath,
            arquivo_nome: arquivoNome,
            ativo,
          },
          { onConflict: "user_id" },
        );

      if (error) throw error;
      toast.success(ativo ? "Presente ativo! Seu agente já pode entregar." : "Configuração salva.");
      load();
    } catch (e: any) {
      console.error("[ebook-presente] save:", e?.message);
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ebook de Presente</h1>
            <p className="text-muted-foreground text-sm">
              O presente que seu atendimento oferece para ganhar autorização de contato
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" />
                  Isca de ebook
                </CardTitle>
                <CardDescription>
                  Quando ligada, seu atendimento oferece o ebook depois de resolver a dúvida do cliente
                  e entrega o PDF na hora. Quando desligada, o convite fica no formato simples, sem presente.
                </CardDescription>
              </div>
              <Switch checked={ativo} onCheckedChange={handleToggleAtivo} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Nome do ebook *</Label>
              <Input
                value={nome}
                maxLength={MAX_NOME}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: 50 Receitas de Airfryer"
              />
            </div>

            <div className="space-y-2">
              <Label>Arquivo PDF *</Label>
              {arquivoPath ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{arquivoNome || "ebook.pdf"}</p>
                      <p className="text-xs text-muted-foreground">Arquivo privado, só sua conta acessa</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={handleBaixar} title="Baixar / conferir">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileRef.current?.click()}
                      title="Trocar arquivo"
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Enviar PDF (até 20MB)</>
                  )}
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              {!arquivoPath && (
                <p className="text-xs text-muted-foreground">
                  Só PDF. Enquanto não tiver arquivo, a isca não pode ser ativada.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Texto do convite</Label>
                <Badge variant="secondary" className="text-xs">
                  {textoConvite.length}/{MAX_CONVITE}
                </Badge>
              </div>
              <Textarea
                value={textoConvite}
                maxLength={MAX_CONVITE}
                rows={3}
                onChange={(e) => setTextoConvite(e.target.value)}
                placeholder={EXEMPLO_CONVITE}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  É o que seu atendimento fala ao oferecer o presente. Se deixar vazio, usamos um convite padrão.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="shrink-0 h-auto p-0 text-xs"
                  onClick={() => setTextoConvite(EXEMPLO_CONVITE)}
                >
                  usar exemplo
                </Button>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar configuração"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como funciona na prática</p>
            <p>1. O cliente escreve para você no WhatsApp.</p>
            <p>2. Seu atendimento resolve a dúvida dele primeiro.</p>
            <p>3. Num momento natural, oferece o presente — uma vez só, sem insistir.</p>
            <p>4. Se ele aceitar, o PDF é entregue na hora e ele passa a autorizar suas ofertas.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
