import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { normalizePhoneNumber, isPhoneValue as isPhoneUtil } from '@/lib/phoneUtils';

interface ParsedContact {
  nome: string | null;
  telefone: string;
}

interface ParseResult {
  contacts: ParsedContact[];
  ignored: { linha: number; valor: string; motivo: string }[];
}

interface ImportSummary {
  total: number;
  importados: number;
  ignorados: number;
  detalhes: { linha: number; valor: string; motivo: string }[];
}

function isPhoneValue(val: string): boolean {
  return isPhoneUtil(val);
}

function parseCSV(text: string): ParseResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { contacts: [], ignored: [] };

  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' :
    firstLine.includes('\t') ? '\t' :
    firstLine.includes(',') ? ',' : null;

  const firstCols = separator
    ? firstLine.split(separator).map(c => c.trim().toLowerCase().replace(/"/g, ''))
    : [firstLine.trim().toLowerCase()];

  const hasHeader = firstCols.some(c =>
    ['nome', 'name', 'telefone', 'phone', 'celular', 'whatsapp', 'numero', 'número', 'tel', 'contato'].includes(c)
  );

  let phoneIdx = -1;
  let nameIdx = -1;

  if (hasHeader && separator) {
    firstCols.forEach((col, i) => {
      if (['telefone', 'phone', 'celular', 'whatsapp', 'numero', 'número', 'tel'].includes(col)) phoneIdx = i;
      if (['nome', 'name', 'contato'].includes(col)) nameIdx = i;
    });
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;

  if (separator && phoneIdx === -1 && dataLines.length > 0) {
    const sampleCols = dataLines[0]?.split(separator).map(c => c.trim().replace(/"/g, '')) ?? [];
    sampleCols.forEach((col, i) => {
      if (phoneIdx === -1 && isPhoneValue(col)) phoneIdx = i;
    });
    if (phoneIdx !== -1) {
      nameIdx = phoneIdx === 0 ? 1 : 0;
    }
  }

  const contacts: ParsedContact[] = [];
  const ignored: ParseResult['ignored'] = [];

  dataLines.forEach((line, lineNum) => {
    if (!line.trim()) return;

    let telefone = '';
    let nome: string | null = null;

    if (separator) {
      const parts = line.split(separator).map(p => p.trim().replace(/^"|"$/g, ''));
      if (phoneIdx !== -1) {
        telefone = parts[phoneIdx] ?? '';
        nome = nameIdx !== -1 && nameIdx < parts.length ? (parts[nameIdx] || null) : null;
      } else {
        for (let i = 0; i < parts.length; i++) {
          if (isPhoneValue(parts[i])) {
            telefone = parts[i];
            nome = parts.find((p, idx) => idx !== i && p.length > 1 && !isPhoneValue(p)) ?? null;
            break;
          }
        }
      }
    }

    if (!telefone || telefone.replace(/\D/g, '').length < 8) {
      const nameNumberMatch = line.trim().match(/^(.+?)\s+([\+]?[\d\s\-\.\/\(\)]{8,20})$/);
      if (nameNumberMatch && nameNumberMatch[1] && nameNumberMatch[2]) {
        const candidatePhone = nameNumberMatch[2].trim();
        if (isPhoneValue(candidatePhone)) {
          nome = nameNumberMatch[1].trim();
          telefone = candidatePhone;
        }
      }

      if (!telefone || telefone.replace(/\D/g, '').length < 8) {
        const wholeLine = line.trim();
        if (isPhoneValue(wholeLine)) {
          telefone = wholeLine;
          nome = null;
        }
      }
    }

    const normalized = normalizePhoneNumber(telefone);
    const digits = normalized.replace(/\D/g, '');

    if (!normalized || digits.length < 10) {
      ignored.push({
        linha: lineNum + (hasHeader ? 2 : 1),
        valor: line.substring(0, 50),
        motivo: !telefone ? 'Telefone não encontrado' : `Telefone inválido (${digits.length} dígitos)`
      });
      return;
    }

    if (nome) {
      nome = nome.split(' ')
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      if (nome.length < 2 || /^\d+$/.test(nome)) nome = null;
    }

    contacts.push({ nome: nome || null, telefone: normalized });
  });

  const seen = new Set<string>();
  const unique = contacts.filter(c => {
    if (seen.has(c.telefone)) {
      ignored.push({ linha: 0, valor: c.telefone, motivo: 'Duplicata removida' });
      return false;
    }
    seen.add(c.telefone);
    return true;
  });

  return { contacts: unique, ignored };
}

const STEPS = [
  { num: 1, label: 'Upload / Colar' },
  { num: 2, label: 'IA Normaliza' },
  { num: 3, label: 'Revisar' },
  { num: 4, label: 'Enviar' },
];

interface AfiliadoImportadorProps {
  onSuccess: () => void;
  onClose: () => void;
}

export default function AfiliadoImportador({ onSuccess, onClose }: AfiliadoImportadorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult>({ contacts: [], ignored: [] });
  const [listName, setListName] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStep = imported ? 4 : contacts.length > 0 ? 3 : file || pasteText ? 2 : 1;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    console.log('[AfiliadoImportador] handleFileChange disparado, arquivo:', selectedFile?.name, selectedFile?.size);
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
    const isText = name.endsWith('.csv') || name.endsWith('.txt');
    if (!isExcel && !isText) {
      toast.error('Formato inválido. Use CSV, TXT ou Excel (.xls, .xlsx).');
      return;
    }
    setFile(selectedFile);
    setImported(false);
    setSummary(null);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        console.log('[AfiliadoImportador] Excel lido, convertendo para CSV...');
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(firstSheet);
        console.log('[AfiliadoImportador] CSV gerado do Excel, primeiras 200 chars:', csv.substring(0, 200));
        processText(csv, selectedFile.name);
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        console.log('[AfiliadoImportador] Arquivo texto lido, tamanho:', text.length, 'primeiras 200 chars:', text.substring(0, 200));
        processText(text, selectedFile.name);
      };
      reader.readAsText(selectedFile, 'UTF-8');
    }
  };

  const processText = (text: string, fileName?: string) => {
    const result = parseCSV(text);
    setParseResult(result);
    setContacts(result.contacts);
    if (result.contacts.length === 0) {
      toast.error('Nenhum contato válido encontrado.');
    } else {
      toast.success(`${result.contacts.length} contatos encontrados!`);
    }
    if (!listName && fileName) {
      setListName(fileName.replace(/\.(csv|txt|xlsx|xls)$/i, '').replace(/_/g, ' '));
    }
  };

  const handlePasteImport = () => {
    if (!pasteText.trim()) return;
    processText(pasteText);
  };

  const handleImport = async () => {
    if (!listName.trim()) { toast.error('Preencha o nome da lista.'); return; }
    if (contacts.length === 0) { toast.error('Nenhum contato válido.'); return; }
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Usuário não autenticado'); return; }

      // Buscar contatos existentes para evitar duplicatas
      const { data: existingContacts } = await supabase
        .from('cadastros')
        .select('whatsapp')
        .eq('user_id', user.id);

      const existingPhones = new Set(existingContacts?.map(c => c.whatsapp) || []);

      let importedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      const batchSize = 50;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        for (const contact of batch) {
          if (existingPhones.has(contact.telefone)) {
            duplicateCount++;
            continue;
          }
          try {
            const { error } = await supabase
              .from('cadastros')
              .insert({
                user_id: user.id,
                nome: contact.nome || 'Contato',
                whatsapp: contact.telefone,
                origem: `Importado: ${listName.trim()}`,
                opt_in: true,
                tags: ['importado-csv', listName.trim().replace(/\s+/g, '-').toLowerCase()]
              });
            if (error) {
              if (error.code === '23505') {
                duplicateCount++;
              } else {
                errorCount++;
              }
            } else {
              importedCount++;
              existingPhones.add(contact.telefone);
            }
          } catch {
            errorCount++;
          }
        }
      }

      setSummary({
        total: contacts.length + parseResult.ignored.length,
        importados: importedCount,
        ignorados: parseResult.ignored.length + duplicateCount,
        detalhes: [
          ...parseResult.ignored,
          ...(duplicateCount > 0 ? [{ linha: 0, valor: `${duplicateCount} contatos`, motivo: 'Já existiam na lista' }] : []),
        ],
      });
      setImported(true);

      if (importedCount > 0) {
        toast.success(`${importedCount} contatos importados com sucesso!`);
        onSuccess();
      } else if (duplicateCount > 0) {
        toast.info('Todos os contatos já existem na sua lista');
      }
    } catch (err: any) {
      console.error('Erro ao importar:', err);
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setContacts([]);
    setParseResult({ contacts: [], ignored: [] });
    setListName('');
    setImported(false);
    setSummary(null);
    setPasteText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Importar Contatos
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Steps */}
        <div className="flex items-center gap-1 mt-3">
          {STEPS.map((step, i) => (
            <div key={step.num} className="flex items-center gap-1 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                currentStep >= step.num
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {currentStep > step.num ? '✓' : step.num}
              </div>
              <span className={`text-xs hidden sm:block ${currentStep >= step.num ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${currentStep > step.num ? 'bg-primary/50' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {imported && summary ? (
          /* STEP 4 - Results */
          <div className="space-y-4">
            <div className="text-center py-2">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold">Importação Concluída!</h3>
              <p className="text-sm text-muted-foreground">Lista "{listName}" importada</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{summary.importados}</p>
                <p className="text-xs text-muted-foreground">✅ Importados</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{summary.ignorados}</p>
                <p className="text-xs text-muted-foreground">⚠️ Ignorados</p>
              </div>
            </div>

            {summary.detalhes.length > 0 && (
              <details className="bg-muted/50 rounded-lg p-3">
                <summary className="text-sm font-medium cursor-pointer flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Ver {summary.detalhes.length} registros ignorados
                </summary>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {summary.detalhes.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                      <span className="text-muted-foreground font-mono truncate max-w-[200px]">
                        {d.linha > 0 ? `Linha ${d.linha}: ` : ''}{d.valor}
                      </span>
                      <span className="text-amber-500 ml-2 shrink-0">{d.motivo}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <Button onClick={() => { resetForm(); onClose(); }} variant="outline" className="w-full">
              Fechar
            </Button>
          </div>
        ) : contacts.length > 0 ? (
          /* STEP 3 - Review */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{contacts.length} contatos válidos</Badge>
              {parseResult.ignored.length > 0 && (
                <Badge variant="outline" className="text-amber-600">
                  {parseResult.ignored.length} ignorados
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nome da lista / origem</Label>
              <Input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Ex: Grupo VIP Ofertas — Março"
              />
            </div>

            {/* Preview table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-2 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="px-3 py-2">Nome</div>
                <div className="px-3 py-2">Telefone</div>
              </div>
              {contacts.slice(0, 6).map((c, i) => (
                <div key={i} className="grid grid-cols-2 border-t border-border text-sm">
                  <div className="px-3 py-2">{c.nome || <span className="text-muted-foreground italic">Sem nome</span>}</div>
                  <div className="px-3 py-2 text-muted-foreground font-mono text-xs">{c.telefone}</div>
                </div>
              ))}
              {contacts.length > 6 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                  ... e mais {contacts.length - 6} contatos
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={resetForm} variant="outline" className="flex-1">
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || !listName.trim()}
                className="flex-1"
              >
                {importing ? 'Importando...' : `Importar ${contacts.length} contatos`}
              </Button>
            </div>
          </div>
        ) : (
          /* STEP 1 - Upload */
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <p className="text-sm text-primary flex items-start gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                Mande como está! A IA identifica telefones e nomes automaticamente.
              </p>
            </div>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xls,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Arraste ou clique para subir</p>
              <p className="text-xs text-muted-foreground mt-1">CSV, TXT, Excel (.xls, .xlsx)</p>
            </div>

            {/* Paste area */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ou cole aqui:</Label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"João,11999887766\nMaria,21988776655\n..."}
                rows={3}
                className="w-full rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground text-sm p-3 resize-none focus:outline-none focus:border-primary/50 mt-1"
              />
              {pasteText.trim() && (
                <Button onClick={handlePasteImport} size="sm" className="mt-2">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Processar texto colado
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
