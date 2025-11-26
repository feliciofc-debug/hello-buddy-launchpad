import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupAdded: () => void;
}

export const AddGroupModal = ({ open, onOpenChange, onGroupAdded }: AddGroupModalProps) => {
  const [manualGroupId, setManualGroupId] = useState('');
  const [manualGroupName, setManualGroupName] = useState('');
  const [pastedNumbers, setPastedNumbers] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddManualGroup = async () => {
    try {
      setIsAdding(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { error } = await supabase
        .from('whatsapp_groups')
        .insert({
          user_id: user.id,
          group_id: manualGroupId.trim(),
          group_name: manualGroupName.trim(),
          member_count: 0,
          status: 'active'
        });

      if (error) throw error;

      toast.success('✅ Grupo adicionado com sucesso!');
      setManualGroupId('');
      setManualGroupName('');
      onOpenChange(false);
      onGroupAdded();
    } catch (error: any) {
      console.error('Erro ao adicionar grupo:', error);
      toast.error(error.message || 'Erro ao adicionar grupo');
    } finally {
      setIsAdding(false);
    }
  };

  const downloadCsvTemplate = () => {
    const csv = 'group_id,group_name\n120363123456789@g.us,Exemplo Grupo 1\n120363987654321@g.us,Exemplo Grupo 2';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_grupos.csv';
    link.click();
    toast.success('📥 Modelo baixado com sucesso!');
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAdding(true);

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Remover header
      if (lines.length > 0) lines.shift();

      if (lines.length === 0) {
        toast.error('CSV vazio ou sem dados');
        return;
      }

      const grupos = lines
        .map(line => {
          const [group_id, group_name] = line.split(',').map(s => s.trim());
          return { group_id, group_name };
        })
        .filter(g => g.group_id && g.group_name);

      if (grupos.length === 0) {
        toast.error('Nenhum grupo válido encontrado no CSV');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const gruposToInsert = grupos.map(g => ({
        user_id: user.id,
        group_id: g.group_id,
        group_name: g.group_name,
        member_count: 0,
        status: 'active'
      }));

      const { error } = await supabase
        .from('whatsapp_groups')
        .insert(gruposToInsert);

      if (error) throw error;

      toast.success(`✅ ${grupos.length} grupos importados com sucesso!`);
      onOpenChange(false);
      onGroupAdded();

      // Limpar input
      e.target.value = '';
    } catch (error: any) {
      console.error('Erro ao importar CSV:', error);
      toast.error(error.message || 'Erro ao importar CSV');
    } finally {
      setIsAdding(false);
    }
  };

  const cleanPhoneNumber = (phone: string): string => {
    return phone.replace(/\D/g, '');
  };

  const isValidBrazilianPhone = (phone: string): boolean => {
    const cleaned = cleanPhoneNumber(phone);
    return cleaned.length === 11 || cleaned.length === 13;
  };

  const handleConvertToContacts = async () => {
    try {
      setIsAdding(true);

      const lines = pastedNumbers
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (lines.length === 0) {
        toast.error('Nenhum número encontrado');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const contatos = lines
        .map(line => cleanPhoneNumber(line))
        .filter(phone => isValidBrazilianPhone(phone))
        .map(phone => ({
          user_id: user.id,
          phone: phone,
          name: `Contato ${phone}`,
          notes: 'Importado via cola de números'
        }));

      if (contatos.length === 0) {
        toast.error('Nenhum número válido encontrado');
        return;
      }

      const { error } = await supabase
        .from('whatsapp_contacts')
        .upsert(contatos, {
          onConflict: 'user_id,phone',
          ignoreDuplicates: true
        });

      if (error) throw error;

      toast.success(`✅ ${contatos.length} contatos importados!`);
      setPastedNumbers('');
      onOpenChange(false);
      onGroupAdded();

    } catch (error: any) {
      console.error('Erro ao importar:', error);
      toast.error(error.message || 'Erro ao importar contatos');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDownloadAsCsv = () => {
    const lines = pastedNumbers
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      toast.error('Nenhum número encontrado');
      return;
    }

    const cleaned = lines
      .map(line => cleanPhoneNumber(line))
      .filter(phone => isValidBrazilianPhone(phone));

    if (cleaned.length === 0) {
      toast.error('Nenhum número válido encontrado');
      return;
    }

    const csv = 'nome,telefone\n' + 
      cleaned.map((phone, index) => `Contato ${index + 1},${phone}`).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contatos_${Date.now()}.csv`;
    link.click();

    toast.success(`📥 CSV com ${cleaned.length} números baixado!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Contatos e Grupos</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="paste">Colar Números</TabsTrigger>
            <TabsTrigger value="csv">Importar CSV</TabsTrigger>
          </TabsList>

          {/* ABA 1: MANUAL */}
          <TabsContent value="manual" className="space-y-4">
            <div>
              <Label htmlFor="group-id">ID do Grupo *</Label>
              <Input
                id="group-id"
                placeholder="120363123456789@g.us"
                value={manualGroupId}
                onChange={(e) => setManualGroupId(e.target.value)}
                disabled={isAdding}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formato: 120363XXXXXXXXXX@g.us
              </p>
            </div>

            <div>
              <Label htmlFor="group-name">Nome do Grupo *</Label>
              <Input
                id="group-name"
                placeholder="Clientes VIP"
                value={manualGroupName}
                onChange={(e) => setManualGroupName(e.target.value)}
                disabled={isAdding}
              />
            </div>

            <Button
              onClick={handleAddManualGroup}
              disabled={!manualGroupId.trim() || !manualGroupName.trim() || isAdding}
              className="w-full"
            >
              {isAdding ? 'Adicionando...' : 'Adicionar Grupo'}
            </Button>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
              <p className="font-medium mb-2">💡 Como pegar o ID:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Abra WhatsApp Web</li>
                <li>Entre no grupo</li>
                <li>Olhe a URL do navegador</li>
                <li>Copie o ID que termina em <strong>@g.us</strong></li>
              </ol>
            </div>
          </TabsContent>

          {/* ABA 2: COLAR NÚMEROS */}
          <TabsContent value="paste" className="space-y-4">
            <div>
              <Label htmlFor="paste-numbers">Cole os números aqui (um por linha)</Label>
              <Textarea
                id="paste-numbers"
                placeholder="5521999998888&#10;5521999997777&#10;5521988886666"
                value={pastedNumbers}
                onChange={(e) => setPastedNumbers(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                disabled={isAdding}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {pastedNumbers.split('\n').filter(n => n.trim()).length} números detectados
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleConvertToContacts}
                disabled={!pastedNumbers.trim() || isAdding}
                className="flex-1"
              >
                ✅ Importar como Contatos
              </Button>
              
              <Button 
                onClick={handleDownloadAsCsv}
                disabled={!pastedNumbers.trim() || isAdding}
                variant="outline"
                className="flex-1"
              >
                ⬇️ Baixar CSV
              </Button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
              <p className="font-medium mb-2">💡 Formatos aceitos:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>5521999998888</li>
                <li>(21) 99999-8888</li>
                <li>21 99999-8888</li>
                <li>+55 21 99999-8888</li>
              </ul>
              <p className="mt-2 text-muted-foreground">
                O sistema remove automaticamente caracteres especiais
              </p>
            </div>
          </TabsContent>

          {/* ABA 3: CSV */}
          <TabsContent value="csv" className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
                id="csv-upload"
                disabled={isAdding}
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📄</div>
                <p className="font-medium">Clique para selecionar CSV</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ou arraste o arquivo aqui
                </p>
              </label>
            </div>

            <Button
              onClick={downloadCsvTemplate}
              variant="outline"
              className="w-full"
              disabled={isAdding}
            >
              ⬇️ Baixar Modelo CSV
            </Button>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
              <p className="font-medium mb-2">📋 Formato do CSV:</p>
              <pre className="bg-white dark:bg-gray-900 p-2 rounded mt-2 text-xs overflow-x-auto">
group_id,group_name
120363123456789@g.us,Clientes VIP
120363987654321@g.us,Grupo Ofertas
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
