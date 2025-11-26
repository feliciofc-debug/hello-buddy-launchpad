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
  const [pastedNumbers, setPastedNumbers] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleCreateGroup = async () => {
    try {
      setIsAdding(true);

      const phones = extractPhoneNumbers(pastedNumbers);

      if (phones.length === 0) {
        toast.error('Nenhum número válido encontrado');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const name = groupName.trim() || `Grupo ${new Date().toLocaleString('pt-BR')}`;

      const { error } = await supabase
        .from('whatsapp_groups')
        .insert({
          user_id: user.id,
          group_id: `manual_${Date.now()}@g.us`,
          group_name: name,
          member_count: phones.length,
          phone_numbers: phones,
          status: 'active'
        });

      if (error) throw error;

      toast.success(`✅ Grupo criado com ${phones.length} contatos!`);
      setPastedNumbers('');
      setGroupName('');
      onOpenChange(false);
      onGroupAdded();
    } catch (error: any) {
      console.error('Erro ao criar grupo:', error);
      toast.error(error.message || 'Erro ao criar grupo');
    } finally {
      setIsAdding(false);
    }
  };

  const downloadCsvTemplate = () => {
    const csv = 'telefone\n5521999998888\n5521999997777\n5528999879585';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo.csv';
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

      const numbers = lines
        .map(line => {
          const phone = line.split(',')[0]?.replace(/\D/g, '');
          return phone;
        })
        .filter(n => n && n.length >= 10)
        .map(n => normalizePhoneNumber(n));

      if (numbers.length === 0) {
        toast.error('CSV vazio ou inválido');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const name = `Grupo CSV ${new Date().toLocaleString('pt-BR')}`;

      const { error } = await supabase
        .from('whatsapp_groups')
        .insert({
          user_id: user.id,
          group_id: `csv_${Date.now()}@g.us`,
          group_name: name,
          member_count: numbers.length,
          phone_numbers: numbers,
          status: 'active'
        });

      if (error) throw error;

      toast.success(`✅ ${numbers.length} contatos importados do CSV!`);
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
    return cleaned.length >= 10 && cleaned.length <= 13;
  };

  const normalizePhoneNumber = (phone: string): string => {
    const cleaned = cleanPhoneNumber(phone);
    if (cleaned.length === 10 || cleaned.length === 11) {
      return '55' + cleaned;
    }
    return cleaned;
  };

  const extractPhoneNumbers = (text: string): string[] => {
    if (!text.trim()) return [];
    
    const phones: string[] = [];
    
    // Tentar separar por delimitadores primeiro
    const delimitedParts = text.split(/[\s,\n]+/).filter(p => p.trim());
    
    if (delimitedParts.length > 1 || (delimitedParts.length === 1 && text.includes(' '))) {
      // Tem delimitadores, processar cada parte
      delimitedParts.forEach(part => {
        const cleanPart = cleanPhoneNumber(part);
        if (isValidBrazilianPhone(cleanPart)) {
          phones.push(normalizePhoneNumber(cleanPart));
        }
      });
    } else {
      // Tudo junto, dividir em blocos de 10-13 dígitos
      const cleaned = cleanPhoneNumber(text);
      let i = 0;
      while (i < cleaned.length) {
        let found = false;
        for (let len = 13; len >= 10; len--) {
          const block = cleaned.substring(i, i + len);
          if (block.length === len && isValidBrazilianPhone(block)) {
            phones.push(normalizePhoneNumber(block));
            i += len;
            found = true;
            break;
          }
        }
        if (!found) i++;
      }
    }

    // Remover duplicados
    return [...new Set(phones)];
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Contatos e Grupos</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="paste" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">Colar Números</TabsTrigger>
            <TabsTrigger value="csv">Importar CSV</TabsTrigger>
          </TabsList>

          {/* ABA 1: COLAR NÚMEROS */}
          <TabsContent value="paste" className="space-y-4">
            <div>
              <Label htmlFor="paste-numbers">Cole os números aqui</Label>
              <Textarea
                id="paste-numbers"
                placeholder="5521999998888 5521999997777"
                value={pastedNumbers}
                onChange={(e) => setPastedNumbers(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                disabled={isAdding}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {extractPhoneNumbers(pastedNumbers).length} números válidos detectados
              </p>
            </div>

            <div>
              <Label htmlFor="group-name">Nome do Grupo (opcional)</Label>
              <Input
                id="group-name"
                placeholder="Deixe vazio para gerar automático"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={isAdding}
              />
            </div>

            <Button 
              onClick={handleCreateGroup}
              disabled={!pastedNumbers.trim() || isAdding}
              className="w-full"
            >
              {isAdding ? 'Criando...' : 'Criar Grupo'}
            </Button>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
              <p className="font-medium mb-2">💡 Formatos aceitos:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>5521999998888</li>
                <li>(21) 99999-8888</li>
                <li>Separados por espaço, vírgula ou linha</li>
              </ul>
            </div>
          </TabsContent>

          {/* ABA 2: CSV */}
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
telefone
5521999998888
5521999997777
5528999879585
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
