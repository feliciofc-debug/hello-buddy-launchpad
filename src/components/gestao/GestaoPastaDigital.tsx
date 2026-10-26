import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, FileLock2, History, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  type CrlvLeituraView,
  GestaoCrlvConferencia,
} from "@/components/gestao/GestaoCrlvConferencia";

const MAX_BYTES = 15 * 1024 * 1024;
const MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const TIPOS = [
  ["crlv", "CRLV"],
  ["crlv_e", "CRLV-e"],
  ["cnh", "CNH"],
  ["atpv_e", "ATPV-e"],
  ["procuracao", "Procuração"],
  ["comprovante_endereco", "Comprovante de endereço"],
  ["outro", "Outro"],
] as const;

type Documento = {
  id: string;
  tipo: string;
  mime: string;
  tamanho: number;
  status: string;
  created_at: string;
};

type Historico = {
  id: number;
  acao: string;
  created_at: string;
  detalhe: Record<string, unknown>;
};

function tipoLabel(tipo: string) {
  return TIPOS.find(([value]) => value === tipo)?.[1] ?? tipo;
}

function base64FromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function blobFromBase64(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function GestaoPastaDigital({
  userId,
  veiculoId,
  trocaId,
  origem = "painel",
}: {
  userId: string;
  veiculoId?: string | null;
  trocaId?: string | null;
  origem?: "painel" | "troca";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("crlv");
  const [docs, setDocs] = useState<Documento[]>([]);
  const [busy, setBusy] = useState(false);
  const [historico, setHistorico] = useState<Historico[] | null>(null);
  const [crlvReview, setCrlvReview] = useState<
    {
      documentoId: string;
      leitura: CrlvLeituraView;
    } | null
  >(null);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("gestao-cofre", {
      body,
    });
    if (error || data?.error) throw new Error(data?.error ?? error?.message);
    return data;
  }, []);

  const load = useCallback(async () => {
    if (!userId || (!veiculoId && !trocaId)) return;
    try {
      const data = await invoke({
        action: "listar",
        veiculo_id: veiculoId,
        troca_id: trocaId,
      });
      setDocs(data.documentos ?? []);
    } catch {
      toast.error("Não foi possível carregar os documentos.");
    }
  }, [invoke, trocaId, userId, veiculoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFile = async (file: File | null) => {
    if (!file) return;
    if (!MIME.has(file.type)) {
      toast.error("Envie PDF, JPG, PNG, WebP ou HEIC.");
      return;
    }
    if (!file.size || file.size > MAX_BYTES) {
      toast.error("O arquivo deve ter até 15 MB.");
      return;
    }
    setBusy(true);
    try {
      const base64 = await base64FromFile(file);
      const data = await invoke({
        action: "upload",
        base64,
        tipo,
        origem,
        mime: file.type,
        filename: file.name,
        veiculo_id: veiculoId,
        troca_id: trocaId,
      });
      toast.success("Documento guardado no cofre.");
      if (data.leitura) {
        setCrlvReview({
          documentoId: data.documento_id,
          leitura: data.leitura,
        });
      } else if (data.leitura_erro) {
        toast.warning(data.leitura_erro);
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openDocument = async (documentoId: string) => {
    const popup = window.open("", "_blank");
    if (!popup) {
      toast.error("Permita pop-ups para abrir o documento.");
      return;
    }
    setBusy(true);
    try {
      const view = await invoke({ action: "ver", documento_id: documentoId });
      const opened = await invoke({ action: "abrir", token: view.token });
      const objectUrl = URL.createObjectURL(
        blobFromBase64(opened.base64, opened.mime),
      );
      popup.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10 * 60 * 1000);
    } catch {
      popup.close();
      toast.error("Não foi possível abrir o documento.");
    } finally {
      setBusy(false);
    }
  };

  const removeDocument = async (documentoId: string) => {
    if (!window.confirm("Excluir este documento do cofre?")) return;
    setBusy(true);
    try {
      await invoke({ action: "excluir", documento_id: documentoId });
      toast.success("Documento excluído.");
      setHistorico(null);
      await load();
    } catch {
      toast.error("Não foi possível excluir o documento.");
    } finally {
      setBusy(false);
    }
  };

  const showHistory = async (documentoId: string) => {
    setBusy(true);
    try {
      const data = await invoke({
        action: "historico",
        documento_id: documentoId,
      });
      setHistorico(data.historico ?? []);
    } catch {
      toast.error("Não foi possível carregar o histórico.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileLock2 className="h-5 w-5" />
          Pasta digital
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Documentos ficam criptografados. Cada acesso é registrado.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
            onChange={(event) =>
              void uploadFile(event.target.files?.[0] ?? null)}
          />
          <Button disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Upload className="mr-2 h-4 w-4" />}
            {busy && (tipo === "crlv" || tipo === "crlv_e")
              ? "Lendo documento…"
              : tipo === "crlv" || tipo === "crlv_e"
              ? "Enviar CRLV"
              : "Enviar"}
          </Button>
        </div>

        {!docs.length
          ? (
            <p className="text-sm text-muted-foreground">
              Nenhum documento guardado.
            </p>
          )
          : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{tipoLabel(doc.tipo)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleString("pt-BR")} ·{" "}
                      {doc.status}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openDocument(doc.id)}
                    >
                      <Eye className="mr-1 h-4 w-4" /> Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void showHistory(doc.id)}
                    >
                      <History className="mr-1 h-4 w-4" /> Histórico
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void removeDocument(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

        {historico && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="mb-2 text-sm font-medium">Histórico de acesso</p>
            {!historico.length
              ? <p className="text-xs text-muted-foreground">Sem eventos.</p>
              : historico.map((event) => (
                <p key={event.id} className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString("pt-BR")} ·{" "}
                  {event.acao}
                </p>
              ))}
          </div>
        )}
        {crlvReview && (
          <GestaoCrlvConferencia
            open
            onOpenChange={(open) => {
              if (!open) setCrlvReview(null);
            }}
            documentoId={crlvReview.documentoId}
            leitura={crlvReview.leitura}
            veiculoId={veiculoId}
            trocaId={trocaId}
            onConfirmed={() => {
              setCrlvReview(null);
              void load();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
