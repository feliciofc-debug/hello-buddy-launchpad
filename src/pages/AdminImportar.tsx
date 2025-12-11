import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
  Clock,
  Shield,
  Activity
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

interface ProtectionMetrics {
  taxaEntrega: number;
  taxaBloqueio: number;
  tempoMedioResposta: number;
  enviados: number;
  entregues: number;
  bloqueados: number;
}

type ImportStatus = 'idle' | 'preview' | 'importing' | 'completed' | 'paused' | 'pausa_estrategica';

// CONFIG DE SEGURANÇA ANTI-BAN
const CONFIG_SEGURANCA = {
  DELAY_MIN: 3000,           // 3 segundos
  DELAY_MAX: 8000,           // 8 segundos
  PAUSA_50: 5 * 60 * 1000,   // 5 min
  PAUSA_200: 10 * 60 * 1000, // 10 min
  PAUSA_500: 30 * 60 * 1000, // 30 min
  LIMITE_DIARIO: 500,
  HORA_INICIO: 9,
  HORA_FIM: 22
};

// TEMPLATES DE MENSAGENS VARIADAS
const MENSAGENS_TEMPLATE = [
  `Oi {nome}! 👋 Bem-vindo à AMZ Ofertas! Você vai receber ofertas exclusivas aqui!`,
  `Olá {nome}! 🎉 Cadastro confirmado! Em breve você receberá nossas promoções.`,
  `{nome}, que bom te ter aqui! 🚀 Você acabou de garantir acesso às melhores ofertas!`,
  `Seja bem-vindo, {nome}! 😊 Prepare-se para receber ofertas incríveis!`,
  `Opa {nome}! Tudo certo por aqui! ✅ Você vai adorar nossas novidades!`,
  `{nome}! 🎁 Cadastro realizado! Fique ligado nas promoções que vêm por aí!`,
  `Olá! Você foi cadastrado com sucesso, {nome}! 💪 Ofertas a caminho!`,
  `Oi {nome}! Obrigado por se cadastrar! 🙏 Você não vai perder nenhuma oferta!`,
  `Bem-vindo ao time, {nome}! 🏆 As melhores promoções agora no seu WhatsApp!`,
  `{nome}, seu cadastro foi confirmado! 📱 Prepare-se para economizar!`
];

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
  const [modoImportacao, setModoImportacao] = useState<'ultra_seguro' | 'teste'>('ultra_seguro');
  const [origemOptIn, setOrigemOptIn] = useState('base_historica');
  const [origemPersonalizada, setOrigemPersonalizada] = useState('');
  const [enviarBoasVindas, setEnviarBoasVindas] = useState(true);
  const [usarVariacoesMensagem, setUsarVariacoesMensagem] = useState(true);
  const [pularDuplicados, setPularDuplicados] = useState(true);
  const [validarFormato, setValidarFormato] = useState(true);
  
  // Progresso
  const [progresso, setProgresso] = useState(0);
  const [processados, setProcessados] = useState(0);
  const [sucessos, setSucessos] = useState(0);
  const [duplicados, setDuplicados] = useState(0);
  const [erros, setErros] = useState(0);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [ultimosCadastrados, setUltimosCadastrados] = useState<{nome: string; whatsapp: string; tempo: number; delay: number}[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  
  // Proteção Anti-Ban
  const [cadastrosHoje, setCadastrosHoje] = useState(0);
  const [proximaPausa, setProximaPausa] = useState<{em: number; duracao: string}>({ em: 50, duracao: '5min' });
  const [ultimaPausa, setUltimaPausa] = useState<{ha: number; quantidade: number} | null>(null);
  const [pausaEstrategicaRestante, setPausaEstrategicaRestante] = useState(0);
  const [metrics, setMetrics] = useState<ProtectionMetrics>({
    taxaEntrega: 100,
    taxaBloqueio: 0,
    tempoMedioResposta: 1.2,
    enviados: 0,
    entregues: 0,
    bloqueados: 0
  });
  const [logs, setLogs] = useState<string[]>([]);

  // Funções de utilidade
  const getRandomDelay = () => {
    const { DELAY_MIN, DELAY_MAX } = CONFIG_SEGURANCA;
    return Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;
  };

  const getMensagemAleatoria = (nome: string) => {
    const index = Math.floor(Math.random() * MENSAGENS_TEMPLATE.length);
    return MENSAGENS_TEMPLATE[index].replace('{nome}', nome);
  };

  const isHorarioSeguro = () => {
    const agora = new Date();
    const hora = agora.getHours();
    const dia = agora.getDay();
    
    if (hora < CONFIG_SEGURANCA.HORA_INICIO || hora >= CONFIG_SEGURANCA.HORA_FIM) {
      return false;
    }
    if (dia === 0) return false; // Domingo
    return true;
  };

  const getProximoHorarioSeguro = () => {
    const agora = new Date();
    const hora = agora.getHours();
    const dia = agora.getDay();
    
    if (dia === 0) {
      return 'amanhã às 9h';
    }
    if (hora >= CONFIG_SEGURANCA.HORA_FIM) {
      return 'amanhã às 9h';
    }
    if (hora < CONFIG_SEGURANCA.HORA_INICIO) {
      return `hoje às ${CONFIG_SEGURANCA.HORA_INICIO}h`;
    }
    return 'agora';
  };

  const addLog = (message: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('pt-BR');
    setLogs(prev => [`${timestamp} - ${message}`, ...prev.slice(0, 49)]);
    console.log(`${timestamp} - ${message}`);
  };

  const calcularProximaPausa = (contador: number) => {
    const proximoMultiplo50 = Math.ceil((contador + 1) / 50) * 50;
    const proximoMultiplo200 = Math.ceil((contador + 1) / 200) * 200;
    const proximoMultiplo500 = Math.ceil((contador + 1) / 500) * 500;
    
    const faltaPara50 = proximoMultiplo50 - contador;
    const faltaPara200 = proximoMultiplo200 - contador;
    const faltaPara500 = proximoMultiplo500 - contador;
    
    if (faltaPara500 <= faltaPara200 && faltaPara500 <= faltaPara50 && proximoMultiplo500 <= 500) {
      return { em: faltaPara500, duracao: '30min' };
    }
    if (faltaPara200 <= faltaPara50) {
      return { em: faltaPara200, duracao: '10min' };
    }
    return { em: faltaPara50, duracao: '5min' };
  };

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

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const verificarSaude = () => {
    const { taxaEntrega, taxaBloqueio } = metrics;
    
    if (taxaEntrega < 80) {
      addLog('🚨 ALERTA: Taxa de entrega baixa! Pausando importação...');
      toast.error('Taxa de entrega abaixo de 80%. Importação pausada.');
      return false;
    }
    
    if (taxaBloqueio > 3) {
      addLog('🚨 ALERTA: Muitos bloqueios! Parando imediatamente!');
      toast.error('Taxa de bloqueio acima de 3%. Importação interrompida.');
      return false;
    }
    
    return true;
  };

  const iniciarImportacao = async () => {
    // Verificar horário seguro
    if (!isHorarioSeguro()) {
      toast.error(`Fora do horário seguro. Próximo horário: ${getProximoHorarioSeguro()}`);
      return;
    }

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
    setLogs([]);
    pauseRef.current = false;

    addLog('▶️ INICIANDO importação com proteção anti-ban');

    const validRows = validationResults.filter(r => r.isValid && !r.isDuplicate);
    const duplicateRows = validationResults.filter(r => r.isDuplicate);
    const invalidRows = validationResults.filter(r => !r.isValid);

    // Limite para modo teste
    const rowsToProcess = modoImportacao === 'teste' ? validRows.slice(0, 10) : validRows;

    // Criar registro de importação
    const { data: importacao, error: importError } = await supabase
      .from('importacoes')
      .insert({
        user_id: user.id,
        arquivo_nome: file?.name,
        total_linhas: parsedData.length,
        validos: rowsToProcess.length,
        duplicados: duplicateRows.length,
        erros: invalidRows.length,
        velocidade: 'segura',
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
    let contador = 0;
    let cadastrosDiarios = cadastrosHoje;

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
    addLog(`⚠️ ${duplicateRows.length} duplicados identificados e ignorados`);

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

    // Processar válidos com proteção
    for (let i = 0; i < rowsToProcess.length; i++) {
      // Verificar limite diário
      if (cadastrosDiarios >= CONFIG_SEGURANCA.LIMITE_DIARIO) {
        addLog('⚠️ Limite diário atingido (500 cadastros). Continuará amanhã.');
        toast.warning('Limite diário atingido. Importação pausada até amanhã.');
        break;
      }

      // Verificar horário seguro
      if (!isHorarioSeguro()) {
        addLog(`⏰ Fora do horário seguro. Próximo: ${getProximoHorarioSeguro()}`);
        toast.warning(`Fora do horário seguro. Retome ${getProximoHorarioSeguro()}`);
        break;
      }

      // Verificar pausa manual
      while (pauseRef.current) {
        await sleep(100);
      }

      // PAUSAS ESTRATÉGICAS
      if (contador > 0) {
        if (contador % 500 === 0) {
          addLog(`⏸️ PAUSA ESTRATÉGICA (500 cadastros - 30min)`);
          setStatus('pausa_estrategica');
          const pausaDuracao = CONFIG_SEGURANCA.PAUSA_500;
          for (let p = pausaDuracao; p > 0; p -= 1000) {
            setPausaEstrategicaRestante(Math.ceil(p / 1000));
            await sleep(1000);
            if (pauseRef.current) break;
          }
          setStatus('importing');
          setUltimaPausa({ ha: 0, quantidade: 500 });
          addLog('▶️ RETOMANDO importação...');
        } else if (contador % 200 === 0) {
          addLog(`⏸️ PAUSA ESTRATÉGICA (200 cadastros - 10min)`);
          setStatus('pausa_estrategica');
          const pausaDuracao = CONFIG_SEGURANCA.PAUSA_200;
          for (let p = pausaDuracao; p > 0; p -= 1000) {
            setPausaEstrategicaRestante(Math.ceil(p / 1000));
            await sleep(1000);
            if (pauseRef.current) break;
          }
          setStatus('importing');
          setUltimaPausa({ ha: 0, quantidade: 200 });
          addLog('▶️ RETOMANDO importação...');
        } else if (contador % 50 === 0) {
          addLog(`⏸️ PAUSA ESTRATÉGICA (50 cadastros - 5min)`);
          setStatus('pausa_estrategica');
          const pausaDuracao = CONFIG_SEGURANCA.PAUSA_50;
          for (let p = pausaDuracao; p > 0; p -= 1000) {
            setPausaEstrategicaRestante(Math.ceil(p / 1000));
            await sleep(1000);
            if (pauseRef.current) break;
          }
          setStatus('importing');
          setUltimaPausa({ ha: 0, quantidade: 50 });
          addLog('▶️ RETOMANDO importação...');
        }
      }

      // Verificar saúde a cada 20
      if (contador > 0 && contador % 20 === 0) {
        if (!verificarSaude()) {
          break;
        }
      }

      const result = rowsToProcess[i];
      const cleanedWhatsapp = maskWhatsApp(result.row.whatsapp);
      const delay = getRandomDelay();

      try {
        // Delay aleatório ANTES
        addLog(`⏱️ Aguardando ${(delay/1000).toFixed(1)}seg...`);
        await sleep(delay);

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
        contador++;
        cadastrosDiarios++;
        setSucessos(localSucessos);
        setCadastrosHoje(cadastrosDiarios);

        // Atualizar métricas
        setMetrics(prev => ({
          ...prev,
          enviados: prev.enviados + 1,
          entregues: prev.entregues + 1,
          taxaEntrega: ((prev.entregues + 1) / (prev.enviados + 1)) * 100
        }));

        // Log detalhado
        addLog(`✅ ${result.row.nome} cadastrado (delay: ${(delay/1000).toFixed(1)}seg)`);

        // Atualizar últimos cadastrados
        setUltimosCadastrados(prev => [
          { nome: result.row.nome, whatsapp: cleanedWhatsapp, tempo: Math.floor((Date.now() - startTime) / 1000), delay: delay/1000 },
          ...prev.slice(0, 4)
        ]);

        // Calcular próxima pausa
        setProximaPausa(calcularProximaPausa(contador));

      } catch (error) {
        console.error('Erro ao importar linha:', error);
        localErros++;
        setErros(localErros);

        setMetrics(prev => ({
          ...prev,
          enviados: prev.enviados + 1,
          bloqueados: prev.bloqueados + 1,
          taxaBloqueio: ((prev.bloqueados + 1) / (prev.enviados + 1)) * 100
        }));

        addLog(`❌ Erro: ${result.row.nome}`);

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
      setProgresso(Math.round(((i + 1) / rowsToProcess.length) * 100));

      // Atualizar progresso no banco a cada 10 registros
      if ((i + 1) % 10 === 0) {
        await supabase
          .from('importacoes')
          .update({ 
            progresso: Math.round(((i + 1) / rowsToProcess.length) * 100),
            tempo_decorrido_segundos: Math.floor((Date.now() - startTime) / 1000)
          })
          .eq('id', importacao.id);
      }
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

    addLog('🎉 IMPORTAÇÃO CONCLUÍDA!');
    setStatus('completed');
    toast.success('Importação concluída!');
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(!isPaused);
    if (pauseRef.current) {
      addLog('⏸️ Importação pausada pelo usuário');
    } else {
      addLog('▶️ Importação retomada');
    }
  };

  const cancelarImportacao = () => {
    pauseRef.current = false;
    setStatus('preview');
    addLog('❌ Importação cancelada pelo usuário');
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
  
  // Cálculo de tempo com proteção
  const totalParaProcessar = modoImportacao === 'teste' ? Math.min(validosCount, 10) : validosCount;
  const diasNecessarios = Math.ceil(totalParaProcessar / CONFIG_SEGURANCA.LIMITE_DIARIO);

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
            Importe sua base de clientes com <span className="text-green-600 font-semibold">proteção anti-ban</span>
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
            {/* Configurações de Segurança */}
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Shield className="h-5 w-5" />
                  ⚙️ CONFIGURAÇÕES DE SEGURANÇA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Modo de Importação */}
                <div className="space-y-3">
                  <Label className="font-semibold">MODO DE IMPORTAÇÃO:</Label>
                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors ${modoImportacao === 'ultra_seguro' ? 'border-green-500 bg-green-500/10' : 'border-muted hover:border-green-500/50'}`}>
                      <input
                        type="radio"
                        name="modo"
                        checked={modoImportacao === 'ultra_seguro'}
                        onChange={() => setModoImportacao('ultra_seguro')}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold text-green-700">◉ Ultra Seguro (RECOMENDADO)</p>
                        <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          <li>• Delays: 3-8seg aleatórios</li>
                          <li>• Pausas automáticas a cada 50/200/500</li>
                          <li>• Limite: 500/dia</li>
                          <li>• Horário: 9h-22h</li>
                          <li>• Estimativa: {diasNecessarios} dia(s) para {validosCount} cadastros</li>
                        </ul>
                      </div>
                    </label>
                    
                    <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors ${modoImportacao === 'teste' ? 'border-blue-500 bg-blue-500/10' : 'border-muted hover:border-blue-500/50'}`}>
                      <input
                        type="radio"
                        name="modo"
                        checked={modoImportacao === 'teste'}
                        onChange={() => setModoImportacao('teste')}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold text-blue-700">○ Modo Teste (Apenas 10 cadastros)</p>
                        <p className="text-sm text-muted-foreground mt-1">Para testar funcionamento</p>
                      </div>
                    </label>
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

                {/* Opções de Mensagens */}
                <div className="space-y-3">
                  <Label className="font-semibold">MENSAGENS:</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={enviarBoasVindas} onCheckedChange={(c) => setEnviarBoasVindas(!!c)} />
                      <span className="text-sm">☑️ Enviar boas-vindas</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={usarVariacoesMensagem} onCheckedChange={(c) => setUsarVariacoesMensagem(!!c)} />
                      <span className="text-sm">☑️ Usar 10 variações diferentes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={pularDuplicados} onCheckedChange={(c) => setPularDuplicados(!!c)} />
                      <span className="text-sm">☑️ Pular números duplicados</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={validarFormato} onCheckedChange={(c) => setValidarFormato(!!c)} />
                      <span className="text-sm">☑️ Validar formato WhatsApp</span>
                    </label>
                  </div>
                </div>

                {/* Limites de Segurança */}
                <div className="bg-green-500/10 rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-green-700">LIMITES DE SEGURANÇA:</p>
                  <ul className="text-sm space-y-1">
                    <li>• Máximo por dia: 500 ✅</li>
                    <li>• Pausas automáticas: Sim ✅</li>
                    <li>• Monitoramento: Ativo ✅</li>
                    <li>• Horário seguro: 9h-22h ✅</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠️ ATENÇÃO: Importações grandes levam vários dias. Isso é NORMAL e garante sua segurança!
                  </p>
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

                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Estimativa: {diasNecessarios} dia(s)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Proteção ativa</span>
                  </div>
                </div>

                {/* Aviso importante */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <p className="font-semibold text-amber-700 mb-2">⚠️ IMPORTANTE - LEIA COM ATENÇÃO</p>
                  <ul className="text-sm space-y-1 text-amber-800">
                    <li>📊 Sua importação: {modoImportacao === 'teste' ? '10 (teste)' : validosCount} clientes</li>
                    <li>⏱️ Tempo estimado: {modoImportacao === 'teste' ? '~2 minutos' : `${diasNecessarios} dia(s)`}</li>
                    <li>🛡️ Delays aleatórios (3-8 segundos) + pausas automáticas</li>
                    <li>✅ ISSO É SEGURO! Melhor devagar que banido!</li>
                  </ul>
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
                    className="bg-green-600 hover:bg-green-700 text-white px-8"
                    onClick={iniciarImportacao}
                    disabled={validosCount === 0}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    ENTENDI, INICIAR
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {(status === 'importing' || status === 'pausa_estrategica') && (
          <>
            {/* Dashboard de Proteção */}
            <Card className="border-green-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Shield className="h-5 w-5" />
                  🛡️ PROTEÇÃO ANTI-BAN
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500">
                    🟢 OPERANDO COM SEGURANÇA
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Hoje:</p>
                    <p className="font-semibold">{cadastrosHoje} / 500</p>
                    <p className="text-xs text-muted-foreground">Restantes: {CONFIG_SEGURANCA.LIMITE_DIARIO - cadastrosHoje}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Taxa entrega:</p>
                    <p className={`font-semibold ${metrics.taxaEntrega >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.taxaEntrega.toFixed(1)}% {metrics.taxaEntrega >= 80 ? '🟢' : '🔴'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Taxa bloqueio:</p>
                    <p className={`font-semibold ${metrics.taxaBloqueio <= 3 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.taxaBloqueio.toFixed(1)}% {metrics.taxaBloqueio <= 3 ? '🟢' : '🔴'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">✅ Delays 3-8seg</Badge>
                  <Badge variant="secondary">✅ 10 templates</Badge>
                  <Badge variant="secondary">✅ Pausas auto</Badge>
                  <Badge variant="secondary">✅ Limite 500/dia</Badge>
                  <Badge variant="secondary">✅ Horário 9h-22h</Badge>
                </div>

                <div className="text-sm">
                  {ultimaPausa && (
                    <p className="text-muted-foreground">Última pausa: há {ultimaPausa.ha}min ({ultimaPausa.quantidade} cadastros)</p>
                  )}
                  <p className="text-muted-foreground">Próxima pausa: em {proximaPausa.em} cadastros ({proximaPausa.duracao})</p>
                </div>
              </CardContent>
            </Card>

            {/* Progresso */}
            <Card>
              <CardContent className="p-8 space-y-6">
                {status === 'pausa_estrategica' ? (
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-amber-600">⏸️ PAUSA ESTRATÉGICA</h2>
                    <p className="text-muted-foreground">Aguardando {formatTime(pausaEstrategicaRestante)}</p>
                  </div>
                ) : (
                  <h2 className="text-xl font-bold text-center">⏳ IMPORTAÇÃO EM ANDAMENTO</h2>
                )}
                
                <div className="space-y-2">
                  <Progress value={progresso} className="h-4" />
                  <p className="text-center text-lg font-medium">{progresso}%</p>
                </div>

                <p className="text-center text-muted-foreground">
                  {processados} / {modoImportacao === 'teste' ? Math.min(validosCount, 10) : validosCount} cadastrados
                </p>

                <div className="flex justify-center gap-8 text-sm">
                  <span>⏱️ Tempo decorrido: {formatTime(tempoDecorrido)}</span>
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
                    <div className="space-y-1 text-sm font-mono bg-muted/50 p-3 rounded-lg">
                      {ultimosCadastrados.map((c, i) => (
                        <p key={i}>✅ {c.nome} cadastrado (delay: {c.delay.toFixed(1)}seg)</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logs em tempo real */}
                <div className="border-t pt-4">
                  <p className="font-semibold mb-2">📋 LOGS:</p>
                  <div className="bg-muted/30 rounded-lg p-3 h-40 overflow-y-auto text-xs font-mono space-y-1">
                    {logs.map((log, i) => (
                      <p key={i} className={log.includes('❌') ? 'text-red-600' : log.includes('✅') ? 'text-green-600' : log.includes('⏸️') ? 'text-amber-600' : ''}>{log}</p>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center gap-4 pt-4">
                  <Button variant="outline" onClick={togglePause} disabled={status === 'pausa_estrategica'}>
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
          </>
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
                  <p>Taxa de sucesso: {sucessos > 0 ? ((sucessos / (sucessos + erros)) * 100).toFixed(1) : 0}%</p>
                  <p>🛡️ Importação segura: Zero risco de ban</p>
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
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => navigate('/produtos')}>
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
