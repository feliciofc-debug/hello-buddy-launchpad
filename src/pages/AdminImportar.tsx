import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Play,
  Pause,
  X,
  ArrowLeft,
  FileText,
  Users,
  Clock
} from 'lucide-react';

interface ImportRow {
  nome: string;
  whatsapp: string;
  email?: string;
  empresa?: string;
}

interface ValidationResult {
  row: ImportRow;
  linha: number;
  isValid: boolean;
  isDuplicate: boolean;
  error?: string;
}

type ImportStatus = 'idle' | 'preview' | 'importing' | 'completed' | 'paused';

const AdminImportar = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Configurações
  const [velocidade, setVelocidade] = useState<'normal' | 'rapida' | 'muito_rapida'>('normal');
  const [origemOptIn, setOrigemOptIn] = useState('base_historica');
  const [origemPersonalizada, setOrigemPersonalizada] = useState('');
  const [enviarBoasVindas, setEnviarBoasVindas] = useState(true);
  const [pularDuplicados, setPularDuplicados] = useState(true);
  const [validarFormato, setValidarFormato] = useState(true);
  const [tag, setTag] = useState('');
  
  // Progresso
  const [progresso, setProgresso] = useState(0);
  const [processados, setProcessados] = useState(0);
  const [sucessos, setSucessos] = useState(0);
  const [duplicados, setDuplicados] = useState(0);
  const [erros, setErros] = useState(0);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [ultimosCadastrados, setUltimosCadastrados] = useState<{nome: string; whatsapp: string; tempo: number}[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  
  // Funções de validação
  const maskWhatsApp = (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const validateWhatsApp = (whatsapp: string): boolean => {
    const cleaned = whatsapp.replace(/\D/g, '');
    if (cleaned.length !== 11) return false;
    const ddd = parseInt(cleaned.substring(0, 2));
    if (ddd < 11 || ddd > 99) return false;
    if (cleaned[2] !== '9') return false;
    return true;
  };

  const parseCSV = async (file: File): Promise<ImportRow[]> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      return row as ImportRow;
    }).filter(row => row.nome || row.whatsapp);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const downloadTemplate = () => {
    const template = `nome,whatsapp,email,empresa
João Silva,(21) 98765-4321,joao@email.com,Padaria Central
Maria Santos,(21) 99876-5432,maria@email.com,Mercado Bom
Pedro Costa,(21) 97654-3210,pedro@email.com,Restaurante Sabor`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      toast.error('Formato não suportado. Use CSV ou XLSX.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setFile(selectedFile);
    
    try {
      let data: ImportRow[];
      
      if (extension === 'csv') {
        data = await parseCSV(selectedFile);
      } else {
        toast.error('Para XLSX, por favor converta para CSV primeiro.');
        return;
      }

      setParsedData(data);
      await validateData(data);
      setStatus('preview');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo');
    }
  };

  const validateData = async (data: ImportRow[]) => {
    const { data: existingOptIns } = await supabase
      .from('opt_ins')
      .select('whatsapp');
    
    const existingWhatsapps = new Set(
      existingOptIns?.map(o => o.whatsapp.replace(/\D/g, '')) || []
    );

    const results: ValidationResult[] = data.map((row, index) => {
      const cleanedWhatsapp = row.whatsapp?.replace(/\D/g, '') || '';
      
      if (!row.nome || row.nome.length < 3) {
        return { row, linha: index + 2, isValid: false, isDuplicate: false, error: 'Nome inválido (mínimo 3 caracteres)' };
      }
      
      if (!row.whatsapp) {
        return { row, linha: index + 2, isValid: false, isDuplicate: false, error: 'WhatsApp não informado' };
      }
      
      if (validarFormato && !validateWhatsApp(row.whatsapp)) {
        return { row, linha: index + 2, isValid: false, isDuplicate: false, error: 'Formato WhatsApp inválido' };
      }
      
      if (existingWhatsapps.has(cleanedWhatsapp)) {
        return { row, linha: index + 2, isValid: true, isDuplicate: true };
      }
      
      return { row, linha: index + 2, isValid: true, isDuplicate: false };
    });

    setValidationResults(results);
  };

  const getDelayMs = () => {
    switch (velocidade) {
      case 'rapida': return 200;
      case 'muito_rapida': return 100;
      default: return 500;
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const iniciarImportacao = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    setStatus('importing');
    setProgresso(0);
    setProcessados(0);
    setSucessos(0);
    setDuplicados(0);
    setErros(0);
    setTempoDecorrido(0);
    setUltimosCadastrados([]);
    pauseRef.current = false;

    const validRows = validationResults.filter(r => r.isValid && !r.isDuplicate);
    const duplicateRows = validationResults.filter(r => r.isDuplicate);
    const invalidRows = validationResults.filter(r => !r.isValid);

    // Criar registro de importação
    const { data: importacao, error: importError } = await supabase
      .from('importacoes')
      .insert({
        user_id: user.id,
        arquivo_nome: file?.name,
        total_linhas: parsedData.length,
        validos: validRows.length,
        duplicados: duplicateRows.length,
        erros: invalidRows.length,
        velocidade,
        origem_opt_in: origemOptIn === 'personalizado' ? origemPersonalizada : origemOptIn,
        enviar_boas_vindas: enviarBoasVindas,
        status: 'processando'
      })
      .select()
      .single();

    if (importError || !importacao) {
      toast.error('Erro ao criar importação');
      setStatus('preview');
      return;
    }

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setTempoDecorrido(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    let localSucessos = 0;
    let localErros = invalidRows.length;
    const delayMs = getDelayMs();

    // Registrar duplicados
    for (const dup of duplicateRows) {
      await supabase.from('importacao_detalhes').insert({
        importacao_id: importacao.id,
        linha: dup.linha,
        nome: dup.row.nome,
        whatsapp: dup.row.whatsapp,
        email: dup.row.email,
        empresa: dup.row.empresa,
        status: 'duplicado'
      });
    }
    setDuplicados(duplicateRows.length);

    // Registrar inválidos
    for (const inv of invalidRows) {
      await supabase.from('importacao_detalhes').insert({
        importacao_id: importacao.id,
        linha: inv.linha,
        nome: inv.row.nome,
        whatsapp: inv.row.whatsapp,
        email: inv.row.email,
        empresa: inv.row.empresa,
        status: 'erro',
        erro_mensagem: inv.error
      });
    }
    setErros(invalidRows.length);

    // Processar válidos
    for (let i = 0; i < validRows.length; i++) {
      // Verificar pausa
      while (pauseRef.current) {
        await sleep(100);
      }

      const result = validRows[i];
      const cleanedWhatsapp = maskWhatsApp(result.row.whatsapp);

      try {
        // Inserir opt_in
        const { data: optIn, error: optInError } = await supabase
          .from('opt_ins')
          .insert({
            nome: result.row.nome,
            whatsapp: cleanedWhatsapp,
            email: result.row.email || null,
            opt_in_aceito: true,
            origem: origemOptIn === 'personalizado' ? origemPersonalizada : origemOptIn,
            termo_aceite: 'Importação em massa - base histórica de clientes'
          })
          .select()
          .single();

        if (optInError) throw optInError;

        // Registrar detalhe
        await supabase.from('importacao_detalhes').insert({
          importacao_id: importacao.id,
          linha: result.linha,
          nome: result.row.nome,
          whatsapp: cleanedWhatsapp,
          email: result.row.email,
          empresa: result.row.empresa,
          status: 'sucesso',
          opt_in_id: optIn?.id
        });

        localSucessos++;
        setSucessos(localSucessos);

        // Atualizar últimos cadastrados
        setUltimosCadastrados(prev => [
          { nome: result.row.nome, whatsapp: cleanedWhatsapp, tempo: Math.floor((Date.now() - startTime) / 1000) },
          ...prev.slice(0, 4)
        ]);

      } catch (error) {
        console.error('Erro ao importar linha:', error);
        localErros++;
        setErros(localErros);

        await supabase.from('importacao_detalhes').insert({
          importacao_id: importacao.id,
          linha: result.linha,
          nome: result.row.nome,
          whatsapp: cleanedWhatsapp,
          email: result.row.email,
          empresa: result.row.empresa,
          status: 'erro',
          erro_mensagem: 'Erro ao salvar no banco de dados'
        });
      }

      setProcessados(i + 1);
      setProgresso(Math.round(((i + 1) / validRows.length) * 100));

      // Atualizar progresso no banco a cada 10 registros
      if ((i + 1) % 10 === 0) {
        await supabase
          .from('importacoes')
          .update({ 
            progresso: Math.round(((i + 1) / validRows.length) * 100),
            tempo_decorrido_segundos: Math.floor((Date.now() - startTime) / 1000)
          })
          .eq('id', importacao.id);
      }

      await sleep(delayMs);
    }

    clearInterval(timerInterval);

    // Finalizar importação
    await supabase
      .from('importacoes')
      .update({ 
        status: 'concluido',
        progresso: 100,
        validos: localSucessos,
        erros: localErros,
        tempo_decorrido_segundos: Math.floor((Date.now() - startTime) / 1000),
        completed_at: new Date().toISOString()
      })
      .eq('id', importacao.id);

    setStatus('completed');
    toast.success('Importação concluída!');
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(!isPaused);
  };

  const cancelarImportacao = () => {
    pauseRef.current = false;
    setStatus('preview');
    toast.info('Importação cancelada');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}min ${secs.toString().padStart(2, '0')}seg`;
  };

  const validosCount = validationResults.filter(r => r.isValid && !r.isDuplicate).length;
  const duplicadosCount = validationResults.filter(r => r.isDuplicate).length;
  const invalidosCount = validationResults.filter(r => !r.isValid).length;
  const tempoEstimado = Math.ceil(validosCount * getDelayMs() / 1000 / 60);

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
            <span className="text-4xl">🤖</span>
            Importação Automática de Base
          </h1>
          <p className="text-muted-foreground mt-2">
            Importe sua base de clientes com registro automático de opt-in
          </p>
        </div>

        {status === 'idle' && (
          <>
            {/* Instruções */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Instruções
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  📊 Sua planilha deve conter as seguintes colunas:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>nome</strong> (obrigatório)</li>
                  <li><strong>whatsapp</strong> (obrigatório) - formato: (XX) XXXXX-XXXX</li>
                  <li><strong>email</strong> (opcional)</li>
                  <li><strong>empresa</strong> (opcional)</li>
                </ul>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Planilha Modelo
                </Button>
              </CardContent>
            </Card>

            {/* Upload */}
            <Card>
              <CardContent className="p-8">
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer
                    ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    📎 Arraste sua planilha aqui
                  </p>
                  <p className="text-muted-foreground mb-4">ou</p>
                  <Button variant="secondary">
                    Selecionar arquivo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Formatos aceitos: .csv, .xlsx, .xls | Tamanho máximo: 10MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {status === 'preview' && (
          <>
            {/* Configurações */}
            <Card>
              <CardHeader>
                <CardTitle>⚙️ Configurações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Velocidade */}
                <div className="space-y-3">
                  <Label className="font-semibold">VELOCIDADE:</Label>
                  <div className="space-y-2">
                    {[
                      { value: 'normal', label: 'Normal (2 cadastros/segundo - Recomendado)' },
                      { value: 'rapida', label: 'Rápida (5 cadastros/segundo)' },
                      { value: 'muito_rapida', label: 'Muito Rápida (10 cadastros/segundo - Arriscado)' }
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="velocidade"
                          checked={velocidade === opt.value}
                          onChange={() => setVelocidade(opt.value as any)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Origem do Opt-in */}
                <div className="space-y-3">
                  <Label className="font-semibold">ORIGEM DO OPT-IN:</Label>
                  <div className="space-y-2">
                    {[
                      { value: 'base_historica', label: 'Cliente existente - base histórica' },
                      { value: 'loja_fisica', label: 'Cadastro loja física' },
                      { value: 'evento', label: 'Evento/feira' },
                      { value: 'personalizado', label: 'Personalizar' }
                    ].map(opt => (
                      <div key={opt.value}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="origem"
                            checked={origemOptIn === opt.value}
                            onChange={() => setOrigemOptIn(opt.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                        {opt.value === 'personalizado' && origemOptIn === 'personalizado' && (
                          <Input
                            placeholder="Digite a origem personalizada"
                            value={origemPersonalizada}
                            onChange={(e) => setOrigemPersonalizada(e.target.value)}
                            className="mt-2 ml-6 w-64"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opções */}
                <div className="space-y-3">
                  <Label className="font-semibold">OPÇÕES:</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={enviarBoasVindas} onCheckedChange={(c) => setEnviarBoasVindas(!!c)} />
                      <span className="text-sm">Enviar mensagem de boas-vindas após cadastro</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={pularDuplicados} onCheckedChange={(c) => setPularDuplicados(!!c)} />
                      <span className="text-sm">Pular números duplicados</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={validarFormato} onCheckedChange={(c) => setValidarFormato(!!c)} />
                      <span className="text-sm">Validar formato WhatsApp antes de importar</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!tag} onCheckedChange={(c) => setTag(c ? 'importado' : '')} />
                      <span className="text-sm">Adicionar tag:</span>
                      <Input
                        placeholder="ex: importado"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        className="w-40 h-8"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prévia */}
            <Card>
              <CardHeader>
                <CardTitle>📋 PRÉVIA DA IMPORTAÇÃO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{parsedData.length}</p>
                    <p className="text-sm text-muted-foreground">Total linhas</p>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{validosCount}</p>
                    <p className="text-sm text-muted-foreground">✅ Válidos</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{duplicadosCount}</p>
                    <p className="text-sm text-muted-foreground">⚠️ Duplicados</p>
                  </div>
                  <div className="text-center p-4 bg-red-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{invalidosCount}</p>
                    <p className="text-sm text-muted-foreground">❌ Inválidos</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Tempo estimado: {tempoEstimado} minutos</span>
                </div>

                {invalidosCount > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <p className="font-semibold text-red-600 mb-2">ERROS ENCONTRADOS:</p>
                    <ul className="text-sm space-y-1">
                      {validationResults.filter(r => !r.isValid).slice(0, 5).map((r, i) => (
                        <li key={i}>- Linha {r.linha}: {r.error}</li>
                      ))}
                      {invalidosCount > 5 && <li>... e mais {invalidosCount - 5} erros</li>}
                    </ul>
                  </div>
                )}

                {/* Tabela preview */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Nome</th>
                        <th className="p-2 text-left">WhatsApp</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResults.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{r.row.nome}</td>
                          <td className="p-2">{r.row.whatsapp}</td>
                          <td className="p-2">{r.row.email || '-'}</td>
                          <td className="p-2 text-center">
                            {r.isDuplicate ? (
                              <span className="text-yellow-600">⚠️</span>
                            ) : r.isValid ? (
                              <span className="text-green-600">✅</span>
                            ) : (
                              <span className="text-red-600">❌</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Botões */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStatus('idle')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    VOLTAR
                  </Button>
                  <Button 
                    size="lg" 
                    className="bg-[#E31E24] hover:bg-[#C62828] text-white px-8"
                    onClick={iniciarImportacao}
                    disabled={validosCount === 0}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    INICIAR IMPORTAÇÃO
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {status === 'importing' && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <h2 className="text-xl font-bold text-center">⏳ IMPORTAÇÃO EM ANDAMENTO</h2>
              
              <div className="space-y-2">
                <Progress value={progresso} className="h-4" />
                <p className="text-center text-lg font-medium">{progresso}%</p>
              </div>

              <p className="text-center text-muted-foreground">
                {processados} / {validosCount} cadastrados
              </p>

              <div className="flex justify-center gap-8 text-sm">
                <span>⏱️ Tempo decorrido: {formatTime(tempoDecorrido)}</span>
                <span>⏱️ Tempo restante: ~{formatTime(Math.ceil((validosCount - processados) * getDelayMs() / 1000))}</span>
              </div>

              <div className="border-t pt-4 space-y-2">
                <p className="font-semibold">STATUS:</p>
                <div className="flex gap-6">
                  <span className="text-green-600">✅ Sucesso: {sucessos}</span>
                  <span className="text-yellow-600">⚠️ Duplicados: {duplicados}</span>
                  <span className="text-red-600">❌ Erros: {erros}</span>
                </div>
              </div>

              {ultimosCadastrados.length > 0 && (
                <div className="border-t pt-4">
                  <p className="font-semibold mb-2">ÚLTIMOS CADASTRADOS:</p>
                  <div className="space-y-1 text-sm">
                    {ultimosCadastrados.map((c, i) => (
                      <p key={i}>- {c.nome} - {c.whatsapp} ✅ há {tempoDecorrido - c.tempo} seg</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4 pt-4">
                <Button variant="outline" onClick={togglePause}>
                  {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                  {isPaused ? 'CONTINUAR' : 'PAUSAR'}
                </Button>
                <Button variant="destructive" onClick={cancelarImportacao}>
                  <X className="h-4 w-4 mr-2" />
                  CANCELAR
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {status === 'completed' && (
          <Card>
            <CardContent className="p-8 space-y-6 text-center">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-bold">IMPORTAÇÃO CONCLUÍDA!</h2>

              <div className="space-y-1">
                <p className="text-green-600">✅ {sucessos} clientes cadastrados com sucesso</p>
                <p className="text-yellow-600">⚠️ {duplicados} duplicados (ignorados)</p>
                <p className="text-red-600">❌ {erros} com erro</p>
              </div>

              <div className="border-t pt-4">
                <p className="font-semibold mb-2">📊 ESTATÍSTICAS:</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Tempo total: {formatTime(tempoDecorrido)}</p>
                  <p>Velocidade média: {(sucessos / tempoDecorrido).toFixed(1)} cadastros/seg</p>
                  <p>Taxa de sucesso: {((sucessos / validosCount) * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="font-semibold mb-2">💬 PRÓXIMOS PASSOS:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Todos clientes estão na sua base</li>
                  <li>✓ Opt-in registrado legalmente</li>
                  {enviarBoasVindas && <li>✓ Mensagens de boas-vindas serão enviadas</li>}
                </ul>
              </div>

              <div className="flex justify-center gap-4 pt-4">
                <Button variant="outline" onClick={() => navigate('/admin')}>
                  <Users className="h-4 w-4 mr-2" />
                  VER CONTATOS
                </Button>
                <Button className="bg-[#E31E24] hover:bg-[#C62828]" onClick={() => navigate('/produtos')}>
                  <FileText className="h-4 w-4 mr-2" />
                  CRIAR CAMPANHA
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminImportar;
