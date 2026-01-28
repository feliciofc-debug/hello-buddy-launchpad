"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function CriarGrupoWhatsAppPJ() {
  const [loading, setLoading] = useState(false);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gruposCriados, setGruposCriados] = useState<Array<{
    nome: string;
    inviteLink: string | null;
    groupJid: string;
  }>>([]);

  const criarGrupo = async () => {
    if (!nomeGrupo.trim()) {
      toast.error("Digite o nome do grupo");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-whatsapp-group-pj", {
        body: {
          groupName: nomeGrupo.trim(),
          descricao: descricao.trim() || null,
          userId: user.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`✅ Grupo "${nomeGrupo}" criado com sucesso!`);
        
        setGruposCriados(prev => [...prev, {
          nome: nomeGrupo,
          inviteLink: data.inviteLink,
          groupJid: data.groupJid
        }]);
        
        // Limpar campos
        setNomeGrupo("");
        setDescricao("");
      } else {
        throw new Error(data?.error || "Erro ao criar grupo");
      }
    } catch (err: any) {
      console.error("Erro ao criar grupo:", err);
      toast.error(err.message || "Erro ao criar grupo");
    } finally {
      setLoading(false);
    }
  };

  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-green-500" />
          Criar Grupo WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome-grupo">Nome do Grupo</Label>
          <Input
            id="nome-grupo"
            value={nomeGrupo}
            onChange={(e) => setNomeGrupo(e.target.value)}
            placeholder="Ex: Ofertas AMZ - VIP"
            className="bg-background/50"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descricao-grupo">Descrição (opcional)</Label>
          <Textarea
            id="descricao-grupo"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição do grupo..."
            className="bg-background/50 min-h-[80px]"
            disabled={loading}
          />
        </div>

        <Button 
          onClick={criarGrupo} 
          disabled={loading || !nomeGrupo.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Criando grupo...
            </>
          ) : (
            <>
              <Users className="w-4 h-4 mr-2" />
              Criar Grupo
            </>
          )}
        </Button>

        {/* Grupos criados */}
        {gruposCriados.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Grupos criados:</p>
            {gruposCriados.map((grupo, idx) => (
              <div key={idx} className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">{grupo.nome}</span>
                </div>
                {grupo.inviteLink && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input 
                      value={grupo.inviteLink} 
                      readOnly 
                      className="text-xs bg-background/50"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copiarLink(grupo.inviteLink!)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
