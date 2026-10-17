import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  busy: boolean;
  onSave: (cep: string) => Promise<boolean>;
};

export function MlCepField({ busy, onSave }: Props) {
  const [cep, setCep] = useState("");

  const handleSave = async () => {
    const ok = await onSave(cep);
    if (ok) setCep("");
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <Label htmlFor="ml-store-cep">CEP da loja</Label>
        <Input
          id="ml-store-cep"
          inputMode="numeric"
          placeholder="00000-000"
          value={cep}
          disabled={busy}
          onChange={(e) => setCep(e.target.value)}
        />
      </div>
      <Button
        type="button"
        disabled={busy || !cep.trim()}
        onClick={() => void handleSave()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
      </Button>
    </div>
  );
}
