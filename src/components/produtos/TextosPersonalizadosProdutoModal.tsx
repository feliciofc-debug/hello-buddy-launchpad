import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Plus, Save, Trash2, Sparkles, AlertTriangle } from "lucide-react";

const LIMITE_TEXTOS = 10;
const LIMITE_CARACTERES = 2200;

interface TextoItem {
  id: string | null;
  texto: string;
  ativo: boolean;
  dirty: boolean;
}

interface ProdutoLite {
  id: string;
  nome: string;
  descricao?: string | null;
  preco?: number | null;
  usa_textos_personalizados?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: ProdutoLite | null;
  onModoChange?: (produtoId: string, ativado: boolean) => void;
}

export const TextosPersonalizadosProdutoModal = ({ open, onOpenChange, produto, onModoChange }: Props) => {
  const [loading, setLoading] = useState(true);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [textos, setTextos] = useState<TextoItem[]>([]);
  const [usaPersonalizado, setUsaPersonalizado] = useState(false);
  const [togglingModo, setTogglingModo] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);

  useEffect(() => {
    if (open && produto) {
      setUsaPersonalizado(!!produto.usa_textos_personalizados);
      void carregar();
    }
  }, [open, produto?.id]);

  const carregar = async () => {
    if (!produto) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("autopilot_textos_personalizados" as any)
        .select("*")
        .eq("produto_id", produto.id)
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

  const adicionarManual = () => {
    if (textos.length >= LIMITE_TEXTOS) {
      toast.error(`Limite de ${LIMITE_TEXTOS} textos atingido`);
      return;
    }
    setTextos(prev => [...prev, { id: null, texto: "", ativo: true, dirty: true }]);
  };

  const gerarComIA = async () => {
    if (!produto) return;
    if (textos.length >= LIMITE_TEXTOS) {
      toast.error(`Limite de ${LIMITE_TEXTOS} textos atingido`);
      return;
    }
    setGerandoIA(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-posts", {
        body: {
          produto: {
            nome: produto.nome,
            preco: produto.preco,
            descricao: produto.descricao || "",
          },
        },
      });
      if (error) throw error;

      const sugestao =
        data?.posts?.instagram?.opcaoA ||
        data?.posts?.facebook?.opcaoA ||
        "";

      if (!sugestao) {
        toast.error("IA não retornou texto. Tente de novo ou adicione manualmente.");
        return;
      }

      setTextos(prev => [...prev, { id: null, texto: sugestao, ativo: true, dirty: true }]);
      toast.success("Texto gerado pela IA. Revise e clique em Salvar.");
    } catch (err: any) {
      console.error("Erro IA:", err);
      toast.error("Erro ao gerar texto com IA");
    } finally {
      setGerandoIA(false);
    }
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
    if (!produto) return;

    setSavingIdx(idx);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado"); return; }

      if (item.id) {
        const { error } = await supabase
          .from("autopilot_textos_personalizados" as any)
          .update({ texto, ativo: item.ativo })
          .eq("id", item.id);
        if (error) throw error;
        setTextos(prev => prev.map((t, i) => i === idx ? { ...t, texto, dirty: false } : t));
      } else {
        const { data, error } = await supabase
          .from("autopilot_textos_personalizados" as any)
          .insert({ user_id: user.id, produto_id: produto.id, texto, ativo: true } as any)
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

  const toggleAtivoTexto = async (idx: number, ativo: boolean) => {
    const item = textos[idx];
    setTextos(prev => prev.map((t, i) => i === idx ? { ...t, ativo, dirty: !item.id } : t));
    if (item.id) {
      const { error } = await supabase
        .from("autopilot_textos_personalizados" as any)
        .update({ ativo })
        .eq("id", item.id);
      if (error) toast.error("Erro ao atualizar status");
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

  const toggleModoPersonalizado = async (novo: boolean) => {
    if (!produto) return;
    const textosAtivos = textos.filter(t => t.id && t.ativo).length;
    if (novo && textosAtivos === 0) {
      toast.error("Adicione e salve pelo menos 1 texto antes de ativar o modo personalizado.");
      return;
    }
    setTogglingModo(true);
    try {
      const { error } = await supabase
        .from("produtos")
        .update({ usa_textos_personalizados: novo })
        .eq("id", produto.id);
      if (error) throw error;
      setUsaPersonalizado(novo);
      onModoChange?.(produto.id, novo);
      toast.success(novo ? "Modo personalizado ATIVADO" : "Modo personalizado desativado — voltou pra IA");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar modo");
    } finally {
      setTogglingModo(false);
    }
  };

  if (!produto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Textos Personalizados
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Produto: <span className="font-medium text-foreground">{produto.nome}</span>
          </p>
        </DialogHeader>

        {usaPersonalizado && (
          <div className="flex gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">Modo personalizado ATIVO</p>
              <p className="text-amber-800 dark:text-amber-300 text-xs mt-1">
                Este produto NÃO usa IA. O Autopilot vai postar APENAS os textos abaixo (rotação aleatória).
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={gerarComIA} disabled={gerandoIA} className="gap-2">
            {gerandoIA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar com IA
          </Button>
          <Button variant="outline" size="sm" onClick={adicionarManual} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar Manual
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {textos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
                Nenhum texto cadastrado. Adicione pelo menos 1 para ativar o modo personalizado.
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
                    rows={4}
                    placeholder="Digite seu texto aqui..."
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
                      {len} / {LIMITE_CARACTERES}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 mr-2">
                        <Switch
                          checked={t.ativo}
                          onCheckedChange={(v) => toggleAtivoTexto(idx, v)}
                          disabled={!t.id}
                        />
                        <span className="text-[10px] text-muted-foreground">{t.ativo ? "ativo" : "inativo"}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => salvarTexto(idx)}
                        disabled={savingIdx === idx || !t.dirty}
                      >
                        {savingIdx === idx ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluirTexto(idx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between p-3 rounded-md bg-muted">
          <div>
            <p className="font-medium text-sm">Status do modo personalizado</p>
            <p className="text-xs text-muted-foreground">
              {usaPersonalizado ? "Ativo — IA desligada para este produto" : "Inativo — Autopilot usa IA padrão"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {togglingModo && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={usaPersonalizado}
              onCheckedChange={toggleModoPersonalizado}
              disabled={togglingModo}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
