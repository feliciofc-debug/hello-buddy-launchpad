import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Plus, Save, Trash2 } from "lucide-react";

const LIMITE_TEXTOS = 10;
const LIMITE_CARACTERES = 2200;

interface TextoItem {
  id: string | null;
  texto: string;
  ativo: boolean;
  dirty: boolean;
}

export const AutopilotTextosPersonalizados = () => {
  const [loading, setLoading] = useState(true);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [textos, setTextos] = useState<TextoItem[]>([]);

  useEffect(() => {
    void carregar();
  }, []);

  const carregar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("autopilot_textos_personalizados" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("criado_em", { ascending: true });

      if (error) throw error;

      const lista: TextoItem[] = (data || []).map((d: any) => ({
        id: d.id,
        texto: d.texto || "",
        ativo: d.ativo ?? true,
        dirty: false,
      }));
      setTextos(lista);
    } catch (err: any) {
      console.error("Erro ao carregar textos:", err);
      toast.error("Erro ao carregar textos personalizados");
    } finally {
      setLoading(false);
    }
  };

  const updateLocal = (idx: number, novoTexto: string) => {
    setTextos(prev => prev.map((t, i) => i === idx ? { ...t, texto: novoTexto, dirty: true } : t));
  };

  const adicionarTexto = () => {
    if (textos.length >= LIMITE_TEXTOS) {
      toast.error(`Limite de ${LIMITE_TEXTOS} textos atingido`);
      return;
    }
    setTextos(prev => [...prev, { id: null, texto: "", ativo: true, dirty: true }]);
  };

  const salvarTexto = async (idx: number) => {
    const item = textos[idx];
    const texto = item.texto.trim();
    if (!texto) {
      toast.error("Texto não pode ficar vazio");
      return;
    }
    if (texto.length > LIMITE_CARACTERES) {
      toast.error(`Texto excede ${LIMITE_CARACTERES} caracteres`);
      return;
    }

    setSavingIdx(idx);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado"); return; }

      if (item.id) {
        const { error } = await supabase
          .from("autopilot_textos_personalizados" as any)
          .update({ texto, ativo: true })
          .eq("id", item.id);
        if (error) throw error;
        setTextos(prev => prev.map((t, i) => i === idx ? { ...t, texto, dirty: false } : t));
      } else {
        const { data, error } = await supabase
          .from("autopilot_textos_personalizados" as any)
          .insert({ user_id: user.id, texto, ativo: true } as any)
          .select()
          .single();
        if (error) throw error;
        setTextos(prev => prev.map((t, i) => i === idx ? { ...t, id: (data as any).id, texto, dirty: false } : t));
      }
      toast.success("Texto salvo");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar texto");
    } finally {
      setSavingIdx(null);
    }
  };

  const excluirTexto = async (idx: number) => {
    const item = textos[idx];
    if (item.id) {
      const { error } = await supabase
        .from("autopilot_textos_personalizados" as any)
        .delete()
        .eq("id", item.id);
      if (error) {
        toast.error(error.message || "Erro ao excluir");
        return;
      }
    }
    setTextos(prev => prev.filter((_, i) => i !== idx));
    toast.success("Texto removido");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" /> Meus Textos Personalizados
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          A plataforma vai rotacionar entre eles aleatoriamente em cada post
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {textos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum texto cadastrado ainda. Adicione pelo menos 1 para usar sem IA.
          </p>
        )}

        {textos.map((t, idx) => {
          const len = t.texto.length;
          const overLimit = len > LIMITE_CARACTERES;
          return (
            <div key={t.id ?? `novo-${idx}`} className="space-y-2 border border-border rounded-md p-3 bg-card">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Texto {idx + 1}</Label>
                {t.dirty && <span className="text-[10px] text-amber-600 dark:text-amber-400">não salvo</span>}
              </div>
              <Textarea
                value={t.texto}
                onChange={(e) => updateLocal(idx, e.target.value)}
                rows={3}
                placeholder="Digite seu texto aqui..."
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <span className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
                  {len} / {LIMITE_CARACTERES}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => salvarTexto(idx)}
                    disabled={savingIdx === idx || !t.dirty}
                  >
                    {savingIdx === idx ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => excluirTexto(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {textos.length < LIMITE_TEXTOS && (
          <Button variant="outline" size="sm" onClick={adicionarTexto} className="w-full">
            <Plus className="h-3 w-3 mr-1" /> Adicionar texto ({textos.length}/{LIMITE_TEXTOS})
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
