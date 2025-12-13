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
import { ESTADOS_BRASIL } from '@/constants/estados'
import { 
  Building2, 
  Users, 
  MapPin, 
  Search,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Filter,
  Zap,
  Target
} from 'lucide-react'

// ===================================================================
// DADOS DISPONÍVEIS
// ===================================================================

const PROFISSOES_DISPONIVEIS = [
  // ===================================================================
  // FORMAÇÕES SUPERIORES
  // ===================================================================
  
  // Saúde - Superior
  { value: 'medico', label: 'Médico', categoria: 'Saúde Superior', icon: '🏥' },
  { value: 'enfermeiro', label: 'Enfermeiro', categoria: 'Saúde Superior', icon: '⚕️' },
  { value: 'psicologo', label: 'Psicólogo', categoria: 'Saúde Superior', icon: '🧠' },
  { value: 'farmaceutico', label: 'Farmacêutico', categoria: 'Saúde Superior', icon: '💊' },
  { value: 'fisioterapeuta', label: 'Fisioterapeuta', categoria: 'Saúde Superior', icon: '💪' },
  { value: 'nutricionista', label: 'Nutricionista', categoria: 'Saúde Superior', icon: '🥗' },
  { value: 'biomedico', label: 'Biomédico', categoria: 'Saúde Superior', icon: '🔬' },
  { value: 'dentista', label: 'Dentista', categoria: 'Saúde Superior', icon: '🦷' },
  { value: 'veterinario', label: 'Veterinário', categoria: 'Saúde Superior', icon: '🐾' },
  
  // Jurídico
  { value: 'advogado', label: 'Advogado', categoria: 'Jurídico', icon: '⚖️' },
  
  // Ciências Exatas
  { value: 'economista', label: 'Economista', categoria: 'Ciências Exatas', icon: '📈' },
  { value: 'matematico', label: 'Matemático', categoria: 'Ciências Exatas', icon: '🔢' },
  { value: 'estatistico', label: 'Estatístico', categoria: 'Ciências Exatas', icon: '📊' },
  { value: 'fisico', label: 'Físico', categoria: 'Ciências Exatas', icon: '⚛️' },
  { value: 'quimico', label: 'Químico', categoria: 'Ciências Exatas', icon: '🧪' },
  { value: 'biologo', label: 'Biólogo', categoria: 'Ciências Exatas', icon: '🧬' },
  
  // Engenharia
  { value: 'engenheiro_civil', label: 'Engenheiro Civil', categoria: 'Engenharia', icon: '🏗️' },
  { value: 'engenheiro_computacao', label: 'Engenheiro da Computação', categoria: 'Engenharia', icon: '💻' },
  { value: 'engenheiro_producao', label: 'Engenheiro de Produção', categoria: 'Engenharia', icon: '⚙️' },
  { value: 'arquiteto', label: 'Arquiteto', categoria: 'Engenharia', icon: '📐' },
  
  // Negócios & Administração
  { value: 'contador', label: 'Contador', categoria: 'Negócios', icon: '🧾' },
  { value: 'administrador', label: 'Administrador', categoria: 'Negócios', icon: '💼' },
  { value: 'ceo', label: 'CEO/Diretor/Gerente', categoria: 'Negócios', icon: '👔' },
  { value: 'gestao_negocios', label: 'Gestão de Negócios', categoria: 'Negócios', icon: '📊' },
  { value: 'gestao_estrategica', label: 'Gestão Estratégica', categoria: 'Negócios', icon: '🎯' },
  { value: 'marketing', label: 'Marketing (CMO)', categoria: 'Negócios', icon: '📢' },
  { value: 'recursos_humanos', label: 'Recursos Humanos', categoria: 'Negócios', icon: '👥' },
  { value: 'financas', label: 'Finanças (CFO)', categoria: 'Negócios', icon: '💰' },
  { value: 'comercio_exterior', label: 'Comércio Exterior', categoria: 'Negócios', icon: '🌍' },
  { value: 'analista_ti', label: 'Sistemas de Informação', categoria: 'Negócios', icon: '🖥️' },
  { value: 'comunicacao_social', label: 'Comunicação Social', categoria: 'Negócios', icon: '📰' },
  { value: 'relacoes_internacionais', label: 'Relações Internacionais', categoria: 'Negócios', icon: '🌐' },
  
  // Educação
  { value: 'pedagogo', label: 'Pedagogo', categoria: 'Educação', icon: '📚' },
  { value: 'professor', label: 'Professor (Licenciaturas)', categoria: 'Educação', icon: '👨‍🏫' },
  { value: 'educacao_fisica', label: 'Educação Física', categoria: 'Educação', icon: '⚽' },
  
  // Comunicação & Design
  { value: 'jornalista', label: 'Jornalista', categoria: 'Comunicação', icon: '📰' },
  { value: 'publicitario', label: 'Publicitário', categoria: 'Comunicação', icon: '📢' },
  { value: 'relacoes_publicas', label: 'Relações Públicas', categoria: 'Comunicação', icon: '🤝' },
  { value: 'design_grafico', label: 'Design Gráfico', categoria: 'Comunicação', icon: '🎨' },
  { value: 'design_interiores', label: 'Design de Interiores', categoria: 'Comunicação', icon: '🏠' },
  { value: 'design_moda', label: 'Design de Moda', categoria: 'Comunicação', icon: '👗' },
  
  // Ciências Humanas
  { value: 'bibliotecario', label: 'Bibliotecário', categoria: 'Humanas', icon: '📖' },
  { value: 'historiador', label: 'Historiador', categoria: 'Humanas', icon: '📜' },
  { value: 'geografo', label: 'Geógrafo', categoria: 'Humanas', icon: '🗺️' },
  { value: 'filosofo', label: 'Filósofo', categoria: 'Humanas', icon: '🤔' },
  { value: 'sociologo', label: 'Sociólogo', categoria: 'Humanas', icon: '👥' },
  
  // Artes
  { value: 'cinema_audiovisual', label: 'Cinema e Audiovisual', categoria: 'Artes', icon: '🎬' },
  { value: 'musico', label: 'Músico', categoria: 'Artes', icon: '🎵' },
  { value: 'artes_visuais', label: 'Artes Visuais', categoria: 'Artes', icon: '🎨' },
  { value: 'teatro', label: 'Teatro', categoria: 'Artes', icon: '🎭' },
  { value: 'danca', label: 'Dança', categoria: 'Artes', icon: '💃' },
  
  // Tecnólogos
  { value: 'tec_analise_sistemas', label: 'Tecnólogo em Análise de Sistemas', categoria: 'Tecnólogos', icon: '💻' },
  { value: 'tec_banco_dados', label: 'Tecnólogo em Banco de Dados', categoria: 'Tecnólogos', icon: '🗄️' },
  { value: 'tec_automacao', label: 'Tecnólogo em Automação Industrial', categoria: 'Tecnólogos', icon: '🤖' },
  { value: 'tec_logistica', label: 'Tecnólogo em Logística', categoria: 'Tecnólogos', icon: '📦' },
  { value: 'tec_gestao_ti', label: 'Tecnólogo em Gestão de TI', categoria: 'Tecnólogos', icon: '🖥️' },
  { value: 'tec_marketing', label: 'Tecnólogo em Marketing', categoria: 'Tecnólogos', icon: '📊' },
  { value: 'tec_processos_gerenciais', label: 'Tecnólogo em Processos Gerenciais', categoria: 'Tecnólogos', icon: '📋' },
  { value: 'tec_comercio_exterior', label: 'Tecnólogo em Comércio Exterior', categoria: 'Tecnólogos', icon: '🌍' },
  { value: 'tec_eventos', label: 'Tecnólogo em Eventos', categoria: 'Tecnólogos', icon: '🎉' },
  { value: 'tec_rh', label: 'Tecnólogo em Gestão de RH', categoria: 'Tecnólogos', icon: '👥' },
  { value: 'tec_financeira', label: 'Tecnólogo em Gestão Financeira', categoria: 'Tecnólogos', icon: '💰' },
  { value: 'tec_gestao_publica', label: 'Tecnólogo em Gestão Pública', categoria: 'Tecnólogos', icon: '🏛️' },
  { value: 'tec_producao_industrial', label: 'Tecnólogo em Produção Industrial', categoria: 'Tecnólogos', icon: '🏭' },
  { value: 'tec_redes', label: 'Tecnólogo em Redes de Computadores', categoria: 'Tecnólogos', icon: '🌐' },
  { value: 'tec_seguranca_info', label: 'Tecnólogo em Segurança da Informação', categoria: 'Tecnólogos', icon: '🔒' },
  { value: 'tec_turismo', label: 'Tecnólogo em Turismo', categoria: 'Tecnólogos', icon: '✈️' },
  { value: 'tec_hotelaria', label: 'Tecnólogo em Hotelaria', categoria: 'Tecnólogos', icon: '🏨' },
  { value: 'tec_jogos_digitais', label: 'Tecnólogo em Jogos Digitais', categoria: 'Tecnólogos', icon: '🎮' },
  { value: 'tec_estetica', label: 'Tecnólogo em Estética e Cosmética', categoria: 'Tecnólogos', icon: '💅' },
  { value: 'tec_radiologia', label: 'Tecnólogo em Radiologia', categoria: 'Tecnólogos', icon: '📡' },
  { value: 'tec_seguranca_trabalho', label: 'Tecnólogo em Segurança do Trabalho', categoria: 'Tecnólogos', icon: '🦺' },
  { value: 'tec_alimentos', label: 'Tecnólogo em Alimentos', categoria: 'Tecnólogos', icon: '🍽️' },
  
  // ===================================================================
  // FORMAÇÕES TÉCNICAS
  // ===================================================================
  
  // Técnicos - Administração & Negócios
  { value: 'tec_administracao', label: 'Técnico em Administração', categoria: 'Técnico Negócios', icon: '📋' },
  { value: 'tec_contabilidade', label: 'Técnico em Contabilidade', categoria: 'Técnico Negócios', icon: '🧾' },
  { value: 'tec_comercio', label: 'Técnico em Comércio', categoria: 'Técnico Negócios', icon: '🛒' },
  { value: 'tec_logistica_tec', label: 'Técnico em Logística', categoria: 'Técnico Negócios', icon: '📦' },
  { value: 'tec_transportes', label: 'Técnico em Transportes', categoria: 'Técnico Negócios', icon: '🚚' },
  { value: 'tec_corretagem', label: 'Técnico em Corretagem de Seguros', categoria: 'Técnico Negócios', icon: '📄' },
  { value: 'tec_condominios', label: 'Técnico em Gestão de Condomínios', categoria: 'Técnico Negócios', icon: '🏢' },
  
  // Técnicos - Saúde
  { value: 'tec_enfermagem', label: 'Técnico em Enfermagem', categoria: 'Técnico Saúde', icon: '⚕️' },
  { value: 'tec_higiene_dental', label: 'Técnico em Higiene Dental', categoria: 'Técnico Saúde', icon: '🦷' },
  { value: 'tec_farmacia', label: 'Técnico em Farmácia', categoria: 'Técnico Saúde', icon: '💊' },
  { value: 'tec_laboratorio', label: 'Técnico em Laboratório', categoria: 'Técnico Saúde', icon: '🔬' },
  { value: 'tec_radiologia_tec', label: 'Técnico em Radiologia', categoria: 'Técnico Saúde', icon: '📡' },
  { value: 'tec_estetica_tec', label: 'Técnico em Estética', categoria: 'Técnico Saúde', icon: '💅' },
  { value: 'tec_veterinaria', label: 'Técnico em Veterinária', categoria: 'Técnico Saúde', icon: '🐾' },
  
  // Técnicos - Tecnologia
  { value: 'tec_informatica', label: 'Técnico em Informática', categoria: 'Técnico TI', icon: '💻' },
  { value: 'tec_redes_tec', label: 'Técnico em Redes de Computadores', categoria: 'Técnico TI', icon: '🌐' },
  { value: 'tec_informatica_internet', label: 'Técnico em Informática para Internet', categoria: 'Técnico TI', icon: '🌍' },
  { value: 'tec_analise_sistemas_tec', label: 'Técnico em Análise de Sistemas', categoria: 'Técnico TI', icon: '🖥️' },
  { value: 'tec_telecomunicacoes', label: 'Técnico em Telecomunicações', categoria: 'Técnico TI', icon: '📞' },
  
  // Técnicos - Engenharia & Indústria
  { value: 'tec_mecanica', label: 'Técnico em Mecânica', categoria: 'Técnico Engenharia', icon: '⚙️' },
  { value: 'tec_mecatronica', label: 'Técnico em Mecatrônica', categoria: 'Técnico Engenharia', icon: '🤖' },
  { value: 'tec_eletronica', label: 'Técnico em Eletrônica', categoria: 'Técnico Engenharia', icon: '🔌' },
  { value: 'tec_eletrotecnica', label: 'Técnico em Eletrotécnica', categoria: 'Técnico Engenharia', icon: '⚡' },
  { value: 'tec_eletricidade', label: 'Técnico em Eletricidade', categoria: 'Técnico Engenharia', icon: '💡' },
  { value: 'tec_eletroeletronica', label: 'Técnico em Eletroeletrônica', categoria: 'Técnico Engenharia', icon: '🔋' },
  { value: 'tec_automacao_tec', label: 'Técnico em Automação', categoria: 'Técnico Engenharia', icon: '🤖' },
  { value: 'tec_automacao_industrial', label: 'Técnico em Automação Industrial', categoria: 'Técnico Engenharia', icon: '🏭' },
  { value: 'tec_eletro mecanica', label: 'Técnico em Eletromecânica', categoria: 'Técnico Engenharia', icon: '⚙️' },
  { value: 'tec_refrigeracao', label: 'Técnico em Refrigeração', categoria: 'Técnico Engenharia', icon: '❄️' },
  { value: 'tec_maquinas', label: 'Técnico em Máquinas Ferramentas', categoria: 'Técnico Engenharia', icon: '🔧' },
  { value: 'tec_manutencao', label: 'Técnico em Manutenção Industrial', categoria: 'Técnico Engenharia', icon: '🛠️' },
  { value: 'tec_instalacoes', label: 'Técnico em Instalações Elétricas', categoria: 'Técnico Engenharia', icon: '💡' },
  
  // Técnicos - Construção
  { value: 'tec_edificacoes', label: 'Técnico em Edificações', categoria: 'Técnico Construção', icon: '🏗️' },
  { value: 'tec_construcao_civil', label: 'Técnico em Construção Civil', categoria: 'Técnico Construção', icon: '🏢' },
  { value: 'tec_desenho_arquitetonico', label: 'Técnico em Desenho Arquitetônico', categoria: 'Técnico Construção', icon: '📐' },
  { value: 'tec_agrimensura', label: 'Técnico em Agrimensura', categoria: 'Técnico Construção', icon: '📏' },
  
  // Técnicos - Indústria & Produção
  { value: 'tec_quimica', label: 'Técnico em Química', categoria: 'Técnico Indústria', icon: '🧪' },
  { value: 'tec_alimentos_tec', label: 'Técnico em Alimentos', categoria: 'Técnico Indústria', icon: '🍽️' },
  { value: 'tec_plasticos', label: 'Técnico em Plásticos', categoria: 'Técnico Indústria', icon: '♻️' },
  { value: 'tec_petroleo', label: 'Técnico em Petróleo e Gás', categoria: 'Técnico Indústria', icon: '⛽' },
  { value: 'tec_mineracao', label: 'Técnico em Mineração', categoria: 'Técnico Indústria', icon: '⛏️' },
  { value: 'tec_saneamento', label: 'Técnico em Saneamento', categoria: 'Técnico Indústria', icon: '💧' },
  { value: 'tec_seguranca_trabalho_tec', label: 'Técnico em Segurança do Trabalho', categoria: 'Técnico Indústria', icon: '🦺' },
  
  // Técnicos - Agropecuária
  { value: 'tec_agropecuaria', label: 'Técnico em Agropecuária', categoria: 'Técnico Agro', icon: '🌾' },
  { value: 'tec_agroindustria', label: 'Técnico em Agroindústria', categoria: 'Técnico Agro', icon: '🏭' },
  { value: 'tec_florestas', label: 'Técnico em Florestas', categoria: 'Técnico Agro', icon: '🌲' },
  { value: 'tec_zootecnia', label: 'Técnico em Zootecnia', categoria: 'Técnico Agro', icon: '🐄' },
  
  // Técnicos - Design & Artes
  { value: 'tec_design_interiores_tec', label: 'Técnico em Design de Interiores', categoria: 'Técnico Design', icon: '🏠' },
  { value: 'tec_design_moda_tec', label: 'Técnico em Design de Moda', categoria: 'Técnico Design', icon: '👗' },
  { value: 'tec_design_grafico_tec', label: 'Técnico em Design Gráfico', categoria: 'Técnico Design', icon: '🎨' },
  { value: 'tec_audiovisual', label: 'Técnico em Audiovisual', categoria: 'Técnico Design', icon: '🎬' },
  { value: 'tec_carpintaria', label: 'Técnico em Carpintaria', categoria: 'Técnico Design', icon: '🪵' },
  { value: 'tec_marcenaria', label: 'Técnico em Marcenaria', categoria: 'Técnico Design', icon: '🔨' },
  
  // Técnicos - Serviços
  { value: 'tec_turismo_tec', label: 'Técnico em Turismo', categoria: 'Técnico Serviços', icon: '✈️' },
  { value: 'tec_hotelaria_tec', label: 'Técnico em Hotelaria', categoria: 'Técnico Serviços', icon: '🏨' },
  { value: 'tec_paisagismo', label: 'Técnico em Paisagismo', categoria: 'Técnico Serviços', icon: '🌳' },
  { value: 'tec_jardinagem', label: 'Técnico em Jardinagem', categoria: 'Técnico Serviços', icon: '🌺' },
  { value: 'tec_motoboy', label: 'Técnico em Logística de Entrega', categoria: 'Técnico Serviços', icon: '🏍️' },
  { value: 'tec_motorista', label: 'Motorista de Aplicativo', categoria: 'Técnico Serviços', icon: '🚗' },
]

