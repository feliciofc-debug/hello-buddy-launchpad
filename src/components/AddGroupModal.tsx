import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AddGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupAdded: () => void;
}

export const AddGroupModal = ({ open, onOpenChange, onGroupAdded }: AddGroupModalProps) => {
  const [groupLink, setGroupLink] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinGroup = async () => {
    try {
      setIsJoining(true);

      // Validar link
      if (!groupLink.includes('chat.whatsapp.com/')) {
        toast.error('Link inválido. Use o link de convite do grupo.');
        return;
      }

      // Extrair código do convite
      const inviteCode = groupLink.split('chat.whatsapp.com/')[1]?.split('?')[0];
      
      if (!inviteCode) {
        toast.error('Não foi possível extrair o código do convite');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      toast.info('🔗 Conectando ao grupo...');

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('join-group-by-link', {
        body: { 
          userId: user.id,
          inviteCode: inviteCode 
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar grupo');
      }

      toast.success(`✅ Grupo "${data.groupName}" conectado com sucesso!`);
      
      // Limpar e fechar
      setGroupLink('');
      onOpenChange(false);
      
      // Recarregar grupos
      onGroupAdded();

    } catch (error: any) {
      console.error('Erro ao conectar grupo:', error);
      toast.error(error.message || 'Erro ao conectar grupo');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar Grupo via Link</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Input do Link */}
          <div>
            <Label>Link de Convite do Grupo *</Label>
            <Input
              placeholder="https://chat.whatsapp.com/ABC123DEF456"
              value={groupLink}
              onChange={(e) => setGroupLink(e.target.value)}
            />
          </div>

          {/* Instruções */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="font-medium text-sm mb-2">📱 Como pegar o link:</p>
            <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
              <li>Abra o grupo no WhatsApp</li>
              <li>Toque no nome do grupo no topo</li>
              <li>Toque em "Link de convite"</li>
              <li>Toque em "Copiar link"</li>
              <li>Cole aqui acima</li>
            </ol>
          </div>

          {/* Botão */}
          <Button 
            onClick={handleJoinGroup}
            disabled={!groupLink.trim() || isJoining}
            className="w-full"
          >
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              '✅ Conectar Grupo'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
