import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileLock2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  type CrlvLeituraView,
  GestaoCrlvConferencia,
} from "@/components/gestao/GestaoCrlvConferencia";
import {
  GESTAO_TROCA_ROTEIRO_SLOTS,
  gestaoTrocaResolveFotoSlot,
  gestaoTrocaRoteiroProgress,
  gestaoTrocaSlotDef,
  type GestaoTrocaFotoSlotId,
} from "@/lib/gestao-troca-roteiro.ts";
import {
  normalizeGestaoTrocaFotos,
  type GestaoTrocaFotoEntry,
} from "@/lib/gestao-troca-fotos.ts";

type Props = {
  trocaId: string;
  userId: string;
  fotosRaw: unknown;
  disabled?: boolean;
  onFotosChange: (entries: GestaoTrocaFotoEntry[]) => void;
};

export function GestaoTrocaRoteiroFotos({
  trocaId,
  userId,
  fotosRaw,
  disabled,
  onFotosChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const crlvInputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<GestaoTrocaFotoSlotId | null>(null);
  const [uploadingCrlv, setUploadingCrlv] = useState(false);
  const [crlvStored, setCrlvStored] = useState(false);
  const [crlvReview, setCrlvReview] = useState<{
    documentoId: string;
    leitura: CrlvLeituraView;
  } | null>(null);
  const fotos = useMemo(() => normalizeGestaoTrocaFotos(fotosRaw), [fotosRaw]);
  const prog = useMemo(() => gestaoTrocaRoteiroProgress(fotos), [fotos]);

  const loadCrlvStatus = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("gestao-cofre", {
      body: { action: "listar", troca_id: trocaId },
    });
    if (!error && !data?.error) {
      setCrlvStored(
        (data?.documentos ?? []).some((doc: { tipo?: string }) =>
          doc.tipo === "crlv" || doc.tipo === "crlv_e"
        ),
      );
    }
  }, [trocaId]);

  useEffect(() => {
    void loadCrlvStatus();
  }, [loadCrlvStatus]);

  const bySlot = useMemo(() => {
    const m = new Map<GestaoTrocaFotoSlotId, GestaoTrocaFotoEntry>();
    for (const f of fotos) {
      const slot = gestaoTrocaResolveFotoSlot(f);
      if (slot && !m.has(slot)) m.set(slot, f);
    }
    return m;
  }, [fotos]);

  const openSlot = (slot: GestaoTrocaFotoSlotId) => {
    if (disabled) return;
    pendingSlot.current = slot;
    inputRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const slot = pendingSlot.current;
    pendingSlot.current = null;
    if (!file || !slot) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast.error("Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Máximo 10 MB.");
      return;
    }
    const def = gestaoTrocaSlotDef(slot);
    const path = `${userId}/${trocaId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage.from("trocas").upload(path, file);
    if (error) {
      toast.error("Falha no upload.");
      return;
    }
    const rest = fotos.filter((f) => gestaoTrocaResolveFotoSlot(f) !== slot);
    onFotosChange([
      ...rest,
      { path, etiqueta: def.label, slot, slot_origem: "usuario" },
    ]);
    toast.success(`${def.label} enviada.`);
  };

  const uploadCrlv = async (file: File | undefined) => {
    if (!file || disabled) return;
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Envie o CRLV em PDF, JPG, PNG, WebP ou HEIC.");
      return;
    }
    if (!file.size || file.size > 15 * 1024 * 1024) {
      toast.error("O CRLV deve ter até 15 MB.");
      return;
    }

    setUploadingCrlv(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("gestao-cofre", {
        body: {
          action: "upload",
          base64,
          tipo: file.type === "application/pdf" ? "crlv_e" : "crlv",
          origem: "troca",
          mime: file.type,
          filename: file.name,
          troca_id: trocaId,
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      setCrlvStored(true);
      toast.success("CRLV guardado no cofre.");
      if (data.leitura) {
        setCrlvReview({
          documentoId: data.documento_id,
          leitura: data.leitura,
        });
      } else {
        toast.warning(
          data.leitura_erro ??
            "Não consegui ler bem. O documento continua guardado no cofre.",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar o CRLV.",
      );
    } finally {
      setUploadingCrlv(false);
      if (crlvInputRef.current) crlvInputRef.current.value = "";
    }
  };

  return (
    <>
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <p className="text-sm font-semibold">
          Roteiro: {prog.preenchidos}/{prog.obrigatorios} obrigatórias
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <input
          ref={crlvInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
          className="hidden"
          onChange={(e) => void uploadCrlv(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          {GESTAO_TROCA_ROTEIRO_SLOTS.map((s) => {
            const ok = bySlot.has(s.id);
            return (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={ok ? "secondary" : "outline"}
                className="h-auto min-h-8 whitespace-normal text-left text-xs"
                disabled={disabled}
                title={s.dica}
                onClick={() => openSlot(s.id)}
              >
                {ok ? "✅" : "⚪"} {s.label}
                {!s.obrigatorio ? " (opc.)" : ""}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant={crlvStored ? "secondary" : "outline"}
            className="h-auto min-h-8 whitespace-normal text-left text-xs"
            disabled={disabled || uploadingCrlv}
            title="O CRLV é cifrado e guardado no cofre; nunca entra nas fotos da avaliação."
            onClick={() => crlvInputRef.current?.click()}
          >
            {uploadingCrlv
              ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              : <FileLock2 className="mr-1 h-3 w-3" />}
            Documento (CRLV)
            {crlvStored ? " · Guardado no cofre ✓" : " (opc.)"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Toque em um slot para enviar a foto. O CRLV é cifrado e fica somente no cofre.
        </p>
      </div>
      {crlvReview && (
        <GestaoCrlvConferencia
          open
          onOpenChange={(open) => {
            if (!open) setCrlvReview(null);
          }}
          documentoId={crlvReview.documentoId}
          leitura={crlvReview.leitura}
          trocaId={trocaId}
          onConfirmed={() => {
            setCrlvReview(null);
            void loadCrlvStatus();
          }}
        />
      )}
    </>
  );
}
