import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { 
  Building2, 
  Users, 
  MapPin, 
  Search,
  X,
  Plus,
  Loader2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Filter,
  Zap,
  Target,
  AlertCircle
} from 'lucide-react'

// ===================================================================
// DADOS DISPONÍVEIS
// ===================================================================

const PROFISSOES_DISPONIVEIS = [
  // Saúde
  { value: 'medico', label: 'Médico', categoria: 'Saúde', icon: '🏥' },
  { value: 'dentista', label: 'Dentista', categoria: 'Saúde', icon: '🦷' },
  { value: 'fisioterapeuta', label: 'Fisioterapeuta', categoria: 'Saúde', icon: '💪' },
  { value: 'nutricionista', label: 'Nutricionista', categoria: 'Saúde', icon: '🥗' },
  { value: 'psicologo', label: 'Psicólogo', categoria: 'Saúde', icon: '🧠' },
  { value: 'farmaceutico', label: 'Farmacêutico', categoria: 'Saúde', icon: '💊' },
  { value: 'enfermeiro', label: 'Enfermeiro', categoria: 'Saúde', icon: '⚕️' },
  { value: 'veterinario', label: 'Veterinário', categoria: 'Saúde', icon: '🐾' },
  
  // Jurídico
  { value: 'advogado', label: 'Advogado', categoria: 'Jurídico', icon: '⚖️' },
  { value: 'juiz', label: 'Juiz', categoria: 'Jurídico', icon: '👨‍⚖️' },
  { value: 'promotor', label: 'Promotor', categoria: 'Jurídico', icon: '📜' },
  
  // Engenharia
  { value: 'engenheiro_civil', label: 'Engenheiro Civil', categoria: 'Engenharia', icon: '🏗️' },
  { value: 'engenheiro_eletrico', label: 'Engenheiro Elétrico', categoria: 'Engenharia', icon: '⚡' },
  { value: 'engenheiro_mecanico', label: 'Engenheiro Mecânico', categoria: 'Engenharia', icon: '⚙️' },
  { value: 'arquiteto', label: 'Arquiteto', categoria: 'Engenharia', icon: '📐' },
  
  // Tecnologia
  { value: 'desenvolvedor', label: 'Desenvolvedor', categoria: 'Tecnologia', icon: '💻' },
  { value: 'analista_ti', label: 'Analista de TI', categoria: 'Tecnologia', icon: '🖥️' },
  { value: 'designer', label: 'Designer', categoria: 'Tecnologia', icon: '🎨' },
  
  // Finanças
  { value: 'contador', label: 'Contador', categoria: 'Finanças', icon: '📊' },
  { value: 'auditor', label: 'Auditor', categoria: 'Finanças', icon: '🔍' },
  { value: 'consultor_financeiro', label: 'Consultor Financeiro', categoria: 'Finanças', icon: '💰' },
  { value: 'gerente_banco', label: 'Gerente de Banco', categoria: 'Finanças', icon: '🏦' },
  
  // Educação
  { value: 'professor', label: 'Professor', categoria: 'Educação', icon: '👨‍🏫' },
  { value: 'diretor_escola', label: 'Diretor de Escola', categoria: 'Educação', icon: '🎓' },
  { value: 'coordenador', label: 'Coordenador Pedagógico', categoria: 'Educação', icon: '📚' },
  
  // Negócios/Executivos
  { value: 'empresario', label: 'Empresário', categoria: 'Negócios', icon: '💼' },
  { value: 'gerente', label: 'Gerente', categoria: 'Negócios', icon: '👔' },
  { value: 'diretor', label: 'Diretor', categoria: 'Negócios', icon: '🎯' },
  { value: 'ceo', label: 'CEO/Presidente', categoria: 'Negócios', icon: '👑' },
  { value: 'consultor', label: 'Consultor', categoria: 'Negócios', icon: '📈' },
  
  // Comércio
  { value: 'comerciante', label: 'Comerciante', categoria: 'Comércio', icon: '🛒' },
  { value: 'vendedor', label: 'Vendedor', categoria: 'Comércio', icon: '🤝' },
]

const SETORES_B2B = [
  'Tecnologia', 'Saúde', 'Educação', 'Financeiro', 'Varejo', 
  'Indústria', 'Construção', 'Alimentação', 'Transporte', 
  'Logística', 'Agricultura', 'Energia', 'Telecom', 'Mídia',
  'Turismo', 'Imobiliário', 'Seguros', 'Consultoria', 'Automotivo'
]

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

