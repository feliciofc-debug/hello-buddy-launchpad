import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle, AlertCircle, Users, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface ImportContactsWhatsAppCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedContact {
  nome: string;
  whatsapp: string;
  origem: string;
}

export default function ImportContactsWhatsAppCSVModal({ isOpen, onClose, onSuccess }: ImportContactsWhatsAppCSVModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ 
    total: number; 
    imported: number; 
    duplicates: number; 
    errors: number 
  } | null>(null);

  const cleanPhoneNumber = (phone: string): string => {
    // Remove tudo que não é número
    let cleaned = phone.replace(/\D/g, '');
    
    // Garantir que começa com 55 (Brasil)
    if (!cleaned.startsWith('55') && cleaned.length >= 10) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const parseWhatsAppGroupCSV = (text: string, fileName: string): ParsedContact[] => {
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];

    // Remover BOM se existir
    const headerLine = lines[0].replace(/^\ufeff/, '');
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    // Encontrar índices das colunas relevantes
    const phoneIndex = headers.findIndex(h => h.includes('phone'));
    const displayNameIndex = headers.findIndex(h => h.includes('public display name') || h.includes('display name'));
    const savedNameIndex = headers.findIndex(h => h.includes('saved name'));
    const groupNameIndex = headers.findIndex(h => h.includes('group name'));
    const countryCodeIndex = headers.findIndex(h => h.includes('country code'));

    if (phoneIndex === -1) {
      console.error('Coluna de telefone não encontrada');
      return [];
    }

    const contacts: ParsedContact[] = [];
    const groupName = fileName.replace('.csv', '').replace(/_/g, ' ');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      
      const phone = values[phoneIndex]?.trim() || '';
      const displayName = values[displayNameIndex]?.trim() || '';
      const savedName = values[savedNameIndex]?.trim() || '';
      const csvGroupName = values[groupNameIndex]?.trim() || groupName;
      
      if (!phone) continue;

      // Pegar o melhor nome disponível
      const nome = savedName || displayName || 'Contato';
      
      // Limpar telefone
      const cleanedPhone = cleanPhoneNumber(phone);
      
      // Validar telefone brasileiro (mínimo 12 dígitos: 55 + DDD + número)
      if (cleanedPhone.length < 12 || cleanedPhone.length > 13) {
        continue;
      }

      contacts.push({
        nome: nome,
        whatsapp: cleanedPhone,
        origem: csvGroupName
      });
    }

    return contacts;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const csvFiles = selectedFiles.filter(f => f.name.endsWith('.csv'));
    
    if (csvFiles.length !== selectedFiles.length) {
      toast.warning('Apenas arquivos CSV são aceitos');
    }
    
    if (csvFiles.length > 0) {
      setFiles(csvFiles);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (files.length === 0) {
      toast.error('Selecione pelo menos um arquivo CSV');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsProcessing(false);
        return;
      }

      // Buscar contatos existentes para checar duplicados
      const { data: existingContacts } = await supabase
        .from('cadastros')
        .select('whatsapp')
        .eq('user_id', user.id);

      const existingPhones = new Set(existingContacts?.map(c => c.whatsapp) || []);

      // Processar todos os arquivos
      const allContacts: ParsedContact[] = [];
      
      for (const file of files) {
        const text = await file.text();
        const contacts = parseWhatsAppGroupCSV(text, file.name);
        allContacts.push(...contacts);
      }

      if (allContacts.length === 0) {
        toast.error('Nenhum contato válido encontrado nos arquivos');
        setIsProcessing(false);
        return;
      }

      // Remover duplicados internos (pelo telefone)
      const uniqueContactsMap = new Map<string, ParsedContact>();
      for (const contact of allContacts) {
        if (!uniqueContactsMap.has(contact.whatsapp)) {
          uniqueContactsMap.set(contact.whatsapp, contact);
        }
      }
      const uniqueContacts = Array.from(uniqueContactsMap.values());

      let importedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      const totalContacts = uniqueContacts.length;

      // Importar em lotes de 50
      const batchSize = 50;
      for (let i = 0; i < uniqueContacts.length; i += batchSize) {
        const batch = uniqueContacts.slice(i, i + batchSize);
        
        for (const contact of batch) {
          // Verificar se já existe
          if (existingPhones.has(contact.whatsapp)) {
            duplicateCount++;
            continue;
          }

          try {
            const { error } = await supabase
              .from('cadastros')
              .insert({
                user_id: user.id,
                nome: contact.nome,
                whatsapp: contact.whatsapp,
                origem: `WhatsApp: ${contact.origem}`,
                opt_in: true,
                tags: ['importado-grupo-whatsapp', contact.origem.replace(/\s+/g, '-').toLowerCase()]
              });

            if (error) {
              // Pode ser duplicado se houve race condition
              if (error.code === '23505') {
                duplicateCount++;
              } else {
                console.error('Erro ao inserir:', error);
                errorCount++;
              }
            } else {
              importedCount++;
              existingPhones.add(contact.whatsapp);
            }
          } catch (err) {
            console.error('Erro:', err);
            errorCount++;
          }
        }

        // Atualizar progresso
        const processed = Math.min(i + batchSize, totalContacts);
        setProgress(Math.round((processed / totalContacts) * 100));
      }

      setResults({ 
        total: allContacts.length,
        imported: importedCount, 
        duplicates: duplicateCount,
        errors: errorCount 
      });
      
      if (importedCount > 0) {
        toast.success(`${importedCount} contatos importados com sucesso!`);
        onSuccess();
      } else if (duplicateCount > 0) {
        toast.info('Todos os contatos já existem na sua lista');
      }

    } catch (error) {
      console.error('Erro ao processar CSVs:', error);
      toast.error('Erro ao processar arquivos');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setResults(null);
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Importar Contatos de Grupos WhatsApp
          </DialogTitle>
          <DialogDescription>
            Importe contatos de planilhas CSV exportadas de grupos do WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileSpreadsheet className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <strong>Formato aceito:</strong> CSV exportado de grupos WhatsApp
              <br /><br />
              <strong>O sistema irá:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Extrair nome e telefone de cada contato</li>
                <li>Eliminar números duplicados automaticamente</li>
                <li>Adicionar tag do grupo de origem</li>
                <li>Validar números brasileiros</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="csv-files">Selecionar Arquivos CSV</Label>
            <Input
              id="csv-files"
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            {files.length > 0 && (
              <div className="text-sm text-muted-foreground space-y-1">
                {files.map((file, index) => (
                  <p key={index}>✅ {file.name}</p>
                ))}
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processando...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {results && (
            <Alert className={results.errors === 0 ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'}>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription className="space-y-1">
                <p><strong>Total encontrado:</strong> {results.total} contatos</p>
                <p>✅ <strong>Importados:</strong> {results.imported}</p>
                <p>⚠️ <strong>Duplicados (ignorados):</strong> {results.duplicates}</p>
                {results.errors > 0 && <p>❌ <strong>Erros:</strong> {results.errors}</p>}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              {results ? 'Fechar' : 'Cancelar'}
            </Button>
            {!results && (
              <Button onClick={handleImport} disabled={files.length === 0 || isProcessing}>
                {isProcessing ? 'Importando...' : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar Contatos
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
