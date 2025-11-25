import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WhatsAppGrupos() {
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState<any[]>([]);
  const [selectedGrupos, setSelectedGrupos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      toast.loading("Carregando grupos do WhatsApp...");

      const { data, error } = await supabase.functions.invoke("get-whatsapp-chats", {
        body: { userId: user.id }
      });

      toast.dismiss();

      if (error) {
        console.error("Erro ao carregar:", error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || "Erro ao carregar grupos");
      }

      setGrupos(data.grupos || []);
      toast.success(`✅ ${data.grupos?.length || 0} grupos encontrados!`);
      
    } catch (error: any) {
      toast.dismiss();
      console.error("Erro:", error);
      toast.error("Erro ao carregar grupos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroups = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Preparar grupos para salvar
      const gruposToSave = selectedGrupos.map(id => {
        const grupo = grupos.find(g => g.id === id);
        return {
          user_id: user.id,
          group_id: grupo.id,
          group_name: grupo.nome,
          member_count: grupo.membros
        };
      });

      // Limpar grupos antigos
      await supabase
        .from("whatsapp_groups")
        .delete()
        .eq("user_id", user.id);

      // Inserir novos
      const { error } = await supabase
        .from("whatsapp_groups")
        .insert(gruposToSave);

      if (error) throw error;

      toast.success(`✅ ${selectedGrupos.length} grupos salvos!`);
      
      // Voltar para página do WhatsApp
      setTimeout(() => {
        navigate("/whatsapp");
      }, 1500);
      
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar grupos");
    } finally {
      setSaving(false);
    }
  };

  const toggleGrupo = (id: string) => {
    if (selectedGrupos.includes(id)) {
      setSelectedGrupos(selectedGrupos.filter(g => g !== id));
    } else {
      setSelectedGrupos([...selectedGrupos, id]);
    }
  };

  const filteredGrupos = grupos.filter(g => 
    g.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/whatsapp")}
            className="mb-4"
          >
            ← Voltar
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">Selecionar Grupos do WhatsApp</h1>
          <p className="text-muted-foreground">
            Marque os grupos que você deseja usar para enviar campanhas
          </p>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="🔍 Buscar grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando grupos do WhatsApp...</p>
          </div>
        ) : filteredGrupos.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-lg">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl font-medium mb-2">Nenhum grupo encontrado</p>
            <p className="text-muted-foreground mb-4">
              {search ? "Tente outro termo de busca" : "Você não participa de nenhum grupo do WhatsApp"}
            </p>
            <Button onClick={loadChats} variant="outline">
              🔄 Recarregar
            </Button>
          </div>
        ) : (
          <>
            <div className="bg-card border rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {selectedGrupos.length} de {filteredGrupos.length} grupos selecionados
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Selecione os grupos que deseja usar para campanhas
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedGrupos.length === filteredGrupos.length) {
                      setSelectedGrupos([]);
                    } else {
                      setSelectedGrupos(filteredGrupos.map(g => g.id));
                    }
                  }}
                >
                  {selectedGrupos.length === filteredGrupos.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {filteredGrupos.map(grupo => (
                <div 
                  key={grupo.id} 
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => toggleGrupo(grupo.id)}
                >
                  <Checkbox
                    checked={selectedGrupos.includes(grupo.id)}
                    onCheckedChange={() => toggleGrupo(grupo.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{grupo.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {grupo.membros} membro{grupo.membros !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>

            <div className="sticky bottom-6 bg-background/95 backdrop-blur-sm border rounded-lg p-4">
              <Button
                onClick={handleSaveGroups}
                disabled={selectedGrupos.length === 0 || saving}
                className="w-full"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    💾 Salvar {selectedGrupos.length} grupo{selectedGrupos.length !== 1 ? "s" : ""} selecionado{selectedGrupos.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
