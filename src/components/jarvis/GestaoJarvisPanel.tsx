import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GESTAO_JARVIS_SUGGESTIONS } from "@/lib/gestao-assistente-suggestions.ts";
import { useJarvisSpeechInput } from "@/hooks/useJarvisSpeechInput.ts";
import { supabase } from "@/integrations/supabase/client";

type ChatTurn = { role: "user" | "assistant"; content: string };
type Action = { label: string; path: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GestaoJarvisPanel({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [lastActions, setLastActions] = useState<Action[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendAssistant = (content: string, actions: Action[]) => {
    setTurns((prev) => [...prev, { role: "assistant", content }]);
    setLastActions(actions);
  };

  const sendMessage = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    setInput("");
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setBusy(true);
    setLastActions([]);
    try {
      const history = turns.slice(-8);
      const { data, error } = await supabase.functions.invoke("gestao-assistente", {
        body: { message, history },
      });
      if (error) throw error;
      if (!data?.success && data?.error) throw new Error(data.error);
      appendAssistant(String(data?.reply ?? "Sem resposta."), (data?.actions ?? []) as Action[]);
    } catch (e) {
      appendAssistant(
        (e as Error).message || "Não consegui responder agora. Tente de novo.",
        [{ label: "Abrir Gestão", path: "/gestao/lucro" }],
      );
    } finally {
      setBusy(false);
    }
  };

  const { listening, supported, start, stop } = useJarvisSpeechInput((text) => {
    void sendMessage(text);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle>Pergunte ao Jarvis</SheetTitle>
          <SheetDescription>
            Gestão, notas, vendas e financeiro — só leitura e atalhos; nada é lançado pelo chat.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {turns.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sugestões:</p>
              <div className="flex flex-wrap gap-2">
                {GESTAO_JARVIS_SUGGESTIONS.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-auto whitespace-normal text-left"
                    onClick={() => void sendMessage(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                t.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-4 bg-muted"
              }`}
            >
              {t.content}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Jarvis pensando…
            </div>
          )}
          {lastActions.length > 0 && !busy && (
            <div className="flex flex-wrap gap-2 pt-1">
              {lastActions.map((a) => (
                <Button
                  key={`${a.path}-${a.label}`}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigate(a.path);
                    onOpenChange(false);
                  }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sua pergunta…"
              rows={2}
              className="min-h-[52px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
            />
            <div className="flex shrink-0 flex-col gap-1">
              {supported && (
                <Button
                  type="button"
                  size="icon"
                  variant={listening ? "destructive" : "secondary"}
                  aria-label={listening ? "Parar microfone" : "Falar"}
                  onClick={() => (listening ? stop() : start())}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                disabled={busy || !input.trim()}
                aria-label="Enviar"
                onClick={() => void sendMessage(input)}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