const SETORES_B2B = [
  // Varejo Especializado
  'Loja Presenteira', 'Loja Casa e Decoração', 'Loja Utilidades Domésticas',
  'Loja de Presentes', 'Papelaria', 'Bazar', 'Armarinho', 'Loja de Variedades',
  // Distribuição e Atacado
  'Distribuidora', 'Atacadista', 'Representante Comercial', 'Importadora',
  'Exportadora', 'Trading', 'Centro de Distribuição',
  // Alimentação
  'Supermercado', 'Mercado', 'Mercearia', 'Empório', 'Loja de Conveniência',
  'Distribuidora de Alimentos', 'Frigorífico', 'Loja de Produtos Naturais',
  // Tradicional
  'Tecnologia', 'Saúde', 'Educação', 'Financeiro', 'Varejo', 
  'Indústria', 'Construção', 'Alimentação', 'Transporte', 
  'Logística', 'Agricultura', 'Energia', 'Telecom', 'Mídia',
  'Turismo', 'Imobiliário', 'Seguros', 'Consultoria', 'Automotivo',
  // Outros
  'Pet Shop', 'Farmácia', 'Drogaria', 'Material de Construção',
  'Loja de Roupas', 'Loja de Calçados', 'Ótica', 'Joalheria',
  'Floricultura', 'Livraria', 'Loja de Brinquedos', 'Loja de Esportes'
]

