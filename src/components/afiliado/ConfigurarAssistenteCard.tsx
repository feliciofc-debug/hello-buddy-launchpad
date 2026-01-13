import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ConfigurarAssistenteCard() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nomeAssistente, setNomeAssistente] = useState("Pietro Eugenio");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('clientes_afiliados')
        .select('nome_assistente')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.nome_assistente) {
        setNomeAssistente(data.nome_assistente);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nomeAssistente.trim()) {
      toast.error('Digite um nome para o assistente');
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { error } = await supabase
        .from('clientes_afiliados')
        .update({ 
          nome_assistente: nomeAssistente.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(`Assistente "${nomeAssistente}" configurado com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          Configurar Assistente Virtual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome-assistente">Nome do Assistente</Label>
          <Input
            id="nome-assistente"
            value={nomeAssistente}
            onChange={(e) => setNomeAssistente(e.target.value)}
            placeholder="Ex: Maria, Carlos, Assistente AMZ..."
            className="bg-background/50"
          />
          <p className="text-xs text-muted-foreground">
            Este nome será usado nas conversas automáticas com seus clientes
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Configuração
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
