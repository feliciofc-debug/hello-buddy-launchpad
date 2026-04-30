import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Post {
  id: string;
  post_text?: string | null;
  scheduled_at?: string | null;
  image_url?: string | null;
  platform?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
  onSuccess: () => void;
}

// Convert ISO UTC string to value usable by <input type="datetime-local"> in local tz
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditarAgendamentoModal({ open, onOpenChange, post, onSuccess }: Props) {
  const [postText, setPostText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (post && open) {
      setPostText(post.post_text || "");
      setScheduledAt(isoToLocalInput(post.scheduled_at));
    }
  }, [post, open]);

  const handleSave = async () => {
    if (!post) return;

    if (!postText.trim()) {
      toast.error("O texto do post não pode ficar vazio");
      return;
    }

    if (!scheduledAt) {
      toast.error("Defina uma data e hora para o agendamento");
      return;
    }

    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime())) {
      toast.error("Data inválida");
      return;
    }

    if (newDate.getTime() <= Date.now()) {
      toast.error("A data do agendamento precisa ser no futuro");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("social_posts_queue" as any)
        .update({
          post_text: postText,
          scheduled_at: newDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      if (error) throw error;

      toast.success("Agendamento atualizado");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao atualizar agendamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar agendamento</DialogTitle>
          <DialogDescription>
            Altere o texto ou a data/hora do post agendado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {post?.image_url && (
            <div>
              <Label className="text-xs text-muted-foreground">Imagem (não editável nesta versão)</Label>
              <img
                src={post.image_url}
                alt="Preview"
                className="mt-1 w-24 h-24 object-cover rounded border"
              />
            </div>
          )}

          <div>
            <Label htmlFor="post_text">Texto do post</Label>
            <Textarea
              id="post_text"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={6}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="scheduled_at">Data e hora do agendamento</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Horário no fuso do seu navegador.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
