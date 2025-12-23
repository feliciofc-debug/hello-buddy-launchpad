import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tabelas importantes para backup
const TABELAS_BACKUP = [
  'cadastros',
  'campanhas_recorrentes',
  'produtos',
  'whatsapp_contacts',
  'whatsapp_conversations',
  'grupos_transmissao',
  'grupo_membros',
  'opt_ins',
  'leads_b2b',
  'leads_b2c',
  'leads_descobertos',
  'biblioteca_campanhas',
  'clientes',
  'vendedores',
  'icp_configs',
  'campanhas_prospeccao'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('🔄 Iniciando backup automático...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Criar registro de log
    const { data: logEntry, error: logError } = await supabase
      .from('backup_logs')
      .insert({
        status: 'em_andamento',
        tabelas_backup: TABELAS_BACKUP
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Erro ao criar log:', logError);
    }
    
    const backupData: Record<string, any> = {
      timestamp: new Date().toISOString(),
      versao: '1.0',
      tabelas: {}
    };
    
    let totalRegistros = 0;
    const tabelasProcessadas: string[] = [];
    const erros: string[] = [];
    
    // Fazer backup de cada tabela
    for (const tabela of TABELAS_BACKUP) {
      try {
        console.log(`📦 Backup da tabela: ${tabela}`);
        
        const { data, error } = await supabase
          .from(tabela)
          .select('*')
          .limit(10000); // Limite de segurança
        
        if (error) {
          console.error(`Erro na tabela ${tabela}:`, error.message);
          erros.push(`${tabela}: ${error.message}`);
          continue;
        }
        
        backupData.tabelas[tabela] = {
          count: data?.length || 0,
          data: data || []
        };
        
        totalRegistros += data?.length || 0;
        tabelasProcessadas.push(tabela);
        
        console.log(`✅ ${tabela}: ${data?.length || 0} registros`);
        
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`Exceção na tabela ${tabela}:`, e);
        erros.push(`${tabela}: ${errorMsg}`);
      }
    }
    
    backupData.resumo = {
      total_tabelas: tabelasProcessadas.length,
      total_registros: totalRegistros,
      tabelas_com_erro: erros.length,
      erros: erros
    };
    
    // Gerar nome do arquivo
    const agora = new Date();
    const dataFormatada = agora.toISOString().split('T')[0];
    const horaFormatada = agora.toTimeString().split(' ')[0].replace(/:/g, '-');
    const nomeArquivo = `backup_${dataFormatada}_${horaFormatada}.json`;
    
    // Converter para JSON
    const jsonContent = JSON.stringify(backupData, null, 2);
    const tamanhoBytes = new TextEncoder().encode(jsonContent).length;
    
    // Salvar no storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('backups')
      .upload(nomeArquivo, jsonContent, {
        contentType: 'application/json',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Erro ao salvar backup:', uploadError);
      throw new Error(`Falha ao salvar: ${uploadError.message}`);
    }
    
    const duracaoMs = Date.now() - startTime;
    
    // Atualizar log
    if (logEntry?.id) {
      await supabase
        .from('backup_logs')
        .update({
          status: 'concluido',
          arquivo_path: nomeArquivo,
          tamanho_bytes: tamanhoBytes,
          duracao_ms: duracaoMs,
          tabelas_backup: tabelasProcessadas
        })
        .eq('id', logEntry.id);
    }
    
    console.log(`✅ Backup concluído: ${nomeArquivo}`);
    console.log(`📊 ${totalRegistros} registros em ${tabelasProcessadas.length} tabelas`);
    console.log(`⏱️ Duração: ${duracaoMs}ms | Tamanho: ${(tamanhoBytes / 1024).toFixed(2)}KB`);
    
    // Limpar backups antigos (manter últimos 30)
    const { data: listaBackups } = await supabase
      .storage
      .from('backups')
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    
    if (listaBackups && listaBackups.length > 30) {
      const backupsAntigos = listaBackups.slice(30).map(f => f.name);
      console.log(`🗑️ Removendo ${backupsAntigos.length} backups antigos...`);
      await supabase.storage.from('backups').remove(backupsAntigos);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        arquivo: nomeArquivo,
        tabelas: tabelasProcessadas.length,
        registros: totalRegistros,
        tamanho_kb: (tamanhoBytes / 1024).toFixed(2),
        duracao_ms: duracaoMs,
        erros: erros.length > 0 ? erros : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro no backup:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
