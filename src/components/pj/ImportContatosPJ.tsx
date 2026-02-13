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
  nome: string;
  telefone: string;
}

export default function ImportContatosPJ() {
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [listName, setListName] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): ParsedContact[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Detect separator
    const header = lines[0];
    const separator = header.includes(';') ? ';' : ',';

    const result: ParsedContact[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(separator);
      const nome = (parts[0] || '').trim().replace(/^"|"$/g, '');
      const telefone = (parts[1] || '').trim().replace(/^"|"$/g, '').replace(/[^\d+]/g, '');
      if (telefone && telefone.length >= 8) {
        result.push({ nome, telefone });
      }
    }
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.txt')) {
      toast.error('Formato inválido. Use CSV ou TXT.');
      return;
    }

    setFile(selectedFile);
    setImported(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setContacts(parsed);

      if (parsed.length === 0) {
        toast.error('Nenhum contato válido encontrado no arquivo.');
      } else {
        toast.success(`${parsed.length} contatos encontrados!`);
      }

      // Auto-set list name from filename
      if (!listName) {
        const name = selectedFile.name.replace(/\.(csv|txt)$/i, '').replace(/_/g, ' ');
        setListName(name);
      }
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  const handleImport = async () => {
    if (contacts.length === 0 || !listName.trim()) {
      toast.error('Preencha o nome da lista e selecione um arquivo.');
      return;
    }

    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Create list
      const { data: lista, error: listaError } = await supabase
        .from('pj_listas_categoria')
        .insert({
          user_id: user.id,
          nome: listName.trim(),
          descricao: `Importado via extensão AMZ (${contacts.length} contatos)`,
          cor: '#7e22ce',
          icone: '📱',
          ativa: true,
          total_membros: contacts.length,
        })
        .select('id')
        .single();

      if (listaError) throw listaError;

      // Insert contacts in batches of 100
      const batchSize = 100;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize).map(c => ({
          lista_id: lista.id,
          nome: c.nome || null,
          telefone: c.telefone,
        }));

        const { error: membrosError } = await supabase
          .from('pj_lista_membros')
          .insert(batch);

        if (membrosError) throw membrosError;
      }

      setImported(true);
      toast.success(`${contacts.length} contatos importados com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao importar:', err);
      toast.error('Erro ao importar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setContacts([]);
    setListName('');
    setImported(false);
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

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
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
          {imported ? (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <p className="text-lg font-bold text-green-700">{contacts.length} contatos importados!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Lista "<strong>{listName}</strong>" criada com sucesso.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Agora você pode usar esta lista na aba <strong>Envios</strong> para criar campanhas.
                </p>
              </div>
              <Button variant="outline" onClick={resetForm}>
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
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {contacts.length} contatos
                    </Badge>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Clique para selecionar o arquivo CSV
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      CSV com colunas Nome e Telefone
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
