import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Plus } from 'lucide-react';

interface AddGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupAdded: () => void;
}

export const AddGroupModal = ({ open, onOpenChange, onGroupAdded }: AddGroupModalProps) => {
  const [loading, setLoading] = useState(false);
  
  // Manual
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [memberCount, setMemberCount] = useState('');

  const handleSyncFromWuzapi = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      toast.info('🔄 Sincronizando grupos do WhatsApp...');

      // Chamar função dedicada para sincronizar grupos
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: {
          userId: user.id
        }
      });

      if (error) throw error;

      // Edge function já salva no banco, só precisa verificar sucesso
      if (data?.success && data.groupsCount > 0) {
        toast.success(`✅ ${data.groupsCount} grupos sincronizados!`);
        onGroupAdded();
        onOpenChange(false);
      } else {
        toast.warning(data?.error || 'Nenhum grupo encontrado no WhatsApp');
      }

    } catch (error: any) {
      console.error('Erro ao sincronizar grupos:', error);
      toast.error('Erro ao sincronizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!groupId || !groupName) {
      toast.error('Preencha o ID e nome do grupo');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('whatsapp_groups')
        .insert({
          user_id: user.id,
          group_id: groupId,
          group_name: groupName,
          member_count: parseInt(memberCount) || 0,
          status: 'active'
        });

      if (error) throw error;

      toast.success('✅ Grupo adicionado!');
      
      // Limpar form
      setGroupId('');
      setGroupName('');
      setMemberCount('');
      
      onGroupAdded();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Erro ao adicionar grupo:', error);
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Grupo do WhatsApp</DialogTitle>
          <DialogDescription>
            Sincronize seus grupos do WhatsApp ou adicione manualmente
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="sync" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sync">Sincronizar</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="sync" className="space-y-4 pt-4">
            <div className="text-center py-6">
              <RefreshCw className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h3 className="font-bold text-lg mb-2">Sincronizar Grupos</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Busque automaticamente todos os grupos do seu WhatsApp conectado
              </p>
              <Button 
                onClick={handleSyncFromWuzapi}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sincronizar Agora
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupId">ID do Grupo *</Label>
                <Input
                  id="groupId"
                  placeholder="Ex: 120363123456789012@g.us"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  💡 O ID do grupo termina com @g.us
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupName">Nome do Grupo *</Label>
                <Input
                  id="groupName"
                  placeholder="Ex: Clientes VIP"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memberCount">Quantidade de Membros</Label>
                <Input
                  id="memberCount"
                  type="number"
                  placeholder="Ex: 50"
                  value={memberCount}
                  onChange={(e) => setMemberCount(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleManualAdd}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  'Adicionando...'
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Grupo
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
