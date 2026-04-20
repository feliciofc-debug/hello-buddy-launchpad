import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Rocket, Facebook, Instagram, Calendar, Clock, Package, Sparkles, Play, Pause } from "lucide-react";

export const AutopilotConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    id: null as string | null,
    nome: "Meu Autopilot",
    produto_fonte: "todos",
    categoria_filtro: "",
    postar_facebook: true,
    postar_instagram: true,
    posts_por_dia: 3,
    dias_semana: [1, 2, 3, 4, 5, 6],
    horario_inicio: "08:00",
    horario_fim: "22:00",
    incluir_imagem: true,
    incluir_link: true,
    gerar_texto_ia: true,
    estilo_texto: "variado",
    repetir_ciclo: true,
    ativo: false,
    total_publicados: 0,
    ultimo_produto_index: 0,
  });
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    void initialize();
  }, []);

  const initialize = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      await Promise.all([
        loadConfig(user.id),
        loadProdutos(user.id),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("autopilot_config" as any)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setConfig(prev => ({ ...prev, ...(data as any) }));
      }
    } catch (err) {
      console.error("Erro ao carregar config:", err);
    }
  };

  const loadProdutos = async (userId: string) => {
    const { count, error: countError } = await supabase
      .from("produtos")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("user_id", userId);

    if (countError) {
      console.error("Erro ao contar produtos:", countError);
    }

    setTotalProdutos(count || 0);

    const { data, error } = await supabase
      .from("produtos")
      .select("categoria")
      .eq("ativo", true)
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao carregar categorias:", error);
      return;
    }

    if (data) {
      const cats = [...new Set(data.map((p: any) => p.categoria).filter(Boolean))] as string[];
      setCategorias(cats);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado"); return; }

      const payload = {
        user_id: user.id,
        nome: config.nome,
        produto_fonte: config.produto_fonte,
        categoria_filtro: config.produto_fonte === "categoria" ? (config.categoria_filtro || null) : null,
        postar_facebook: config.postar_facebook,
        postar_instagram: config.postar_instagram,
        posts_por_dia: config.posts_por_dia,
        dias_semana: config.dias_semana,
        horario_inicio: config.horario_inicio,
        horario_fim: config.horario_fim,
        incluir_imagem: config.incluir_imagem,
        incluir_link: config.incluir_link,
        gerar_texto_ia: config.gerar_texto_ia,
        estilo_texto: config.estilo_texto,
        repetir_ciclo: config.repetir_ciclo,
        ativo: config.ativo,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        const { error } = await supabase
          .from("autopilot_config" as any)
          .update(payload as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("autopilot_config" as any)
          .insert(payload as any)
          .select()
          .single();
        if (error) throw error;
        if (data) setConfig(prev => ({ ...prev, id: (data as any).id }));
      }
      toast.success("Configuração salva com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async () => {
    const novoEstado = !config.ativo;
    setConfig(prev => ({ ...prev, ativo: novoEstado }));

    if (config.id) {
      const updateData: any = { ativo: novoEstado, updated_at: new Date().toISOString() };
      if (novoEstado) updateData.proxima_execucao = new Date().toISOString();

      const { error } = await supabase
        .from("autopilot_config" as any)
        .update(updateData)
        .eq("id", config.id);

      if (error) {
        setConfig(prev => ({ ...prev, ativo: !novoEstado }));
        toast.error(error.message || "Erro ao alterar status do Autopilot");
        return;
      }

      toast.success(novoEstado ? "🚀 Autopilot ATIVADO!" : "⏸️ Autopilot pausado");
    } else {
      toast.error("Salve a configuração primeiro");
      setConfig(prev => ({ ...prev, ativo: false }));
    }
  };

  const diasSemanaLabels = [
    { value: 0, label: "Dom" },
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
    { value: 6, label: "Sáb" },
  ];

  const toggleDia = (dia: number) => {
    if (config.dias_semana.includes(dia)) {
      setConfig(prev => ({ ...prev, dias_semana: prev.dias_semana.filter(d => d !== dia) }));
    } else {
      setConfig(prev => ({ ...prev, dias_semana: [...prev.dias_semana, dia].sort() }));
    }
  };

  const diasAtivos = config.dias_semana.length;
  const postsMensais = diasAtivos * config.posts_por_dia * 4;
  const diasParaCobrir = totalProdutos > 0 ? Math.ceil(totalProdutos / Math.max(config.posts_por_dia, 1)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com status */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Autopilot Social</h3>
          </div>
          <p className="text-sm text-muted-foreground">Configure uma vez. A plataforma posta automaticamente todos os dias.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={config.ativo ? "default" : "secondary"}>
            {config.ativo ? "🟢 ATIVO" : "⏸️ PAUSADO"}
          </Badge>
          <Button variant={config.ativo ? "destructive" : "default"} size="sm" onClick={toggleAtivo}>
            {config.ativo ? <><Pause className="h-4 w-4 mr-1" /> Pausar</> : <><Play className="h-4 w-4 mr-1" /> Ativar</>}
          </Button>
        </div>
      </div>

      {/* Projeção */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalProdutos}</p>
            <p className="text-xs text-muted-foreground">Produtos disponíveis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{postsMensais}</p>
            <p className="text-xs text-muted-foreground">Posts estimados/mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{diasParaCobrir}</p>
            <p className="text-xs text-muted-foreground">Dias até cobrir tudo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{config.total_publicados}</p>
            <p className="text-xs text-muted-foreground">Já publicados</p>
          </CardContent>
        </Card>
      </div>

      {/* Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coluna 1: Produtos e Redes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" /> Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Quais produtos postar?</Label>
              <Select value={config.produto_fonte} onValueChange={(v) => setConfig(prev => ({ ...prev, produto_fonte: v, categoria_filtro: v === "categoria" ? prev.categoria_filtro : "" }))}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="todos">Todos os meus produtos ativos ({totalProdutos})</SelectItem>
                  <SelectItem value="categoria">Por categoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.produto_fonte === "categoria" && (
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={config.categoria_filtro} onValueChange={(v) => setConfig(prev => ({ ...prev, categoria_filtro: v }))}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-background">
                    {categorias.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3">
              <Label>Redes sociais</Label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Facebook</span>
                </div>
                <Switch checked={config.postar_facebook} onCheckedChange={(v) => setConfig(prev => ({ ...prev, postar_facebook: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-600" />
                  <span className="text-sm">Instagram (requer imagem)</span>
                </div>
                <Switch checked={config.postar_instagram} onCheckedChange={(v) => setConfig(prev => ({ ...prev, postar_instagram: v }))} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Incluir imagem do produto</Label>
                <Switch checked={config.incluir_imagem} onCheckedChange={(v) => setConfig(prev => ({ ...prev, incluir_imagem: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Incluir link do produto</Label>
                <Switch checked={config.incluir_link} onCheckedChange={(v) => setConfig(prev => ({ ...prev, incluir_link: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Repetir quando acabar os produtos</Label>
                <Switch checked={config.repetir_ciclo} onCheckedChange={(v) => setConfig(prev => ({ ...prev, repetir_ciclo: v }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coluna 2: Frequência e Horários */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Frequência e Horários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Posts por dia</Label>
              <Select value={String(config.posts_por_dia)} onValueChange={(v) => setConfig(prev => ({ ...prev, posts_por_dia: parseInt(v) }))}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="1">1 post por dia</SelectItem>
                  <SelectItem value="2">2 posts por dia</SelectItem>
                  <SelectItem value="3">3 posts por dia (recomendado)</SelectItem>
                  <SelectItem value="4">4 posts por dia</SelectItem>
                  <SelectItem value="5">5 posts por dia</SelectItem>
                  <SelectItem value="6">6 posts por dia</SelectItem>
                  <SelectItem value="8">8 posts por dia</SelectItem>
                  <SelectItem value="10">10 posts por dia</SelectItem>
                  <SelectItem value="15">15 posts por dia</SelectItem>
                  <SelectItem value="20">20 posts por dia</SelectItem>
                  <SelectItem value="25">25 posts por dia</SelectItem>
                  <SelectItem value="30">30 posts por dia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <div className="flex gap-1 flex-wrap">
                {diasSemanaLabels.map(dia => (
                  <Button
                    key={dia.value}
                    size="sm"
                    variant={config.dias_semana.includes(dia.value) ? "default" : "outline"}
                    onClick={() => toggleDia(dia.value)}
                    className="w-12"
                  >
                    {dia.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Horário início</Label>
                <Input type="time" value={config.horario_inicio} onChange={(e) => setConfig(prev => ({ ...prev, horario_inicio: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Horário fim</Label>
                <Input type="time" value={config.horario_fim} onChange={(e) => setConfig(prev => ({ ...prev, horario_fim: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estilo do texto gerado pela IA</Label>
              <Select value={config.estilo_texto} onValueChange={(v) => setConfig(prev => ({ ...prev, estilo_texto: v }))}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="variado">🔄 Variado (alterna estilos)</SelectItem>
                  <SelectItem value="casual">😊 Casual / Amigável</SelectItem>
                  <SelectItem value="informativo">📊 Informativo / Profissional</SelectItem>
                  <SelectItem value="urgente">🔥 Urgente / Promocional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-1"><Sparkles className="h-3 w-3" /> Gerar texto com IA</Label>
              <Switch checked={config.gerar_texto_ia} onCheckedChange={(v) => setConfig(prev => ({ ...prev, gerar_texto_ia: v }))} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão salvar */}
      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Rocket className="h-4 w-4 mr-2" /> Salvar Configuração</>}
      </Button>
    </div>
  );
};
