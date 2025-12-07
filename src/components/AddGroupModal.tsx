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

interface ContactWithName {
  phone: string;
  nome: string;
}

export const AddGroupModal = ({ open, onOpenChange, onGroupAdded }: AddGroupModalProps) => {
  const [pastedNumbers, setPastedNumbers] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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

  // Extrai contatos no formato "numero,nome" ou só "numero"
  const extractContactsWithNames = (text: string): ContactWithName[] => {
    if (!text.trim()) return [];
    
    const contacts: ContactWithName[] = [];
    const seenPhones = new Set<string>();
    
    // Separar por linhas
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Verificar se tem vírgula (formato numero,nome)
      if (line.includes(',')) {
        const parts = line.split(',');
        const phonePart = parts[0]?.trim() || '';
        const namePart = parts.slice(1).join(',').trim(); // Nome pode ter vírgulas
        
        const cleanedPhone = cleanPhoneNumber(phonePart);
        if (isValidBrazilianPhone(cleanedPhone)) {
          const normalizedPhone = normalizePhoneNumber(cleanedPhone);
          if (!seenPhones.has(normalizedPhone)) {
            seenPhones.add(normalizedPhone);
            contacts.push({
              phone: normalizedPhone,
              nome: namePart || ''
            });
          }
        }
      } else {
        // Formato antigo - só números separados por espaço
        const parts = line.split(/\s+/).filter(p => p.trim());
        for (const part of parts) {
          const cleanedPhone = cleanPhoneNumber(part);
          if (isValidBrazilianPhone(cleanedPhone)) {
            const normalizedPhone = normalizePhoneNumber(cleanedPhone);
            if (!seenPhones.has(normalizedPhone)) {
              seenPhones.add(normalizedPhone);
              contacts.push({
                phone: normalizedPhone,
                nome: ''
              });
            }
          }
        }
      }
    }
    
    return contacts;
  };

  // Salvar contatos automaticamente em whatsapp_contacts
  const saveContactsToDatabase = async (userId: string, contacts: ContactWithName[]) => {
    if (contacts.length === 0) return;
    
    const contactsWithNames = contacts.filter(c => c.nome);
    if (contactsWithNames.length === 0) return;
    
    console.log('💾 Salvando contatos em Seus Contatos:', contactsWithNames);
    
    // Buscar contatos existentes para não duplicar
    const phones = contactsWithNames.map(c => c.phone);
    const { data: existing } = await supabase
      .from('whatsapp_contacts')
      .select('phone')
      .eq('user_id', userId)
      .in('phone', phones);
    
    const existingPhones = new Set(existing?.map(e => e.phone) || []);
    
    // Filtrar apenas novos contatos
    const newContacts = contactsWithNames.filter(c => !existingPhones.has(c.phone));
    
    if (newContacts.length > 0) {
      const contactsToInsert = newContacts.map(c => ({
        user_id: userId,
        phone: c.phone,
        nome: c.nome,
        origem: 'lista_transmissao',
        aceita_marketing: true,
        aceita_lancamentos: true,
        aceita_promocoes: true
      }));
      
      const { error } = await supabase
        .from('whatsapp_contacts')
        .insert(contactsToInsert);
      
      if (error) {
        console.error('⚠️ Erro ao salvar contatos:', error);
      } else {
        console.log(`✅ ${newContacts.length} contatos salvos em Seus Contatos`);
      }
    }
    
    // Atualizar nomes de contatos existentes se estavam sem nome
    const contactsToUpdate = contactsWithNames.filter(c => existingPhones.has(c.phone));
    for (const contact of contactsToUpdate) {
      await supabase
        .from('whatsapp_contacts')
        .update({ nome: contact.nome })
        .eq('user_id', userId)
        .eq('phone', contact.phone)
        .is('nome', null);
    }
  };

  const handleCreateGroup = async () => {
    try {
      setIsAdding(true);

      const contacts = extractContactsWithNames(pastedNumbers);

      if (contacts.length === 0) {
        toast.error('Nenhum número válido encontrado');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const name = groupName.trim() || `Lista ${new Date().toLocaleString('pt-BR')}`;
      const phones = contacts.map(c => c.phone);

      console.log('💾 Salvando lista:', {
        name: name,
        contacts: contacts,
        count: contacts.length
      });

      // Salvar lista de transmissão
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .insert({
          user_id: user.id,
          group_id: `manual_${Date.now()}@g.us`,
          group_name: name,
          member_count: phones.length,
          phone_numbers: phones,
          status: 'active'
        })
        .select();

      if (error) {
        console.error('❌ Erro ao salvar:', error);
        throw error;
      }

      // Salvar contatos automaticamente em "Seus Contatos"
      await saveContactsToDatabase(user.id, contacts);

      console.log('✅ Lista salva:', data);

      const contactsWithNames = contacts.filter(c => c.nome).length;
      if (contactsWithNames > 0) {
        toast.success(`✅ Lista criada com ${phones.length} contatos! ${contactsWithNames} nomes salvos em "Seus Contatos"`);
      } else {
        toast.success(`✅ Lista criada com ${phones.length} contatos!`);
      }
      
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
    const csv = 'telefone,nome\n5521999998888,João Silva\n5521999997777,Maria Santos\n5528999879585,Pedro Costa';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_contatos.csv';
    link.click();
    toast.success('📥 Modelo baixado com sucesso!');
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAdding(true);
      console.log('📥 Iniciando importação CSV...');
      console.log('📄 Arquivo:', file.name, 'Tamanho:', file.size);

      const text = await file.text();
      console.log('📄 Conteúdo bruto do arquivo:', text);
      console.log('📄 Primeiros 200 caracteres:', text.substring(0, 200));
      
      const lines = text.split('\n').filter(line => line.trim());
      console.log('📋 Total de linhas (incluindo header):', lines.length);
      console.log('📋 Linhas:', lines);

      if (lines.length === 0) {
        toast.error('❌ Arquivo vazio');
        return;
      }

      // Detectar headers
      const headerLine = lines[0].toLowerCase();
      const headers = headerLine.split(',').map(h => h.trim());
      console.log('📋 Headers detectados:', headers);

      // Determinar índices das colunas (flexível)
      let telefoneIndex = headers.findIndex(h => h === 'telefone' || h === 'phone' || h === 'numero');
      let nomeIndex = headers.findIndex(h => h === 'nome' || h === 'name');
      let grupoIndex = headers.findIndex(h => h === 'grupo' || h === 'group');

      console.log('📋 Índices encontrados:', { telefoneIndex, nomeIndex, grupoIndex });

      // Se não encontrou telefone, tentar formato inverso (nome,telefone)
      if (telefoneIndex === -1 && headers.length >= 2) {
        // Verificar se o segundo campo parece ser telefone
        const secondColSample = lines[1]?.split(',')[1]?.replace(/\D/g, '');
        if (secondColSample && secondColSample.length >= 10) {
          telefoneIndex = 1;
          nomeIndex = 0;
          console.log('📋 Formato detectado: nome,telefone');
        } else {
          // Tentar primeiro campo como telefone
          const firstColSample = lines[1]?.split(',')[0]?.replace(/\D/g, '');
          if (firstColSample && firstColSample.length >= 10) {
            telefoneIndex = 0;
            nomeIndex = 1;
            console.log('📋 Formato detectado: telefone,nome');
          }
        }
      }

      if (telefoneIndex === -1) {
        console.error('❌ Coluna de telefone não encontrada. Headers:', headers);
        toast.error('❌ CSV deve ter coluna "telefone" ou "nome,telefone"');
        return;
      }

      // Remover header e processar dados
      const dataLines = lines.slice(1);
      console.log('📋 Linhas de dados (sem header):', dataLines.length);

      if (dataLines.length === 0) {
        toast.error('❌ CSV sem dados (apenas header encontrado)');
        return;
      }

      const contacts: ContactWithName[] = [];
      const seenPhones = new Set<string>();

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) {
          console.log(`⏭️ Linha ${i+2} vazia, pulando`);
          continue;
        }

        const parts = line.split(',').map(p => p.trim());
        console.log(`📝 Linha ${i+2}:`, parts);

        const phonePart = parts[telefoneIndex] || '';
        const namePart = nomeIndex >= 0 ? (parts[nomeIndex] || '') : '';
        
        console.log(`📝 Linha ${i+2} extraído - telefone: "${phonePart}", nome: "${namePart}"`);

        const cleanedPhone = cleanPhoneNumber(phonePart);
        
        if (!cleanedPhone || cleanedPhone.length < 10) {
          console.warn(`⚠️ Linha ${i+2} telefone inválido: "${phonePart}" -> "${cleanedPhone}"`);
          continue;
        }

        const normalizedPhone = normalizePhoneNumber(cleanedPhone);
        
        if (seenPhones.has(normalizedPhone)) {
          console.log(`⏭️ Linha ${i+2} telefone duplicado: ${normalizedPhone}`);
          continue;
        }

        seenPhones.add(normalizedPhone);
        contacts.push({
          phone: normalizedPhone,
          nome: namePart
        });
        console.log(`✅ Linha ${i+2} contato válido:`, { phone: normalizedPhone, nome: namePart });
      }

      console.log('📊 Total de contatos válidos:', contacts.length);
      console.log('📊 Contatos:', contacts);

      if (contacts.length === 0) {
        toast.error('❌ Nenhum contato válido encontrado no CSV');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('❌ Usuário não autenticado');
        return;
      }

      console.log('👤 User ID:', user.id);

      const name = groupName.trim() || `Lista CSV ${new Date().toLocaleString('pt-BR')}`;
      const phones = contacts.map(c => c.phone);

      console.log('💾 Salvando lista:', { name, phones, count: phones.length });

      const { data, error } = await supabase
        .from('whatsapp_groups')
        .insert({
          user_id: user.id,
          group_id: `csv_${Date.now()}@g.us`,
          group_name: name,
          member_count: phones.length,
          phone_numbers: phones,
          status: 'active'
        })
        .select();

      if (error) {
        console.error('❌ Erro ao salvar lista:', error);
        throw error;
      }

      console.log('✅ Lista salva no banco:', data);

      // Salvar contatos automaticamente em "Seus Contatos"
      await saveContactsToDatabase(user.id, contacts);

      const contactsWithNames = contacts.filter(c => c.nome).length;
      if (contactsWithNames > 0) {
        toast.success(`✅ ${contacts.length} contatos importados! ${contactsWithNames} nomes salvos em "Seus Contatos"`);
      } else {
        toast.success(`✅ ${contacts.length} contatos importados!`);
      }
      
      onOpenChange(false);
      onGroupAdded();

      // Limpar input
      e.target.value = '';
    } catch (error: any) {
      console.error('💥 ERRO ao importar CSV:', error);
      toast.error(error.message || 'Erro ao importar CSV');
    } finally {
      setIsAdding(false);
    }
  };

  const detectedContacts = extractContactsWithNames(pastedNumbers);
  const contactsWithNames = detectedContacts.filter(c => c.nome).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Lista de Transmissão</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="paste" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">Colar Números</TabsTrigger>
            <TabsTrigger value="csv">Importar CSV</TabsTrigger>
          </TabsList>

          {/* ABA 1: COLAR NÚMEROS */}
          <TabsContent value="paste" className="space-y-4">
            <div>
              <Label htmlFor="paste-numbers">Cole os números aqui (com nome opcional)</Label>
              <Textarea
                id="paste-numbers"
                placeholder="21999998888,João Silva
