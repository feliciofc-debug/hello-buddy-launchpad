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
import { useToast } from '@/hooks/use-toast'
import { 
  Building2, 
  Users, 
  Briefcase, 
  TrendingUp, 
  MapPin, 
  Search,
  X,
  Plus,
  Loader2,
  Sparkles,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'

// Lista completa de profissões (expansível)
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
  
  // Educação
  { value: 'professor', label: 'Professor', categoria: 'Educação', icon: '👨‍🏫' },
  { value: 'diretor_escola', label: 'Diretor de Escola', categoria: 'Educação', icon: '🎓' },
  { value: 'coordenador', label: 'Coordenador Pedagógico', categoria: 'Educação', icon: '📚' },
  
  // Negócios
  { value: 'empresario', label: 'Empresário', categoria: 'Negócios', icon: '💼' },
  { value: 'gerente', label: 'Gerente', categoria: 'Negócios', icon: '👔' },
  { value: 'diretor', label: 'Diretor', categoria: 'Negócios', icon: '🎯' },
  { value: 'ceo', label: 'CEO/Presidente', categoria: 'Negócios', icon: '👑' },
  { value: 'consultor', label: 'Consultor', categoria: 'Negócios', icon: '📈' },
]

const SETORES_B2B = [
  'Tecnologia', 'Saúde', 'Educação', 'Financeiro', 'Varejo', 
  'Indústria', 'Construção', 'Alimentação', 'Transporte', 
  'Logística', 'Agricultura', 'Energia', 'Telecom', 'Mídia',
  'Turismo', 'Imobiliário', 'Seguros', 'Consultoria'
]