// ===================================================================
// COMPONENTE PRINCIPAL
// ===================================================================

export default function ConfigurarICP() {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basico')
  
  // Estado do formulário
  const [nomeICP, setNomeICP] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipoProspeccao, setTipoProspeccao] = useState<'b2b' | 'b2c' | 'ambos'>('ambos')
  
  // B2B - Seleção múltipla
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([])
  
  // B2C - Seleção múltipla
  const [profissoesSelecionadas, setProfissoesSelecionadas] = useState<string[]>([])
  const [searchProfissao, setSearchProfissao] = useState('')
  const [profissoesCustomizadas, setProfissoesCustomizadas] = useState<string[]>([])
  const [novaProfissao, setNovaProfissao] = useState('')
  
  // Geográfico
  const [estadosSelecionados, setEstadosSelecionados] = useState<string[]>([])
  
  // ⭐ REFINAMENTOS (campo livre)
  const [refinamentoEmpresa, setRefinamentoEmpresa] = useState('')
  const [refinamentoProfissional, setRefinamentoProfissional] = useState('')
  const [refinamentoGeografico, setRefinamentoGeografico] = useState('')
  const [refinamentoComportamental, setRefinamentoComportamental] = useState('')

  // Sugestões da IA
  const [sugestoesIA, setSugestoesIA] = useState<any[]>([])
  const [loadingIA, setLoadingIA] = useState(false)

  const profissoesFiltradas = PROFISSOES_DISPONIVEIS.filter(p => 
    p.label.toLowerCase().includes(searchProfissao.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchProfissao.toLowerCase())
  )

  // ===================================================================
  // AÇÕES DE SELEÇÃO RÁPIDA
  // ===================================================================

  const selecionarTodosSetores = () => {
    setSetoresSelecionados(SETORES_B2B)
    toast({
      title: "✅ Todos os setores selecionados",
      description: `${SETORES_B2B.length} setores marcados`
    })
  }

  const selecionarTodasProfissoes = () => {
    setProfissoesSelecionadas(PROFISSOES_DISPONIVEIS.map(p => p.value))
    toast({
      title: "✅ Todas as profissões selecionadas",
      description: `${PROFISSOES_DISPONIVEIS.length} profissões marcadas`
    })
  }

  const selecionarPorCategoria = (categoria: string) => {
    const profissoesCategoria = PROFISSOES_DISPONIVEIS
      .filter(p => p.categoria === categoria)
      .map(p => p.value)
    
    setProfissoesSelecionadas(prev => {
      const novaSelecao = [...new Set([...prev, ...profissoesCategoria])]
      return novaSelecao
    })
    
    toast({
      title: `✅ Categoria ${categoria} selecionada`,
      description: `${profissoesCategoria.length} profissões adicionadas`
    })
  }

  // ===================================================================
  // GERAR SUGESTÕES COM IA
  // ===================================================================

  const gerarSugestoesIA = async () => {
    setLoadingIA(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const sugestoes = [
        {
          categoria: "Tamanho Empresa",
          sugestao: "Empresas com mais de 100 funcionários",
          motivo: "Maior poder de compra e decisão descentralizada"
        },
        {
          categoria: "Cargo/Função",
          sugestao: "Diretores, Gerentes e C-Level",
          motivo: "Tomadores de decisão com orçamento aprovado"
        },
        {
          categoria: "Faturamento",
          sugestao: "Faturamento anual acima de R$ 5 milhões",
          motivo: "Capacidade financeira para investir em soluções"
        },
        {
          categoria: "Localização",
          sugestao: "Regiões metropolitanas e capitais",
          motivo: "Maior concentração de empresas e profissionais qualificados"
        },
        {
          categoria: "Comportamento",
          sugestao: "Ativos em redes sociais profissionais (LinkedIn)",
          motivo: "Mais receptivos a abordagens modernas"
        }
      ]
      
      setSugestoesIA(sugestoes)
      
      toast({
        title: "✨ Sugestões geradas com sucesso!",
        description: `${sugestoes.length} refinamentos inteligentes prontos`
      })

    } catch (error) {
      console.error(error)
      toast({
        title: "❌ Erro ao gerar sugestões",
        description: "Tente novamente em instantes",
        variant: "destructive"
      })
    } finally {
      setLoadingIA(false)
    }
  }

  const aplicarSugestao = (sugestao: any) => {
    const campo = sugestao.categoria.includes('Empresa') || sugestao.categoria.includes('Tamanho') || sugestao.categoria.includes('Faturamento')
      ? 'empresa'
      : sugestao.categoria.includes('Cargo') || sugestao.categoria.includes('Função')
      ? 'profissional'
      : sugestao.categoria.includes('Localização') || sugestao.categoria.includes('Geográfico')
      ? 'geografico'
      : 'comportamental'

    const textoSugestao = `- ${sugestao.sugestao} (${sugestao.motivo})`

    if (campo === 'empresa') {
      setRefinamentoEmpresa(prev => prev ? `${prev}\n${textoSugestao}` : textoSugestao)
    } else if (campo === 'profissional') {
      setRefinamentoProfissional(prev => prev ? `${prev}\n${textoSugestao}` : textoSugestao)
    } else if (campo === 'geografico') {
      setRefinamentoGeografico(prev => prev ? `${prev}\n${textoSugestao}` : textoSugestao)
    } else {
      setRefinamentoComportamental(prev => prev ? `${prev}\n${textoSugestao}` : textoSugestao)
    }

    setSugestoesIA(prev => prev.filter(s => s !== sugestao))
    
    toast({
      title: "✅ Sugestão aplicada!",
      description: `Adicionada ao refinamento`
    })
  }

  // ===================================================================
  // SALVAR ICP
  // ===================================================================

  const salvarICP = async () => {
    if (!nomeICP.trim()) {
      toast({
        title: "❌ Nome obrigatório",
        description: "Informe um nome para o ICP",
        variant: "destructive"
      })
      return
    }

    if (tipoProspeccao !== 'b2c' && setoresSelecionados.length === 0) {
      toast({
        title: "⚠️ Nenhum setor selecionado",
        description: "Para B2B, selecione pelo menos um setor",
        variant: "destructive"
      })
      return
    }

    if (tipoProspeccao !== 'b2b' && profissoesSelecionadas.length === 0 && profissoesCustomizadas.length === 0) {
      toast({
        title: "⚠️ Nenhuma profissão selecionada",
        description: "Para B2C, selecione pelo menos uma profissão",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const configB2B = (tipoProspeccao === 'b2b' || tipoProspeccao === 'ambos') ? {
        setores: setoresSelecionados,
        refinamentos: refinamentoEmpresa
      } : null

      const configB2C = (tipoProspeccao === 'b2c' || tipoProspeccao === 'ambos') ? {
        profissoes: profissoesSelecionadas,
        profissoes_customizadas: profissoesCustomizadas,
        refinamentos: refinamentoProfissional
      } : null

      const { error } = await supabase.from('icp_configs').insert({
        user_id: user.id,
        nome: nomeICP,
        descricao,
        tipo: tipoProspeccao,
        b2b_config: configB2B,
        b2c_config: configB2C,
        filtros_avancados: {
          estados: estadosSelecionados
        },
        refinamento_geografico: refinamentoGeografico,
        refinamento_comportamental: refinamentoComportamental,
        ativo: true
      })

      if (error) throw error

      toast({
        title: "✅ ICP salvo com sucesso!",
        description: "Pronto para gerar leads inteligentes"
      })

      setTimeout(() => navigate('/campanhas'), 1500)

    } catch (error: any) {
      console.error(error)
      toast({
        title: "❌ Erro ao salvar",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // ===================================================================
  // RENDER
  // ===================================================================

  const totalSelecionado = 
    setoresSelecionados.length + 
    profissoesSelecionadas.length + 
    profissoesCustomizadas.length +
    estadosSelecionados.length

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Configurar Perfil Cliente Ideal (ICP)</h1>
        <p className="text-muted-foreground">
          Marque <strong>TUDO</strong> que faz sentido e depois refine com critérios específicos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* COLUNA PRINCIPAL (3/4) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Card Básico */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do ICP *</Label>
                <Input
                  placeholder="Ex: Executivos RJ Alto Padrão 2025"
                  value={nomeICP}
                  onChange={(e) => setNomeICP(e.target.value)}
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Ex: Profissionais de alto poder aquisitivo que trabalham em empresas grandes..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <Label>Tipo de Prospecção</Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <Button
                    type="button"
                    variant={tipoProspeccao === 'b2b' ? 'default' : 'outline'}
                    onClick={() => setTipoProspeccao('b2b')}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    B2B
                  </Button>
                  <Button
                    type="button"
                    variant={tipoProspeccao === 'b2c' ? 'default' : 'outline'}
                    onClick={() => setTipoProspeccao('b2c')}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    B2C
                  </Button>
                  <Button
                    type="button"
                    variant={tipoProspeccao === 'ambos' ? 'default' : 'outline'}
                    onClick={() => setTipoProspeccao('ambos')}
                  >
                    <Target className="mr-2 h-4 w-4" />
                    Ambos
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs de Configuração */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basico">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Seleção Rápida
              </TabsTrigger>
              <TabsTrigger value="refinamento">
                <Filter className="h-4 w-4 mr-2" />
                Refinamentos
              </TabsTrigger>
              <TabsTrigger value="geografico">
                <MapPin className="h-4 w-4 mr-2" />
                Localização
              </TabsTrigger>
              <TabsTrigger value="ia">
                <Sparkles className="h-4 w-4 mr-2" />
                IA Sugestões
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SELEÇÃO RÁPIDA */}
            <TabsContent value="basico" className="space-y-6">
              {/* Setores B2B */}
              {(tipoProspeccao === 'b2b' || tipoProspeccao === 'ambos') && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Setores B2B</CardTitle>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={selecionarTodosSetores}>
                          <Plus className="h-3 w-3 mr-1" />
                          Selecionar Todos
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSetoresSelecionados([])}>
                          <X className="h-3 w-3 mr-1" />
                          Limpar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {SETORES_B2B.map(setor => (
                        <Badge
                          key={setor}
                          variant={setoresSelecionados.includes(setor) ? 'default' : 'outline'}
                          className="cursor-pointer hover:scale-105 transition-all text-sm py-1.5 px-3"
                          onClick={() => setSetoresSelecionados(prev =>
                            prev.includes(setor) ? prev.filter(s => s !== setor) : [...prev, setor]
                          )}
                        >
                          {setor}
                          {setoresSelecionados.includes(setor) && (
                            <CheckCircle2 className="h-3 w-3 ml-1" />
                          )}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      ✅ {setoresSelecionados.length} de {SETORES_B2B.length} selecionados
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Profissões B2C */}
              {(tipoProspeccao === 'b2c' || tipoProspeccao === 'ambos') && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Profissões B2C</CardTitle>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={selecionarTodasProfissoes}>
                          <Plus className="h-3 w-3 mr-1" />
                          Selecionar Todas
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setProfissoesSelecionadas([])}>
                          <X className="h-3 w-3 mr-1" />
                          Limpar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Busca */}
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar profissão..."
                        value={searchProfissao}
                        onChange={(e) => setSearchProfissao(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Seleção por Categoria */}
                    <div className="flex flex-wrap gap-2">
                      {[...new Set(PROFISSOES_DISPONIVEIS.map(p => p.categoria))].map(cat => (
                        <Button
                          key={cat}
                          size="sm"
                          variant="secondary"
                          onClick={() => selecionarPorCategoria(cat)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Todas de {cat}
                        </Button>
                      ))}
                    </div>

                    <Separator />

                    {/* Lista por Categoria */}
                    <div className="max-h-96 overflow-y-auto space-y-4">
                      {Object.entries(
                        profissoesFiltradas.reduce((acc, prof) => {
                          if (!acc[prof.categoria]) acc[prof.categoria] = []
                          acc[prof.categoria].push(prof)
                          return acc
                        }, {} as Record<string, typeof PROFISSOES_DISPONIVEIS>)
                      ).map(([categoria, profissoes]) => (
                        <div key={categoria}>
                          <h4 className="font-semibold text-sm mb-2 text-primary">{categoria}</h4>
                          <div className="flex flex-wrap gap-2">
                            {profissoes.map(prof => (
                              <Badge
                                key={prof.value}
                                variant={profissoesSelecionadas.includes(prof.value) ? 'default' : 'outline'}
                                className="cursor-pointer hover:scale-105 transition-all text-sm py-1.5"
                                onClick={() => setProfissoesSelecionadas(prev =>
                                  prev.includes(prof.value) ? prev.filter(p => p !== prof.value) : [...prev, prof.value]
                                )}
                              >
                                <span className="mr-1">{prof.icon}</span>
                                {prof.label}
                                {profissoesSelecionadas.includes(prof.value) && (
                                  <CheckCircle2 className="h-3 w-3 ml-1" />
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      ✅ {profissoesSelecionadas.length} de {PROFISSOES_DISPONIVEIS.length} selecionadas
                    </p>

                    {/* Adicionar Customizada */}
                    <Separator />
                    <div>
                      <Label>Profissão não listada? Adicione aqui:</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="Ex: Coach Executivo, Personal Trainer..."
                          value={novaProfissao}
                          onChange={(e) => setNovaProfissao(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              if (novaProfissao.trim()) {
                                setProfissoesCustomizadas(prev => [...prev, novaProfissao.trim()])
                                setNovaProfissao('')
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            if (novaProfissao.trim()) {
                              setProfissoesCustomizadas(prev => [...prev, novaProfissao.trim()])
                              setNovaProfissao('')
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {profissoesCustomizadas.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {profissoesCustomizadas.map(prof => (
                            <Badge key={prof} variant="secondary" className="gap-1">
                              ✨ {prof}
                              <X
                                className="h-3 w-3 cursor-pointer hover:text-destructive"
                                onClick={() => setProfissoesCustomizadas(prev => prev.filter(p => p !== prof))}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB 2: REFINAMENTOS */}
            <TabsContent value="refinamento" className="space-y-6">
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  <strong>Exemplo para Concessionária:</strong> "Profissionais que trabalham em empresas com mais de 100 funcionários, cargos de gerência ou diretoria, faturamento acima de R$ 5 milhões/ano"
                </AlertDescription>
              </Alert>

              {(tipoProspeccao === 'b2b' || tipoProspeccao === 'ambos') && (
                <Card>
                  <CardHeader>
                    <CardTitle>🏢 Refinamento: Tipo de Empresa</CardTitle>
                    <CardDescription>
                      Detalhe o perfil das empresas (tamanho, faturamento, maturidade, etc)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder={"Ex:\n- Empresas com mais de 100 funcionários\n- Faturamento anual acima de R$ 5 milhões\n- Empresas em crescimento (contratando)\n- Presença digital consolidada (site, redes sociais)\n- Que já usam CRM ou ferramentas de automação"}
                      value={refinamentoEmpresa}
                      onChange={(e) => setRefinamentoEmpresa(e.target.value)}
                      rows={8}
                    />
                  </CardContent>
                </Card>
              )}

              {(tipoProspeccao === 'b2c' || tipoProspeccao === 'ambos') && (
                <Card>
                  <CardHeader>
                    <CardTitle>👤 Refinamento: Perfil Profissional</CardTitle>
                    <CardDescription>
                      Detalhe o perfil dos profissionais (cargo, experiência, renda, etc)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder={"Ex:\n- Cargos de gerência, diretoria ou C-Level\n- Profissionais com mais de 5 anos de experiência\n- Renda mensal acima de R$ 10.000\n- Ativos em LinkedIn/redes profissionais\n- Que trabalham em empresas grandes (100+ funcionários)"}
                      value={refinamentoProfissional}
                      onChange={(e) => setRefinamentoProfissional(e.target.value)}
                      rows={8}
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>🎯 Refinamento: Comportamento/Interesse</CardTitle>
                  <CardDescription>
                    Defina comportamentos, interesses ou características específicas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={"Ex:\n- Ativos em redes sociais (LinkedIn, Instagram)\n- Frequentam eventos do setor\n- Leem blogs/newsletters especializados\n- Já demonstraram interesse em produtos similares\n- Fazem parte de associações profissionais"}
                    value={refinamentoComportamental}
                    onChange={(e) => setRefinamentoComportamental(e.target.value)}
                    rows={7}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: GEOGRÁFICO */}
            <TabsContent value="geografico" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Estados</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setEstadosSelecionados(ESTADOS_BRASIL)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Selecionar Todos
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {ESTADOS_BRASIL.map(estado => (
                      <Badge
                        key={estado}
                        variant={estadosSelecionados.includes(estado) ? 'default' : 'outline'}
                        className="cursor-pointer hover:scale-105 transition-all text-sm py-1.5 px-3"
                        onClick={() => setEstadosSelecionados(prev =>
                          prev.includes(estado) ? prev.filter(e => e !== estado) : [...prev, estado]
                        )}
                      >
                        {estado}
                        {estadosSelecionados.includes(estado) && (
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {estadosSelecionados.length === 0 ? 'Nenhum estado = Brasil todo' : `✅ ${estadosSelecionados.length} estado(s)`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>🎯 Refinamento Geográfico</CardTitle>
                  <CardDescription>
                    Cidades específicas, bairros, regiões, proximidade, etc
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={"Ex:\n- Capitais e regiões metropolitanas\n- Bairros nobres: Leblon, Ipanema, Jardins, Moema\n- Proximidade de shoppings de alto padrão\n- Cidades com mais de 500 mil habitantes"}
                    value={refinamentoGeografico}
                    onChange={(e) => setRefinamentoGeografico(e.target.value)}
                    rows={6}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: IA SUGESTÕES */}
            <TabsContent value="ia" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    Sugestões Inteligentes da IA
                  </CardTitle>
                  <CardDescription>
                    A IA analisa seu ICP e sugere refinamentos para aumentar conversão
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={gerarSugestoesIA}
                    disabled={loadingIA || totalSelecionado === 0}
                    className="w-full"
                    size="lg"
                  >
                    {loadingIA ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analisando seu ICP...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Gerar Sugestões com IA
                      </>
                    )}
                  </Button>

                  {sugestoesIA.length > 0 && (
                    <div className="space-y-3 mt-6">
                      <Label>Clique para aplicar:</Label>
                      {sugestoesIA.map((sugestao, idx) => (
                        <div
                          key={idx}
                          className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => aplicarSugestao(sugestao)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary">{sugestao.categoria}</Badge>
                              </div>
                              <p className="font-medium mb-1">{sugestao.sugestao}</p>
                              <p className="text-sm text-muted-foreground">{sugestao.motivo}</p>
                            </div>
                            <Plus className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {totalSelecionado === 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Selecione setores ou profissões primeiro para gerar sugestões inteligentes
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* COLUNA LATERAL - RESUMO (1/4) */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Resumo do ICP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {nomeICP && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <p className="font-medium text-sm">{nomeICP}</p>
                  </div>
                  <Separator />
                </>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Badge variant="default" className="mt-1">
                  {tipoProspeccao === 'b2b' ? '🏢 B2B' : tipoProspeccao === 'b2c' ? '👤 B2C' : '🎯 B2B + B2C'}
                </Badge>
              </div>

              {setoresSelecionados.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Setores ({setoresSelecionados.length})
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {setoresSelecionados.slice(0, 4).map(setor => (
                        <Badge key={setor} variant="secondary" className="text-xs">
                          {setor}
                        </Badge>
                      ))}
                      {setoresSelecionados.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{setoresSelecionados.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}

              {(profissoesSelecionadas.length > 0 || profissoesCustomizadas.length > 0) && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Profissões ({profissoesSelecionadas.length + profissoesCustomizadas.length})
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {profissoesSelecionadas.slice(0, 3).map(value => {
                        const prof = PROFISSOES_DISPONIVEIS.find(p => p.value === value)
                        return prof ? (
                          <Badge key={value} variant="secondary" className="text-xs">
                            {prof.icon} {prof.label}
                          </Badge>
                        ) : null
                      })}
                      {(profissoesSelecionadas.length + profissoesCustomizadas.length) > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(profissoesSelecionadas.length + profissoesCustomizadas.length) - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}

              {estadosSelecionados.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Estados ({estadosSelecionados.length})
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {estadosSelecionados.slice(0, 6).map(estado => (
                        <Badge key={estado} variant="outline" className="text-xs">
                          {estado}
                        </Badge>
                      ))}
                      {estadosSelecionados.length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{estadosSelecionados.length - 6}
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}

              {(refinamentoEmpresa || refinamentoProfissional || refinamentoGeografico || refinamentoComportamental) && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Refinamentos Aplicados
                    </Label>
                    <div className="space-y-1">
                      {refinamentoEmpresa && <Badge variant="secondary" className="text-xs">🏢 Empresa</Badge>}
                      {refinamentoProfissional && <Badge variant="secondary" className="text-xs">👤 Profissional</Badge>}
                      {refinamentoGeografico && <Badge variant="secondary" className="text-xs">📍 Geográfico</Badge>}
                      {refinamentoComportamental && <Badge variant="secondary" className="text-xs">🎯 Comportamento</Badge>}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <Button 
                onClick={salvarICP} 
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Salvar ICP
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Após salvar, você poderá criar campanhas baseadas neste ICP
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
