import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  emptyWebmotorsAnuncioSnForm,
  WEBMOTORS_ANUNCIO_SN_FIELDS,
  type WebmotorsAnuncioSnForm,
} from "@/components/webmotors/webmotorsAnuncioSnFields";

export function WebmotorsPublishDialog(props: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (anuncioSn: WebmotorsAnuncioSnForm) => void;
}) {
  const [sn, setSn] = useState<WebmotorsAnuncioSnForm>(emptyWebmotorsAnuncioSnForm);

  const resetAndClose = () => {
    setSn(emptyWebmotorsAnuncioSnForm());
    props.onClose();
  };

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publicar na Webmotors</DialogTitle>
          <DialogDescription>
            Marque apenas o que for verdade sobre o veículo. Itens desmarcados serão enviados como
            &quot;Não&quot;. A placa cadastrada no estoque é usada só para conferência na Webmotors.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 py-2">
          {WEBMOTORS_ANUNCIO_SN_FIELDS.map(({ key, label }) => (
            <li key={key} className="flex items-start gap-2">
              <Checkbox
                id={`wm-sn-${key}`}
                checked={sn[key]}
                disabled={props.busy}
                onCheckedChange={(checked) =>
                  setSn((prev) => ({ ...prev, [key]: checked === true }))}
              />
              <Label htmlFor={`wm-sn-${key}`} className="cursor-pointer text-sm font-normal leading-snug">
                {label}
              </Label>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={props.busy} onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={props.busy} onClick={() => props.onConfirm(sn)}>
            {props.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
