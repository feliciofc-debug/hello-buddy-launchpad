import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { GESTAO_COMMAND_ACTIONS } from "@/lib/gestao-nav.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GestaoCommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar: nota, contrato, comissão, contador…" />
      <CommandList>
        <CommandEmpty>Nenhum atalho encontrado.</CommandEmpty>
        <CommandGroup heading="Gestão">
          {GESTAO_COMMAND_ACTIONS.map((action) => (
            <CommandItem
              key={action.id}
              value={`${action.label} ${action.keywords.join(" ")}`}
              onSelect={() => {
                navigate(action.path);
                onOpenChange(false);
              }}
            >
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useGestaoCommandShortcut(onOpen: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen, enabled]);
}
