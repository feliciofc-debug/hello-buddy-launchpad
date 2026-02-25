import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Users, CheckCircle2, AlertCircle, Download, Chrome, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const digits = val.replace(/[\s\-\(\)\+\.]/g, '');
  return /^\d{8,15}$/.test(digits);
}

function normalizePhone(val: string): string {
  return val.replace(/[\s\-\(\)\.]/g, '');
}

function parseCSV(text: string): ParseResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { contacts: [], ignored: [] };

  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : 
                    firstLine.includes('\t') ? '\t' : ',';

  const firstCols = firstLine.split(separator).map(c => c.trim().toLowerCase().replace(/"/g, ''));
  const hasHeader = firstCols.some(c =>
    ['nome', 'name', 'telefone', 'phone', 'celular', 'whatsapp', 'numero', 'número', 'tel', 'contato'].includes(c)
  );

  let phoneIdx = -1;
  let nameIdx = -1;

  if (hasHeader) {
    firstCols.forEach((col, i) => {
      if (['telefone', 'phone', 'celular', 'whatsapp', 'numero', 'número', 'tel'].includes(col)) phoneIdx = i;
      if (['nome', 'name', 'contato'].includes(col)) nameIdx = i;
    });
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;

  if (phoneIdx === -1 && dataLines.length > 0) {
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

    const parts = line.split(separator).map(p => p.trim().replace(/^"|"$/g, ''));

    let telefone = '';
    let nome: string | null = null;

    if (phoneIdx !== -1) {
      telefone = normalizePhone(parts[phoneIdx] ?? '');
      nome = nameIdx !== -1 && nameIdx < parts.length ? (parts[nameIdx] || null) : null;
    } else {
      for (let i = 0; i < parts.length; i++) {
        if (isPhoneValue(parts[i])) {
          telefone = normalizePhone(parts[i]);
          nome = parts.find((p, idx) => idx !== i && p.length > 1 && !isPhoneValue(p)) ?? null;
          break;
        }
      }
    }

    const digits = telefone.replace(/\D/g, '');
    if (!telefone || digits.length < 8) {
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

    contacts.push({ nome: nome || null, telefone });
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

export default function ImportContatosPJ() {
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [parseResult, setParseResult] = useState<ParseResult>({ contacts: [], ignored: [] });
  const [listName, setListName] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.txt')) {
      toast.error('Formato inválido. Use CSV ou TXT.');
      return;
    }

    setFile(selectedFile);
    setImported(false);
    setSummary(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCSV(text);
      setParseResult(result);
      setContacts(result.contacts);

      if (result.contacts.length === 0) {
        toast.error('Nenhum contato válido encontrado no arquivo.');
      } else {
        const msg = result.ignored.length > 0
          ? `${result.contacts.length} contatos encontrados! (${result.ignored.length} ignorados)`
          : `${result.contacts.length} contatos encontrados!`;
        toast.success(msg);
      }

      if (!listName) {
        const name = selectedFile.name.replace(/\.(csv|txt)$/i, '').replace(/_/g, ' ');
        setListName(name);
      }
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  const handleImport = async () => {
    if (!listName.trim()) {
      toast.error('Preencha o nome da lista antes de importar.');
      return;
    }
    if (contacts.length === 0) {
      toast.error('Nenhum contato válido para importar.');
      return;
    }

    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { data: lista, error: listaError } = await supabase
        .from('pj_listas_categoria')
        .insert({
          user_id: user.id,
          nome: listName.trim(),
          descricao: `Importado via AMZ (${contacts.length} contatos)`,
          cor: '#7e22ce',
          icone: '📱',
          ativa: true,
          total_membros: contacts.length,
        })
        .select('id')
        .single();

      if (listaError) throw listaError;

      const batchSize = 100;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize).map(c => ({
          lista_id: lista.id,
          nome: c.nome ?? null,
          telefone: c.telefone,
        }));
        const { error } = await supabase.from('pj_lista_membros').insert(batch);
        if (error) throw error;
      }

      setSummary({
        total: contacts.length + parseResult.ignored.length,
        importados: contacts.length,
        ignorados: parseResult.ignored.length,
        detalhes: parseResult.ignored,
      });
      setImported(true);
      toast.success(`${contacts.length} contatos importados!`);
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Instruções da Extensão */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Chrome className="h-5 w-5 text-purple-600" />
            Extensão AMZ Extrator
          </CardTitle>
          <CardDescription>
            Extraia contatos dos seus grupos do WhatsApp Web
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0 bg-purple-100 text-purple-700 border-purple-300">1</Badge>
              <p>Instale a extensão <strong>AMZ Ofertas Extrator</strong> no Chrome</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0 bg-purple-100 text-purple-700 border-purple-300">2</Badge>
              <p>Abra o <strong>WhatsApp Web</strong> e entre no grupo desejado</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0 bg-purple-100 text-purple-700 border-purple-300">3</Badge>
              <p>Clique no <strong>nome do grupo</strong> e role a lista de membros</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0 bg-purple-100 text-purple-700 border-purple-300">4</Badge>
              <p>Clique em <strong>Extrair Contatos</strong> e depois <strong>Baixar CSV</strong></p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0 bg-purple-100 text-purple-700 border-purple-300">5</Badge>
              <p>Faça o <strong>upload do CSV</strong> aqui ao lado <ArrowRight className="inline h-4 w-4" /></p>
            </div>
          </div>

          <Button asChild className="w-full bg-purple-600 hover:bg-purple-700 text-white">
            <a href="/AMZ-Extrator-v2.zip" download>
              <Download className="h-4 w-4 mr-2" />
              Baixar Extensão AMZ Extrator
            </a>
          </Button>

          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <p className="font-semibold mb-1">💡 Dica:</p>
            <p>Use os filtros da extensão para selecionar apenas números brasileiros (+55) e remover duplicados antes de exportar.</p>
          </div>
        </CardContent>
      </Card>

      {/* Upload e Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5" />
            Importar Contatos
          </CardTitle>
          <CardDescription>
            Faça upload do CSV gerado pela extensão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {imported && summary ? (
            <div className="space-y-4">
              {/* Cards de resumo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{summary.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total na planilha</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{summary.importados}</p>
                  <p className="text-xs text-muted-foreground mt-1">✅ Importados</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{summary.ignorados}</p>
                  <p className="text-xs text-muted-foreground mt-1">❌ Ignorados</p>
                </div>
              </div>

              {/* Mensagem de sucesso */}
              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-green-700">
                    Lista &quot;{listName}&quot; criada com sucesso!
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {summary.importados} contatos prontos para uso em campanhas.
                  </p>
                </div>
              </div>

              {/* Detalhes dos ignorados */}
              {summary.detalhes.length > 0 && (
                <details className="bg-muted/30 rounded-lg p-3">
                  <summary className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Ver {summary.detalhes.length} registros ignorados
                  </summary>
                  <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                    {summary.detalhes.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs py-1.5 border-b border-muted last:border-0">
                        <span className="text-muted-foreground font-mono truncate max-w-[200px]">
                          {d.linha > 0 ? `Linha ${d.linha}: ` : ''}{d.valor}
                        </span>
                        <span className="text-amber-600 ml-2 shrink-0">{d.motivo}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <Button variant="outline" onClick={resetForm} className="w-full">
                Importar outro arquivo
              </Button>
            </div>
          ) : (
            <>
              {/* File Upload Zone */}
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="space-y-2">
                    <FileSpreadsheet className="h-10 w-10 text-purple-500 mx-auto" />
                    <p className="font-semibold text-sm">{file.name}</p>
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {contacts.length} válidos
                      </Badge>
                      {parseResult.ignored.length > 0 && (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                          <AlertCircle className="h-3 w-3" />
                          {parseResult.ignored.length} ignorados
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Clique para selecionar o arquivo CSV
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      CSV com Telefone e Nome (qualquer ordem, nome opcional)
                    </p>
                  </div>
                )}
              </div>

              {/* List Name */}
              {contacts.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="listName">Nome da lista</Label>
                    <Input
                      id="listName"
                      value={listName}
                      onChange={(e) => setListName(e.target.value)}
                      placeholder="Ex: Grupo VIP Eletrônicos"
                    />
                  </div>

                  {/* Preview */}
                  <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Prévia ({Math.min(contacts.length, 5)} de {contacts.length}):
                    </p>
                    {contacts.slice(0, 5).map((c, i) => (
                      <div key={i} className="flex justify-between text-xs py-1 border-b border-muted last:border-0">
                        <span className="font-medium truncate max-w-[150px]">{c.nome || '(Sem nome)'}</span>
                        <span className="text-muted-foreground font-mono">{c.telefone}</span>
                      </div>
                    ))}
                    {contacts.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ... e mais {contacts.length - 5} contatos
                      </p>
                    )}
                  </div>

                  {/* Import Button */}
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    onClick={handleImport}
                    disabled={importing || !listName.trim()}
                  >
                    {importing ? (
                      <>Importando...</>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Importar {contacts.length} contatos
                      </>
                    )}
                  </Button>
                </>
              )}

              {contacts.length === 0 && file && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Nenhum contato válido encontrado. Verifique o formato do CSV.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
