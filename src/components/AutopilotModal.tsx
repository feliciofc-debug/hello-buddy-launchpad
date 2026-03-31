import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AutopilotConfig } from "@/components/AutopilotConfig";
import { Rocket } from "lucide-react";

interface AutopilotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutopilotModal({ open, onOpenChange }: AutopilotModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Autopilot Social
          </DialogTitle>
          <DialogDescription>
            Configure uma vez e a plataforma posta seus produtos automaticamente todos os dias
          </DialogDescription>
        </DialogHeader>
        <AutopilotConfig />
      </DialogContent>
    </Dialog>
  );
}