21999997777,Maria Santos
21999996666"
                value={pastedNumbers}
                onChange={(e) => setPastedNumbers(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                disabled={isAdding}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{detectedContacts.length} números válidos</span>
                {contactsWithNames > 0 && (
                  <span className="text-green-600">{contactsWithNames} com nome (serão salvos em Seus Contatos)</span>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="group-name">Nome da Lista (opcional)</Label>
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
              {isAdding ? 'Criando...' : 'Criar Lista'}
            </Button>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
              <p className="font-medium mb-2">💡 Formato recomendado (uma linha por contato):</p>
              <pre className="bg-white dark:bg-gray-900 p-2 rounded mt-1 text-xs overflow-x-auto">
{`21999998888,João Silva
21999997777,Maria Santos
21999996666,Pedro Costa`}
              </pre>
              <p className="text-muted-foreground mt-2">
                ✅ Contatos com nome serão salvos automaticamente em "Seus Contatos"
              </p>
            </div>
          </TabsContent>

          {/* ABA 2: CSV */}
          <TabsContent value="csv" className="space-y-4">
            <div>
              <Label htmlFor="csv-group-name">Nome da Lista (opcional)</Label>
              <Input
                id="csv-group-name"
                placeholder="Deixe vazio para gerar automático"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={isAdding}
              />
            </div>

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
{`telefone,nome
5521999998888,João Silva
5521999997777,Maria Santos
5528999879585,Pedro Costa`}
              </pre>
              <p className="text-muted-foreground mt-2">
                ✅ Contatos serão salvos automaticamente em "Seus Contatos"
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
