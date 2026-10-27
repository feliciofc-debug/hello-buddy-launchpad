import {
  Download,
  FileSignature,
  FileUp,
  Loader2,
  Plus,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  onRegistrarVenda: () => void;
  onEmitirNota: () => void;
  onLancarDespesa: () => void;
  onNovoContrato: () => void;
  onImportar: () => void;
};

export function GestaoActionBar({
  onRegistrarVenda,
  onEmitirNota,
  onLancarDespesa,
  onNovoContrato,
  onImportar,
}: Props) {
  const [cartilhaLoading, setCartilhaLoading] = useState(false);

  const baixarCartilha = async () => {
    const popup = window.open("", "_blank");
    setCartilhaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "jarvis-cartilha-pdf",
      );
      if (error || !data?.url) throw error ?? new Error("URL não retornada");
      if (popup) popup.location.href = data.url;
      else window.location.assign(data.url);
    } catch {
      popup?.close();
      toast.error("Não foi possível baixar a cartilha do Jarvis.");
    } finally {
      setCartilhaLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button
        size="lg"
        className="h-12 flex-1 sm:flex-none sm:min-w-[160px]"
        onClick={onRegistrarVenda}
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        Registrar venda
      </Button>
      <Button
        size="lg"
        variant="secondary"
        className="h-12 flex-1 sm:flex-none sm:min-w-[160px]"
        onClick={onEmitirNota}
      >
        <Receipt className="mr-2 h-5 w-5" />
        Emitir nota fiscal
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-12"
        onClick={onLancarDespesa}
      >
        <Plus className="mr-2 h-4 w-4" />
        Lançar despesa
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-12"
        onClick={onNovoContrato}
      >
        <FileSignature className="mr-2 h-4 w-4" />
        Novo contrato
      </Button>
      <Button size="lg" variant="outline" className="h-12" onClick={onImportar}>
        <FileUp className="mr-2 h-4 w-4" />
        Importar planilha
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-12"
        disabled={cartilhaLoading}
        onClick={() => void baixarCartilha()}
      >
        {cartilhaLoading
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <Download className="mr-2 h-4 w-4" />}
        Baixar cartilha do Jarvis
      </Button>
    </div>
  );
}
