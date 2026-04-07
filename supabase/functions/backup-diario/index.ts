import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const tabelas = [
      'produtos',
      'profiles',
      'clientes',
      'cadastros',
      'social_posts_queue',
      'campanhas_recorrentes',
      'biblioteca_campanhas',
      'meta_connections',
      'autopilot_config',
      'afiliado_produtos',
      'afiliado_ebooks',
      'afiliado_clientes_ebooks',
      'leads_ebooks',
      'whatsapp_contacts',
      'opt_ins',
      'pj_clientes_config',
      'billing_customers',
      'billing_subscriptions',
      'user_roles',
      'trial_configs',
      'videos',
    ]

    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toISOString().split('T')[1].replace(/[:.]/g, '-').slice(0, 8)
    const backupFolder = `${dateStr}/${timeStr}`

    const tabelasBackup: string[] = []
    const errors: string[] = []
    let totalSize = 0

    for (const tabela of tabelas) {
      try {
        // Buscar todos os dados (paginado para tabelas grandes)
        let allData: any[] = []
        let from = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from(tabela)
            .select('*')
            .range(from, from + pageSize - 1)

          if (error) {
            // Tabela pode não existir, pular
            console.warn(`⚠️ Erro na tabela ${tabela}: ${error.message}`)
            errors.push(`${tabela}: ${error.message}`)
            hasMore = false
            break
          }

          if (data && data.length > 0) {
            allData = allData.concat(data)
            from += pageSize
            if (data.length < pageSize) hasMore = false
          } else {
            hasMore = false
          }
        }

        if (allData.length === 0) {
          console.log(`📭 Tabela ${tabela}: vazia, pulando`)
          continue
        }

        // Salvar como JSON no storage
        const jsonContent = JSON.stringify(allData, null, 2)
        const blob = new Blob([jsonContent], { type: 'application/json' })
        const filePath = `${backupFolder}/${tabela}.json`

        const { error: uploadError } = await supabase.storage
          .from('backups')
          .upload(filePath, blob, {
            contentType: 'application/json',
            upsert: true,
          })

        if (uploadError) {
          console.error(`❌ Erro upload ${tabela}: ${uploadError.message}`)
          errors.push(`upload ${tabela}: ${uploadError.message}`)
        } else {
          totalSize += jsonContent.length
          tabelasBackup.push(tabela)
          console.log(`✅ ${tabela}: ${allData.length} registros (${(jsonContent.length / 1024).toFixed(1)}KB)`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        errors.push(`${tabela}: ${msg}`)
        console.error(`❌ Erro processando ${tabela}:`, msg)
      }
    }

    const duracao = Date.now() - startTime

    // Registrar log do backup
    await supabase.from('backup_logs').insert({
      status: errors.length === 0 ? 'sucesso' : 'parcial',
      tabelas_backup: tabelasBackup,
      tamanho_bytes: totalSize,
      duracao_ms: duracao,
      arquivo_path: backupFolder,
      erro: errors.length > 0 ? errors.join('; ') : null,
    })

    // Limpar backups antigos (manter últimos 30 dias)
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 30)
      const cutoffStr = cutoffDate.toISOString().split('T')[0]

      const { data: folders } = await supabase.storage
        .from('backups')
        .list('', { limit: 100 })

      if (folders) {
        for (const folder of folders) {
          if (folder.name < cutoffStr) {
            const { data: files } = await supabase.storage
              .from('backups')
              .list(folder.name)

            if (files && files.length > 0) {
              const paths = files.map(f => `${folder.name}/${f.name}`)
              await supabase.storage.from('backups').remove(paths)
              // Remove subfolders too
              const { data: subFolders } = await supabase.storage
                .from('backups')
                .list(folder.name)
              if (subFolders) {
                for (const sub of subFolders) {
                  const { data: subFiles } = await supabase.storage
                    .from('backups')
                    .list(`${folder.name}/${sub.name}`)
                  if (subFiles && subFiles.length > 0) {
                    const subPaths = subFiles.map(f => `${folder.name}/${sub.name}/${f.name}`)
                    await supabase.storage.from('backups').remove(subPaths)
                  }
                }
              }
            }
            console.log(`🗑️ Backup antigo removido: ${folder.name}`)
          }
        }
      }
    } catch (cleanErr) {
      console.warn('⚠️ Erro limpando backups antigos:', cleanErr)
    }

    return new Response(JSON.stringify({
      success: true,
      backup_path: backupFolder,
      tabelas: tabelasBackup.length,
      tamanho_kb: (totalSize / 1024).toFixed(1),
      duracao_ms: duracao,
      erros: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const duracao = Date.now() - startTime
    console.error('❌ Erro geral backup:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      duracao_ms: duracao,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
