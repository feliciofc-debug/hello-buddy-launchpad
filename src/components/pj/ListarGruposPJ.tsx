"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Copy, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface GrupoPJ {
  id: string;
  nome: string;
  grupo_jid: string;
  invite_link?: string | null;
  participantes_count: number;
  ativo: boolean;
  created_at: string;
}

export default function ListarGruposPJ() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [grupos, setGrupos] = useState<GrupoPJ[]>([]);

  const carregarGrupos = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("pj_grupos_whatsapp")
        .select("*")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGrupos(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar grupos:", err);
      toast.error("Erro ao carregar grupos");
    } finally {
      setLoading(false);
    }
  };

  const sincronizarGrupos = async () => {
    setSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke("list-whatsapp-groups-pj", {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`${data.total || 0} grupos sincronizados`);
        await carregarGrupos();
      } else {
        throw new Error(data?.error || "Erro ao sincronizar");
      }
    } catch (err: any) {
      console.error("Erro ao sincronizar:", err);
      toast.error(err.message || "Erro ao sincronizar grupos");
    } finally {
      setSyncing(false);
    }
  };

  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  useEffect(() => {
    carregarGrupos();
  }, []);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-green-500" />
            Meus Grupos WhatsApp
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={sincronizarGrupos}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="ml-2">Sincronizar</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : grupos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum grupo encontrado</p>
            <p className="text-sm mt-1">Crie um grupo ou clique em "Sincronizar" para buscar grupos existentes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grupos.map((grupo) => (
              <div
                key={grupo.id}
                className="bg-muted/30 border border-border/50 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{grupo.nome}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {grupo.participantes_count} participante(s) • Criado em{" "}
                      {new Date(grupo.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                {grupo.invite_link && (
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      value={grupo.invite_link}
                      readOnly
                      className="text-xs bg-background/50 flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copiarLink(grupo.invite_link!)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <a href={grupo.invite_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
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