const PORTES_EMPRESA = [
  { value: 'mei', label: 'MEI (1 pessoa)', min: 1, max: 1 },
  { value: 'micro', label: 'Microempresa (2-9 funcionários)', min: 2, max: 9 },
  { value: 'pequena', label: 'Pequena (10-49 funcionários)', min: 10, max: 49 },
  { value: 'media', label: 'Média (50-249 funcionários)', min: 50, max: 249 },
  { value: 'grande', label: 'Grande (250+ funcionários)', min: 250, max: 10000 },
]

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export default function ConfigurarICP() {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  
  // Estado do formulário
  const [nomeICP, setNomeICP] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipoProspeccao, setTipoProspeccao] = useState<'b2b' | 'b2c'>('b2b')
  
  // B2B
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([])
  const [portesSelecionados, setPortesSelecionados] = useState<string[]>([])
  const [faturamentoMin, setFaturamentoMin] = useState('')
  const [faturamentoMax, setFaturamentoMax] = useState('')
  const [funcionariosMin, setFuncionariosMin] = useState('')
  const [funcionariosMax, setFuncionariosMax] = useState('')
  
  // B2C
  const [profissoesSelecionadas, setProfissoesSelecionadas] = useState<string[]>([])
  const [searchProfissao, setSearchProfissao] = useState('')
  const [profissoesCustomizadas, setProfissoesCustomizadas] = useState<string[]>([])
  const [novaProfissao, setNovaProfissao] = useState('')
  
  // Geográfico
  const [estadosSelecionados, setEstadosSelecionados] = useState<string[]>([])
  const [cidadesEspecificas, setCidadesEspecificas] = useState<string[]>([])
  const [novaCidade, setNovaCidade] = useState('')
  
  // Critérios extras
  const [criteriosExtras, setCriteriosExtras] = useState('')
  const [sugestoesIA, setSugestoesIA] = useState<string[]>([])

  const profissoesFiltradas = PROFISSOES_DISPONIVEIS.filter(p => 
    p.label.toLowerCase().includes(searchProfissao.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchProfissao.toLowerCase())
  )

  const toggleProfissao = (value: string) => {
    setProfissoesSelecionadas(prev => 
      prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]
    )
  }

  const toggleSetor = (setor: string) => {
    setSetoresSelecionados(prev =>
      prev.includes(setor) ? prev.filter(s => s !== setor) : [...prev, setor]
    )
  }

  const togglePorte = (porte: string) => {
    setPortesSelecionados(prev =>
      prev.includes(porte) ? prev.filter(p => p !== porte) : [...prev, porte]
    )
  }

  const toggleEstado = (estado: string) => {
    setEstadosSelecionados(prev =>
      prev.includes(estado) ? prev.filter(e => e !== estado) : [...prev, estado]
    )
  }

  const adicionarProfissaoCustomizada = () => {
    if (novaProfissao.trim() && !profissoesCustomizadas.includes(novaProfissao.trim())) {
      setProfissoesCustomizadas(prev => [...prev, novaProfissao.trim()])
      setNovaProfissao('')
      toast({
        title: "✅ Profissão adicionada",
        description: `"${novaProfissao}" foi adicionada aos critérios`
      })
    }
  }

  const adicionarCidade = () => {
    if (novaCidade.trim() && !cidadesEspecificas.includes(novaCidade.trim())) {
      setCidadesEspecificas(prev => [...prev, novaCidade.trim()])
      setNovaCidade('')
    }
  }

  const gerarSugestoesIA = async () => {
    setGenerateLoading(true)
    try {
      // Aqui você pode chamar Claude API para gerar sugestões baseadas no que foi preenchido
      const contexto = `
        Tipo: ${tipoProspeccao}
        ${tipoProspeccao === 'b2b' ? `Setores: ${setoresSelecionados.join(', ')}` : ''}
        ${tipoProspeccao === 'b2c' ? `Profissões: ${profissoesSelecionadas.map(p => PROFISSOES_DISPONIVEIS.find(pr => pr.value === p)?.label).join(', ')}` : ''}
        Descrição: ${descricao}
      `

      // Simulação (substitua por chamada real à API)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const sugestoes = [
        'Profissionais com mais de 5 anos de experiência',
        'Empresas que cresceram mais de 20% no último ano',
        'Profissionais ativos em redes sociais',
        'Empresas com presença digital consolidada',
        'Tomadores de decisão (C-Level)',
      ]
      
      setSugestoesIA(sugestoes)
      
      toast({
        title: "✨ Sugestões geradas!",
        description: "A IA analisou seu ICP e gerou critérios adicionais"
      })
    } catch (error) {
      console.error(error)
    } finally {
      setGenerateLoading(false)
    }
  }

  const adicionarSugestao = (sugestao: string) => {
    setCriteriosExtras(prev => prev ? `${prev}\n- ${sugestao}` : `- ${sugestao}`)
    setSugestoesIA(prev => prev.filter(s => s !== sugestao))
  }

  const salvarICP = async () => {
    if (!nomeICP.trim()) {
      toast({
        title: "❌ Nome obrigatório",
        description: "Informe um nome para o ICP",
        variant: "destructive"
      })
      return
    }

    if (tipoProspeccao === 'b2b' && setoresSelecionados.length === 0) {
      toast({
        title: "❌ Setores obrigatórios",
        description: "Selecione pelo menos um setor para B2B",
        variant: "destructive"
      })
      return
    }

    if (tipoProspeccao === 'b2c' && profissoesSelecionadas.length === 0 && profissoesCustomizadas.length === 0) {
      toast({
        title: "❌ Profissões obrigatórias",
        description: "Selecione ou adicione pelo menos uma profissão para B2C",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const configB2B = tipoProspeccao === 'b2b' ? {
        setores: setoresSelecionados,
        portes: portesSelecionados,
        faturamento_min: faturamentoMin ? parseFloat(faturamentoMin) : null,
        faturamento_max: faturamentoMax ? parseFloat(faturamentoMax) : null,
        funcionarios_min: funcionariosMin ? parseInt(funcionariosMin) : null,
        funcionarios_max: funcionariosMax ? parseInt(funcionariosMax) : null,
      } : null

      const configB2C = tipoProspeccao === 'b2c' ? {
        profissoes: profissoesSelecionadas,
        profissoes_customizadas: profissoesCustomizadas,
      } : null

      const { error } = await supabase.from('icp_configs').insert({
        user_id: user.id,
        nome: nomeICP,
        descricao,
        tipo: tipoProspeccao,
        b2b_config: configB2B,
        b2c_config: configB2C,
        filtros_avancados: {
          estados: estadosSelecionados,
          cidades: cidadesEspecificas,
          criterios_extras: criteriosExtras
        },
        ativo: true
      })

      if (error) throw error

      toast({
        title: "✅ ICP salvo com sucesso!",
        description: "Seu perfil de cliente ideal está pronto para gerar leads"
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

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Configurar Perfil Cliente Ideal (ICP)</h1>
        <p className="text-muted-foreground">
          Defina os critérios detalhados do seu cliente ideal para gerar leads automaticamente com alta precisão
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do ICP *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Médicos RJ 2025"
                  value={nomeICP}
                  onChange={(e) => setNomeICP(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o perfil ideal do seu cliente..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label>Tipo de Prospecção *</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Button
                    type="button"
                    variant={tipoProspeccao === 'b2b' ? 'default' : 'outline'}
                    onClick={() => setTipoProspeccao('b2b')}
                    className="h-auto py-4"
                  >
                    <div className="text-center">
                      <Building2 className="h-6 w-6 mx-auto mb-2" />
                      <div className="font-semibold">B2B (Empresas)</div>
                      <div className="text-xs opacity-70">Venda para empresas</div>
                    </div>
                  </Button>

                  <Button
                    type="button"
                    variant={tipoProspeccao === 'b2c' ? 'default' : 'outline'}
                    onClick={() => setTipoProspeccao('b2c')}
                    className="h-auto py-4"
                  >
                    <div className="text-center">
                      <Users className="h-6 w-6 mx-auto mb-2" />
                      <div className="font-semibold">B2C (Profissionais)</div>
                      <div className="text-xs opacity-70">Venda para pessoas</div>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração B2B */}
          {tipoProspeccao === 'b2b' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Critérios B2B (Empresas)
                </CardTitle>
                <CardDescription>
                  Selecione os setores e portes de empresa que deseja prospectar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Setores */}
                <div>
                  <Label className="mb-3 block">Setores de Atuação *</Label>
                  <div className="flex flex-wrap gap-2">
                    {SETORES_B2B.map(setor => (
                      <Badge
                        key={setor}
                        variant={setoresSelecionados.includes(setor) ? 'default' : 'outline'}
                        className="cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => toggleSetor(setor)}
                      >
                        {setor}
                        {setoresSelecionados.includes(setor) && (
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {setoresSelecionados.length} setor(es) selecionado(s)
                  </p>
                </div>

                <Separator />

                {/* Porte da Empresa */}
                <div>
                  <Label className="mb-3 block">Porte da Empresa</Label>
                  <div className="space-y-2">
                    {PORTES_EMPRESA.map(porte => (
                      <div
                        key={porte.value}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          portesSelecionados.includes(porte.value)
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => togglePorte(porte.value)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{porte.label}</span>
                          {portesSelecionados.includes(porte.value) && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Faturamento */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fat-min">Faturamento Mínimo (R$)</Label>
                    <Input
                      id="fat-min"
                      type="number"
                      placeholder="Ex: 100000"
                      value={faturamentoMin}
                      onChange={(e) => setFaturamentoMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fat-max">Faturamento Máximo (R$)</Label>
                    <Input
                      id="fat-max"
                      type="number"
                      placeholder="Ex: 5000000"
                      value={faturamentoMax}
                      onChange={(e) => setFaturamentoMax(e.target.value)}
                    />
                  </div>
                </div>

                {/* Número de Funcionários */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="func-min">Funcionários Mínimo</Label>
                    <Input
                      id="func-min"
                      type="number"
                      placeholder="Ex: 10"
                      value={funcionariosMin}
                      onChange={(e) => setFuncionariosMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="func-max">Funcionários Máximo</Label>
                    <Input
                      id="func-max"
                      type="number"
                      placeholder="Ex: 500"
                      value={funcionariosMax}
                      onChange={(e) => setFuncionariosMax(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuração B2C */}
          {tipoProspeccao === 'b2c' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Critérios B2C (Profissionais)
                </CardTitle>
                <CardDescription>
                  Selecione as profissões e categorias que deseja prospectar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Busca de Profissões */}
                <div>
                  <Label htmlFor="search-prof">Buscar Profissões</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search-prof"
                      placeholder="Digite para buscar (ex: médico, advogado)..."
                      value={searchProfissao}
                      onChange={(e) => setSearchProfissao(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Lista de Profissões por Categoria */}
                <div className="max-h-96 overflow-y-auto space-y-4 border rounded-lg p-4">
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
                            className="cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => toggleProfissao(prof.value)}
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

                <p className="text-sm text-muted-foreground">
                  ✅ {profissoesSelecionadas.length} profissão(ões) selecionada(s)
                </p>

                <Separator />

                {/* Adicionar Profissão Customizada */}
                <div>
                  <Label htmlFor="nova-prof">Profissão Não Listada? Adicione Aqui</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="nova-prof"
                      placeholder="Ex: Coach Executivo, Personal Trainer..."
                      value={novaProfissao}
                      onChange={(e) => setNovaProfissao(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && adicionarProfissaoCustomizada()}
                    />
                    <Button type="button" onClick={adicionarProfissaoCustomizada}>
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

          {/* Localização Geográfica */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Localização Geográfica
              </CardTitle>
              <CardDescription>
                Defina as regiões onde deseja prospectar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Estados</Label>
                <div className="flex flex-wrap gap-2">
                  {ESTADOS_BRASIL.map(estado => (
                    <Badge
                      key={estado}
                      variant={estadosSelecionados.includes(estado) ? 'default' : 'outline'}
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => toggleEstado(estado)}
                    >
                      {estado}
                      {estadosSelecionados.includes(estado) && (
                        <CheckCircle2 className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {estadosSelecionados.length === 0 ? 'Nenhum estado = Brasil todo' : `${estadosSelecionados.length} estado(s)`}
                </p>
              </div>

              <Separator />

              <div>
                <Label htmlFor="cidade">Cidades Específicas (opcional)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="cidade"
                    placeholder="Ex: São Paulo, Rio de Janeiro..."
                    value={novaCidade}
                    onChange={(e) => setNovaCidade(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && adicionarCidade()}
                  />
                  <Button type="button" onClick={adicionarCidade}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {cidadesEspecificas.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {cidadesEspecificas.map(cidade => (
                      <Badge key={cidade} variant="secondary" className="gap-1">
                        📍 {cidade}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => setCidadesEspecificas(prev => prev.filter(c => c !== cidade))}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Critérios Extras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Critérios Adicionais
              </CardTitle>
              <CardDescription>
                Descreva qualquer outro critério importante que não esteja nas opções acima
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Ex:&#10;- Profissionais com mais de 5 anos de experiência&#10;- Empresas que cresceram mais de 20% no último ano&#10;- Profissionais ativos em redes sociais&#10;- Tomadores de decisão (C-Level)"
                value={criteriosExtras}
                onChange={(e) => setCriteriosExtras(e.target.value)}
                rows={6}
              />

              <Button
                type="button"
                variant="outline"
                onClick={gerarSugestoesIA}
                disabled={generateLoading}
                className="w-full"
              >
                {generateLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando sugestões...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Sugestões com IA
                  </>
                )}
              </Button>

              {sugestoesIA.length > 0 && (
                <div className="space-y-2">
                  <Label>Sugestões da IA:</Label>
                  {sugestoesIA.map((sugestao, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => adicionarSugestao(sugestao)}
                    >
                      <span className="text-sm">{sugestao}</span>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Lateral - Resumo */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Resumo do ICP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {nomeICP && (
                <div>
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <p className="font-medium">{nomeICP}</p>
                </div>
              )}

              <Separator />

              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Badge variant="default" className="mt-1">
                  {tipoProspeccao === 'b2b' ? '🏢 B2B (Empresas)' : '👤 B2C (Profissionais)'}
                </Badge>
              </div>

              {tipoProspeccao === 'b2b' && setoresSelecionados.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Setores ({setoresSelecionados.length})
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {setoresSelecionados.slice(0, 5).map(setor => (
                        <Badge key={setor} variant="secondary" className="text-xs">
                          {setor}
                        </Badge>
                      ))}
                      {setoresSelecionados.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{setoresSelecionados.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}

              {tipoProspeccao === 'b2c' && (profissoesSelecionadas.length > 0 || profissoesCustomizadas.length > 0) && (
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
                      {profissoesCustomizadas.slice(0, 2).map(prof => (
                        <Badge key={prof} variant="secondary" className="text-xs">
                          ✨ {prof}
                        </Badge>
                      ))}
                      {(profissoesSelecionadas.length + profissoesCustomizadas.length) > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(profissoesSelecionadas.length + profissoesCustomizadas.length) - 5}
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
