import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, Users, CheckCircle2, AlertCircle, Download, Settings, Sparkles } from 'lucide-react';
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

const STEPS = [
  { num: 1, label: 'Upload / Colar' },
  { num: 2, label: 'IA Normaliza' },
  { num: 3, label: 'Revisar' },
  { num: 4, label: 'Enviar' },
];

export default function ContatosWhatsApp() {
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
      processText(text, selectedFile.name);
    };
    reader.readAsText(selectedFile, 'UTF-8');
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
      setListName(fileName.replace(/\.(csv|txt)$/i, '').replace(/_/g, ' '));
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
    setPasteText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#16213e] to-[#0f3460] border-b border-white/10">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-2xl font-bold shadow-lg shadow-emerald-500/30">
                ⚡
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  AMZ <span className="text-emerald-400">Importador</span>
                </h1>
                <p className="text-sm text-white/60">Normalize planilhas bagunçadas e envie para a plataforma</p>
              </div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm px-3 py-1">
              v2.0
            </Badge>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-[#16213e]/80 border-b border-white/5">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => (
              <div key={step.num} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                  currentStep >= step.num
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-white/10 text-white/40'
                }`}>
                  {currentStep > step.num ? '✓' : step.num}
                </div>
                <span className={`text-sm hidden sm:block ${currentStep >= step.num ? 'text-white font-medium' : 'text-white/40'}`}>
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.num ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Configurar Conexão */}
      <div className="container mx-auto px-4 max-w-4xl mt-6">
        <button className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-4">
          <Settings className="w-4 h-4" />
          Configurar conexão com AMZ Ofertas
          <span className="text-xs">›</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 max-w-4xl pb-12">
        {imported && summary ? (
          /* STEP 4 - Results */
          <div className="bg-[#16213e] rounded-2xl border border-white/10 p-8 space-y-6">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold">Importação Concluída!</h2>
              <p className="text-white/60 mt-1">Lista "{listName}" criada com sucesso</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl p-5 text-center">
                <p className="text-3xl font-bold">{summary.total}</p>
                <p className="text-xs text-white/50 mt-1">Total na planilha</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-center">
                <p className="text-3xl font-bold text-emerald-400">{summary.importados}</p>
                <p className="text-xs text-white/50 mt-1">✅ Importados</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 text-center">
                <p className="text-3xl font-bold text-red-400">{summary.ignorados}</p>
                <p className="text-xs text-white/50 mt-1">❌ Ignorados</p>
              </div>
            </div>

            {summary.detalhes.length > 0 && (
              <details className="bg-white/5 rounded-xl p-4">
                <summary className="text-sm font-medium cursor-pointer flex items-center gap-2 text-white/70">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  Ver {summary.detalhes.length} registros ignorados
                </summary>
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {summary.detalhes.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                      <span className="text-white/40 font-mono truncate max-w-[200px]">
                        {d.linha > 0 ? `Linha ${d.linha}: ` : ''}{d.valor}
                      </span>
                      <span className="text-amber-400 ml-2 shrink-0">{d.motivo}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <Button onClick={resetForm} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
              Importar outro arquivo
            </Button>
          </div>
        ) : contacts.length > 0 ? (
          /* STEP 3 - Review */
          <div className="bg-[#16213e] rounded-2xl border border-white/10 p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              <div>
                <h2 className="text-lg font-bold">Revisar Contatos</h2>
                <p className="text-sm text-white/50">{contacts.length} contatos prontos para importação</p>
              </div>
            </div>

            {parseResult.ignored.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 text-sm text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {parseResult.ignored.length} registros foram ignorados (inválidos/duplicados)
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white/70">Nome da lista</Label>
              <Input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Ex: Grupo VIP Eletrônicos"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Preview table */}
            <div className="bg-white/5 rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-white/10 text-xs font-semibold text-white/60 uppercase tracking-wider">
                <div className="bg-[#16213e] px-4 py-2">Nome</div>
                <div className="bg-[#16213e] px-4 py-2">Telefone</div>
              </div>
              {contacts.slice(0, 6).map((c, i) => (
                <div key={i} className="grid grid-cols-2 gap-px bg-white/5 text-sm">
                  <div className="bg-[#16213e] px-4 py-2 text-white/80">{c.nome || <span className="text-white/30 italic">Sem nome</span>}</div>
                  <div className="bg-[#16213e] px-4 py-2 text-white/60 font-mono text-xs">{c.telefone}</div>
                </div>
              ))}
              {contacts.length > 6 && (
                <div className="bg-[#16213e] px-4 py-2 text-xs text-white/40 text-center">
                  ... e mais {contacts.length - 6} contatos
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={resetForm} variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10">
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || !listName.trim()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                {importing ? 'Importando...' : `Importar ${contacts.length} contatos`}
              </Button>
            </div>
          </div>
        ) : (
          /* STEP 1 - Upload */
          <div className="space-y-6">
            <div className="bg-[#16213e] rounded-2xl border border-white/10 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  📁
                </div>
                <h2 className="text-lg font-bold">Sua planilha — qualquer formato</h2>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-6">
                <p className="text-sm text-emerald-300 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                  Não precisa organizar antes! Mande como está. A IA vai identificar os telefones e nomes automaticamente, mesmo que as colunas estejam trocadas ou com lixo.
                </p>
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-white/15 rounded-2xl p-10 text-center cursor-pointer hover:border-emerald-400/50 hover:bg-emerald-500/5 transition-all group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-500/10 transition-colors">
                  <Upload className="w-8 h-8 text-white/30 group-hover:text-emerald-400 transition-colors" />
                </div>
                <p className="text-white/60 font-medium">Arraste ou clique para subir</p>
                <p className="text-xs text-white/30 mt-1">CSV, TXT — qualquer separador</p>
              </div>

              {/* Paste area */}
              <div className="mt-6">
                <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Ou cole aqui:</p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"João,11999887766\nMaria,21988776655\n..."}
                  rows={4}
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm p-4 resize-none focus:outline-none focus:border-emerald-500/50"
                />
                {pasteText.trim() && (
                  <Button onClick={handlePasteImport} className="mt-2 bg-emerald-500 hover:bg-emerald-600 text-white">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Processar texto colado
                  </Button>
                )}
              </div>
            </div>

            {/* Extension download */}
            <div className="bg-[#16213e] rounded-2xl border border-white/10 p-6">
              <h3 className="font-semibold text-sm text-white/70 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Extensão AMZ Extrator — Extraia contatos do WhatsApp Web
              </h3>
              <div className="flex items-center gap-3 text-xs text-white/40">
                <span>1. Instale a extensão</span>
                <span>→</span>
                <span>2. Abra um grupo no WhatsApp Web</span>
                <span>→</span>
                <span>3. Clique em Extrair</span>
                <span>→</span>
                <span>4. Baixe o CSV</span>
              </div>
              <Button asChild variant="outline" className="mt-4 border-white/20 text-white hover:bg-white/10" size="sm">
                <a href="/AMZ-Extrator-v2.zip" download>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Extensão
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
