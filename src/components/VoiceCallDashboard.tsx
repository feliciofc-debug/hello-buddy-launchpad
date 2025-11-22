import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Phone, PhoneCall, CheckCircle2, Clock, Loader2, AlertCircle, XCircle, Play } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface VoiceCall {
  id: string
  lead_id: string
  lead_type: 'b2b' | 'b2c'
  call_sid: string
  status: string
  duration?: number
  lead_qualified: boolean
  meeting_scheduled: boolean
  created_at: string
  started_at?: string
  completed_at?: string
  transcription?: string
  ai_analysis?: any
}

interface LeadInfo {
  id: string
  nome: string
  telefone: string
}

export function VoiceCallDashboard({ campanhaId }: { campanhaId: string }) {
  const [calls, setCalls] = useState<VoiceCall[]>([])
  const [leadsMap, setLeadsMap] = useState<Record<string, LeadInfo>>({})
  const [activeCall, setActiveCall] = useState<VoiceCall | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    qualified: 0,
    meetings: 0,
    avgDuration: 0
  })
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadCalls()
    
    // Realtime subscription
    const channel = supabase
      .channel('voice_calls_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'voice_calls',
        filter: `campanha_id=eq.${campanhaId}`
      }, (payload) => {
        console.log('Voice call changed:', payload)
        loadCalls()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime conectado')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no Realtime')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [campanhaId])

  const loadCalls = async () => {
    try {
      setError(null)
      
      const { data: callsData, error: callsError } = await supabase
        .from('voice_calls')
        .select('*')
        .eq('campanha_id', campanhaId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (callsError) throw callsError

      if (callsData && callsData.length > 0) {
        setCalls(callsData as VoiceCall[])

        // Buscar informações dos leads
        const leadIdsB2B = callsData.filter(c => c.lead_type === 'b2b').map(c => c.lead_id)
        const leadIdsB2C = callsData.filter(c => c.lead_type === 'b2c').map(c => c.lead_id)

        const leadsMapping: Record<string, LeadInfo> = {}

        if (leadIdsB2B.length > 0) {
          const { data: leadsB2B } = await supabase
            .from('leads_b2b')
            .select('id, razao_social, telefone')
            .in('id', leadIdsB2B)
          
          leadsB2B?.forEach(lead => {
            leadsMapping[lead.id] = {
              id: lead.id,
              nome: lead.razao_social,
              telefone: lead.telefone
            }
          })
        }

        if (leadIdsB2C.length > 0) {
          const { data: leadsB2C } = await supabase
            .from('leads_b2c')
            .select('id, nome_completo, telefone')
            .in('id', leadIdsB2C)

          leadsB2C?.forEach(lead => {
            leadsMapping[lead.id] = {
              id: lead.id,
              nome: lead.nome_completo,
              telefone: lead.telefone
            }
          })
        }

        setLeadsMap(leadsMapping)

        const active = callsData.find(c => c.status === 'in-progress' || c.status === 'ringing')
        setActiveCall((active || null) as VoiceCall | null)
        
        setStats({
          total: callsData.length,
          completed: callsData.filter(c => c.status === 'completed').length,
          qualified: callsData.filter(c => c.lead_qualified).length,
          meetings: callsData.filter(c => c.meeting_scheduled).length,
          avgDuration: callsData.reduce((sum, c) => sum + (c.duration || 0), 0) / callsData.length || 0
        })
      } else {
        setCalls([])
      }
    } catch (err: any) {
      console.error('Erro ao carregar chamadas:', err)
      setError(err.message)
    } finally {
      setInitialLoading(false)
    }
  }

  const startCampaignCalls = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Buscar leads qualificados B2B
      const { data: leadsB2B } = await supabase
        .from('leads_b2b')
        .select('id, razao_social, telefone')
        .eq('campanha_id', campanhaId)
        .eq('pipeline_status', 'qualificado')
        .not('telefone', 'is', null)
        .limit(10)

      // Buscar leads qualificados B2C
      const { data: leadsB2C } = await supabase
        .from('leads_b2c')
        .select('id, nome_completo, telefone')
        .eq('campanha_id', campanhaId)
        .eq('pipeline_status', 'qualificado')
        .not('telefone', 'is', null)
        .limit(10)

      const allLeads = [
        ...(leadsB2B || []).map(l => ({ ...l, lead_type: 'b2b' as const, nome: l.razao_social })),
        ...(leadsB2C || []).map(l => ({ ...l, lead_type: 'b2c' as const, nome: l.nome_completo }))
      ]

      if (allLeads.length === 0) {
        toast({
          title: "Nenhum lead qualificado",
          description: "Não há leads qualificados com telefone nesta campanha",
        })
        return
      }

      console.log(`Encontrados ${allLeads.length} leads qualificados`)

      // Iniciar primeira chamada
      const firstLead = allLeads[0]
      
      console.log('Iniciando chamada para:', firstLead)

      const { data, error } = await supabase.functions.invoke('voice-ai-calling', {
        body: {
          lead_id: firstLead.id,
          lead_type: firstLead.lead_type,
          campanha_id: campanhaId
        }
      })

      if (error) {
        console.error('Erro da Edge Function:', error)
        throw error
      }
      
      console.log('Resposta da Edge Function:', data)

      toast({
        title: "✅ Chamada iniciada!",
        description: `Ligando para ${firstLead.nome}`,
      })

      // Recarregar chamadas após 2 segundos
      setTimeout(() => loadCalls(), 2000)

    } catch (err: any) {
      console.error('Erro ao iniciar chamadas:', err)
      setError(err.message)
      toast({
        title: "❌ Erro ao iniciar chamada",
        description: err.message || 'Erro desconhecido',
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Carregando chamadas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Phone className="h-8 w-8 text-blue-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Chamadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{stats.qualified}</p>
                <p className="text-xs text-muted-foreground">Qualificados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Clock className="h-8 w-8 text-orange-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{Math.round(stats.avgDuration / 60)}m</p>
                <p className="text-xs text-muted-foreground">Duração Média</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <PhoneCall className="h-8 w-8 text-purple-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{stats.meetings}</p>
                <p className="text-xs text-muted-foreground">Reuniões Agendadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Call */}
      {activeCall && (
        <Card className="border-green-500 border-2 bg-green-50 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 animate-pulse text-green-600" />
              Chamada em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-lg font-semibold">
                {leadsMap[activeCall.lead_id]?.nome || 'Carregando...'}
              </p>
              <p className="text-sm text-muted-foreground">
                📞 {leadsMap[activeCall.lead_id]?.telefone}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">
                  {activeCall.status === 'ringing' ? 'Chamando...' : 'Em Conversa'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ⏱️ {activeCall.started_at ? 
                    Math.floor((Date.now() - new Date(activeCall.started_at).getTime()) / 1000) : 0}s
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calls List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Histórico de Chamadas</CardTitle>
            <Button onClick={startCampaignCalls} disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Campanha de Voz
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Phone className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">Nenhuma chamada realizada ainda</p>
              <p className="text-sm">Clique em "Iniciar Campanha de Voz" para começar a ligar para seus leads qualificados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => {
                const lead = leadsMap[call.lead_id]
                return (
                  <div key={call.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium">
                        {lead?.nome || `Lead ${call.lead_id.slice(0, 8)}...`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        📞 {lead?.telefone} • {call.lead_type.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        🕐 {new Date(call.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {call.status === 'completed' && (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Concluída
                        </Badge>
                      )}
                      {call.status === 'failed' && (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Falhou
                        </Badge>
                      )}
                      {call.status === 'no-answer' && (
                        <Badge variant="secondary">
                          Não Atendeu
                        </Badge>
                      )}
                      {call.status === 'busy' && (
                        <Badge variant="secondary">
                          Ocupado
                        </Badge>
                      )}
                      {(call.status === 'in-progress' || call.status === 'ringing') && (
                        <Badge variant="default" className="bg-blue-500 animate-pulse">
                          <PhoneCall className="h-3 w-3 mr-1" />
                          {call.status === 'ringing' ? 'Chamando' : 'Em Conversa'}
                        </Badge>
                      )}
                      {call.lead_qualified && (
                        <Badge variant="default" className="bg-green-700">✅ Qualificado</Badge>
                      )}
                      {call.meeting_scheduled && (
                        <Badge variant="default" className="bg-purple-600">📅 Reunião</Badge>
                      )}
                      <span className="text-sm font-mono">{call.duration || 0}s</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
