import { FileSignature, FileUp, Plus, Receipt, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button size="lg" className="h-12 flex-1 sm:flex-none sm:min-w-[160px]" onClick={onRegistrarVenda}>
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
      <Button size="lg" variant="outline" className="h-12" onClick={onLancarDespesa}>
        <Plus className="mr-2 h-4 w-4" />
        Lançar despesa
      </Button>
      <Button size="lg" variant="outline" className="h-12" onClick={onNovoContrato}>
        <FileSignature className="mr-2 h-4 w-4" />
        Novo contrato
      </Button>
      <Button size="lg" variant="outline" className="h-12" onClick={onImportar}>
        <FileUp className="mr-2 h-4 w-4" />
        Importar planilha
      </Button>
    </div>
  );
}