// ESTADOS_BRASIL importado de @/constants/estados

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
  const [cidadeSelecionada, setCidadeSelecionada] = useState('')
  const [bairrosSelecionados, setBairrosSelecionados] = useState('')
  
  // ⭐ REFINAMENTOS (campo livre)
  const [refinamentoEmpresa, setRefinamentoEmpresa] = useState('')
  const [refinamentoProfissional, setRefinamentoProfissional] = useState('')
  const [refinamentoGeografico, setRefinamentoGeografico] = useState('')
  const [refinamentoComportamental, setRefinamentoComportamental] = useState('')


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

      // Processar cidades (pode ser múltiplas separadas por vírgula)
      const cidadesArray = cidadeSelecionada
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      const configB2B = (tipoProspeccao === 'b2b' || tipoProspeccao === 'ambos') ? {
        setores: setoresSelecionados,
        refinamentos: refinamentoEmpresa,
        cidade: cidadeSelecionada,
        cidades: cidadesArray,
        estados: estadosSelecionados, // ADICIONADO: Estados selecionados
        bairros: bairrosSelecionados
      } : null

      const configB2C = (tipoProspeccao === 'b2c' || tipoProspeccao === 'ambos') ? {
        profissoes: profissoesSelecionadas,
        profissoes_customizadas: profissoesCustomizadas,
        refinamentos: refinamentoProfissional,
        cidade: cidadeSelecionada,
        cidades: cidadesArray,
        estados: estadosSelecionados, // ADICIONADO: Estados selecionados
        bairros: bairrosSelecionados
      } : null

      // 1. Salvar ICP
      const { data: icpData, error: icpError } = await supabase.from('icp_configs').insert({
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
      }).select().single()

      if (icpError) throw icpError

      // 2. Criar campanha de prospecção automaticamente vinculada ao ICP
      // Mapear tipo para valores aceitos pela constraint (b2b ou b2c)
      const tipoCampanha = tipoProspeccao === 'b2b' ? 'b2b' : 'b2c'
      
      const { error: campanhaError } = await supabase.from('campanhas_prospeccao').insert({
        user_id: user.id,
        nome: `Campanha: ${nomeICP}`,
        descricao: descricao || `Campanha de prospecção baseada no ICP "${nomeICP}"`,
        tipo: tipoCampanha,
        icp_config_id: icpData.id,
        status: 'ativa',
        automatica: false,
        meta_leads_total: 100,
        meta_leads_qualificados: 30,
        stats: {
          descobertos: 0,
          enriquecidos: 0,
          qualificados: 0,
          enviados: 0,
          responderam: 0,
          convertidos: 0
        }
      })

      if (campanhaError) throw campanhaError

      toast({
        title: "✅ ICP e Campanha criados!",
        description: "Campanha pronta para buscar leads"
      })

      setTimeout(() => navigate('/campanhas-prospeccao'), 1500)

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
      <Button
        onClick={() => navigate('/dashboard')}
        variant="ghost"
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar ao Dashboard
      </Button>
      
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
            <TabsList className="grid w-full grid-cols-3">
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
                    <Button size="sm" variant="outline" onClick={() => setEstadosSelecionados(ESTADOS_BRASIL.map(e => e.sigla))}>
                      <Plus className="h-3 w-3 mr-1" />
                      Selecionar Todos (27 Estados)
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {ESTADOS_BRASIL.map(uf => (
                      <Badge
                        key={uf.sigla}
                        variant={estadosSelecionados.includes(uf.sigla) ? 'default' : 'outline'}
                        className="cursor-pointer hover:scale-105 transition-all text-sm py-1.5 px-3"
                        onClick={() => setEstadosSelecionados(prev =>
                          prev.includes(uf.sigla) ? prev.filter(e => e !== uf.sigla) : [...prev, uf.sigla]
                        )}
                        title={uf.nome}
                      >
                        {uf.sigla} - {uf.nome}
                        {estadosSelecionados.includes(uf.sigla) && (
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {estadosSelecionados.length === 0 ? 'Nenhum estado = Brasil todo 🇧🇷' : `✅ ${estadosSelecionados.length} estado(s) selecionado(s)`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>🏙️ Cidades (Múltiplas)</CardTitle>
                  <CardDescription>
                    Digite as cidades separadas por vírgula. Busca em qualquer cidade do Brasil!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="Ex: São Paulo, Campinas, Ribeirão Preto, Santos"
                    value={cidadeSelecionada}
                    onChange={(e) => setCidadeSelecionada(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Pode informar várias cidades: "São Paulo, Curitiba, Belo Horizonte, Porto Alegre"
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>📍 Bairros Específicos</CardTitle>
                  <CardDescription>
                    Separe os bairros por vírgula. Deixe vazio para buscar em toda a cidade.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="Ex: Barra da Tijuca, Jacarepaguá, Recreio dos Bandeirantes, Copacabana"
                    value={bairrosSelecionados}
                    onChange={(e) => setBairrosSelecionados(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Se informar bairros, a busca será mais específica e precisa
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>🎯 Refinamento Geográfico Adicional</CardTitle>
                  <CardDescription>
                    Outras especificações de região, proximidade, etc
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={"Ex:\n- Capitais e regiões metropolitanas\n- Proximidade de shoppings de alto padrão\n- Cidades com mais de 500 mil habitantes"}
                    value={refinamentoGeografico}
                    onChange={(e) => setRefinamentoGeografico(e.target.value)}
                    rows={4}
                  />
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
