import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, Star, ExternalLink, Package, Tag, Zap, ShoppingCart } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Product {
  id: string;
  title: string;
  image: string;
  price: number;
  originalPrice?: number;
  commission: number;
  category: string;
  rating: number;
  sales: number;
  affiliateLink: string;
  badge?: string;
  description: string;
}

const mockProducts: Product[] = [
  {
    id: '1',
    brand: 'TechBrand',
    logo: '🎧',
    campaign: 'Headphones Premium 2025',
    commission: 15,
    type: 'Físico',
    category: '📱 Eletrônicos',
    description: 'Promova os melhores headphones do mercado com design premium e som de alta qualidade.',
    requirements: {
      followers: '5k+',
      approval: 'Automática'
    },
    badge: 'Alta Demanda',
    products: ['Headphone Pro X1', 'Headphone Wireless Z2', 'Earbuds Premium'],
    materials: ['Banners HD', 'Vídeos promocionais', 'Copy pronta', 'Stories templates'],
    terms: 'Comissão paga em até 30 dias. Cookie de 60 dias. Proibido spam.'
  },
  {
    id: '2',
    brand: 'BeautyLux',
    logo: '💄',
    campaign: 'Kit de Maquiagem Profissional',
    commission: 20,
    type: 'Físico',
    category: '💄 Beleza',
    description: 'Linha completa de cosméticos premium para maquiagem profissional.',
    requirements: {
      followers: '10k+',
      approval: 'Manual'
    },
    badge: 'Exclusivo',
    products: ['Kit Base + Corretivo', 'Paleta de Sombras 20 cores', 'Kit de Pincéis'],
    materials: ['Fotos profissionais', 'Reels editados', 'Textos persuasivos'],
    terms: 'Aprovação em até 48h. Comissão de 20% sobre vendas. Cookie de 45 dias.'
  },
  {
    id: '3',
    brand: 'FitLife',
    logo: '💪',
    campaign: 'Suplementos Fitness',
    commission: 25,
    type: 'Físico',
    category: '💊 Saúde e Suplementos',
    description: 'Suplementos de alta qualidade para ganho de massa e performance.',
    requirements: {
      followers: '3k+',
      approval: 'Automática'
    },
    badge: 'Alta Demanda',
    products: ['Whey Protein 900g', 'Creatina 300g', 'BCAA + Glutamina'],
    materials: ['Guia de uso', 'Depoimentos reais', 'Estudos científicos', 'Posts prontos'],
    terms: 'Comissão recorrente. Cookie de 90 dias. Suporte dedicado.'
  },
  {
    id: '4',
    brand: 'EduMaster',
    logo: '📚',
    campaign: 'Cursos Online Premium',
    commission: 30,
    type: 'Digital',
    category: '📖 Educação',
    description: 'Cursos completos de programação, design e marketing digital.',
    requirements: {
      followers: '2k+',
      approval: 'Automática'
    },
    products: ['Curso Python Completo', 'Design UX/UI', 'Marketing Digital'],
    materials: ['Webinars gravados', 'E-books gratuitos', 'Cupons de desconto'],
    terms: 'Comissão vitalícia. 30% sobre todas as vendas. Suporte 24/7.'
  },
  {
    id: '5',
    brand: 'HomeSmart',
    logo: '🏠',
    campaign: 'Decoração Inteligente',
    commission: 18,
    type: 'Físico',
    category: '🏠 Casa e Cozinha',
    description: 'Produtos de decoração com tecnologia smart home integrada.',
    requirements: {
      followers: '8k+',
      approval: 'Manual'
    },
    badge: 'Exclusivo',
    products: ['Lâmpadas Smart RGB', 'Tomadas WiFi', 'Câmeras de Segurança'],
    materials: ['Vídeos de instalação', 'Comparativos', 'Reviews técnicos'],
    terms: 'Aprovação em 24h. Comissão de 18%. Frete grátis para afiliados.'
  },
  {
    id: '6',
    brand: 'PetCare',
    logo: '🐶',
    campaign: 'Produtos Pet Premium',
    commission: 22,
    type: 'Físico',
    category: '🐶 Pet Shop',
    description: 'Linha premium de alimentos e acessórios para pets.',
    requirements: {
      followers: '5k+',
      approval: 'Automática'
    },
    badge: 'Alta Demanda',
    products: ['Ração Super Premium', 'Brinquedos Interativos', 'Camas Ortopédicas'],
    materials: ['Fotos profissionais', 'Vídeos com pets', 'Guias de cuidados'],
    terms: 'Comissão de 22%. Cookie de 60 dias. Brindes para afiliados top.'
  }
];

const mockApplications: Application[] = [
  {
    id: '1',
    offerId: '2',
    brand: 'BeautyLux',
    campaign: 'Kit de Maquiagem Profissional',
    status: 'Pendente',
    date: '2025-01-15'
  },
  {
    id: '2',
    offerId: '5',
    brand: 'HomeSmart',
    campaign: 'Decoração Inteligente',
    status: 'Aprovado',
    date: '2025-01-10'
  },
  {
    id: '3',
    offerId: '1',
    brand: 'TechBrand',
    campaign: 'Headphones Premium 2025',
    status: 'Aprovado',
    date: '2025-01-08'
  }
];

export default function Marketplace() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false);
  const [applications, setApplications] = useState<Application[]>(mockApplications);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [commissionFilter, setCommissionFilter] = useState('0');
  const [typeFilter, setTypeFilter] = useState('all');
  const [applicationText, setApplicationText] = useState('');

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleCardClick = (offer: Offer) => {
    setSelectedOffer(offer);
    setIsModalOpen(true);
    setApplicationText('');
  };

  const handleSubmitApplication = () => {
    if (!selectedOffer) return;
    
    if (!applicationText.trim()) {
      toast.error('Por favor, descreva por que você é ideal para esta campanha');
      return;
    }

    const newApplication: Application = {
      id: String(applications.length + 1),
      offerId: selectedOffer.id,
      brand: selectedOffer.brand,
      campaign: selectedOffer.campaign,
      status: selectedOffer.requirements.approval === 'Automática' ? 'Aprovado' : 'Pendente',
      date: new Date().toISOString().split('T')[0]
    };

    setApplications([newApplication, ...applications]);
    setIsModalOpen(false);
    
    if (selectedOffer.requirements.approval === 'Automática') {
      toast.success('Candidatura aprovada automaticamente! Comece a promover agora.');
    } else {
      toast.success('Candidatura enviada com sucesso! Aguarde a aprovação da marca.');
    }
  };

  const filteredOffers = mockOffers.filter(offer => {
    const matchesSearch = offer.campaign.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         offer.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || offer.category === categoryFilter;
    const matchesCommission = offer.commission >= parseInt(commissionFilter);
    const matchesType = typeFilter === 'all' || offer.type === typeFilter;
    
    return matchesSearch && matchesCategory && matchesCommission && matchesType;
  });

  const getStatusIcon = (status: Application['status']) => {
    switch (status) {
      case 'Aprovado':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'Pendente':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'Recusado':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'Aprovado':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Pendente':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Recusado':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground">🏪 Catálogo de Produtos</h1>
                <p className="text-muted-foreground mt-1">Conecte-se com marcas e ganhe comissões exclusivas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsImportCSVOpen(true)}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Importar CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para Dashboard
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleDarkMode}
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="ofertas" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="ofertas">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Ofertas Disponíveis
            </TabsTrigger>
            <TabsTrigger value="candidaturas">
              <Users className="w-4 h-4 mr-2" />
              Minhas Candidaturas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ofertas" className="space-y-6">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar campanhas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Categorias</SelectItem>
                      <SelectItem value="📱 Eletrônicos">📱 Eletrônicos</SelectItem>
                      <SelectItem value="💄 Beleza">💄 Beleza</SelectItem>
                      <SelectItem value="💊 Saúde e Suplementos">💊 Saúde e Suplementos</SelectItem>
                      <SelectItem value="📖 Educação">📖 Educação</SelectItem>
                      <SelectItem value="🏠 Casa e Cozinha">🏠 Casa e Cozinha</SelectItem>
                      <SelectItem value="🐶 Pet Shop">🐶 Pet Shop</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={commissionFilter} onValueChange={setCommissionFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Comissão mínima" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Qualquer comissão</SelectItem>
                      <SelectItem value="15">15%+</SelectItem>
                      <SelectItem value="20">20%+</SelectItem>
                      <SelectItem value="25">25%+</SelectItem>
                      <SelectItem value="30">30%+</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Físico e Digital</SelectItem>
                      <SelectItem value="Físico">Físico</SelectItem>
                      <SelectItem value="Digital">Digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Grid de Ofertas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOffers.map((offer) => (
                <Card 
                  key={offer.id} 
                  className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                  onClick={() => handleCardClick(offer)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-5xl">{offer.logo}</div>
                      {offer.badge && (
                        <Badge variant={offer.badge === 'Exclusivo' ? 'default' : 'secondary'} className="font-semibold">
                          {offer.badge}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">{offer.brand}</CardTitle>
                    <CardDescription className="font-medium">{offer.campaign}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <span className="text-sm font-medium">Comissão:</span>
                      <span className="text-2xl font-bold text-green-500">{offer.commission}%</span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">{offer.description}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Categoria:</span>
                        <Badge variant="outline">{offer.category}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tipo:</span>
                        <Badge variant="outline">{offer.type}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Seguidores:</span>
                        <span className="font-medium">{offer.requirements.followers}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Aprovação:</span>
                        <Badge variant={offer.requirements.approval === 'Automática' ? 'default' : 'secondary'}>
                          {offer.requirements.approval}
                        </Badge>
                      </div>
                    </div>
                    
                    <Button className="w-full" size="lg">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Candidatar-se
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredOffers.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground text-lg">Nenhuma oferta encontrada com os filtros selecionados.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="candidaturas" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Minhas Candidaturas</CardTitle>
                <CardDescription>Acompanhe o status das suas candidaturas para campanhas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.map((app) => (
                    <Card key={app.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-lg">{app.brand}</h3>
                              {getStatusIcon(app.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{app.campaign}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Data: {new Date(app.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <Badge className={getStatusColor(app.status)} variant="outline">
                            {app.status}
                          </Badge>
                        </div>
                        {app.status === 'Aprovado' && (
                          <Button className="w-full mt-4" variant="default">
                            Ver Materiais e Links
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  {applications.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Você ainda não se candidatou para nenhuma campanha.</p>
                      <Button className="mt-4" onClick={() => document.querySelector('[value="ofertas"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>
                        Ver Ofertas Disponíveis
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Detalhes */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-4xl">{selectedOffer?.logo}</div>
                <div>
                  <DialogTitle className="text-2xl">{selectedOffer?.brand}</DialogTitle>
                  <DialogDescription className="text-lg">{selectedOffer?.campaign}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            {selectedOffer && (
              <div className="space-y-6">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Comissão por venda:</span>
                    <span className="text-3xl font-bold text-green-500">{selectedOffer.commission}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Sobre a Campanha</h4>
                  <p className="text-muted-foreground">{selectedOffer.description}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Produtos Disponíveis</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedOffer.products.map((product, idx) => (
                      <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                        ✓ {product}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Material de Marketing Incluído</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedOffer.materials.map((material, idx) => (
                      <div key={idx} className="p-3 bg-muted rounded-lg text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {material}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Requisitos</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Seguidores mínimos</p>
                      <p className="font-semibold">{selectedOffer.requirements.followers}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Tipo de aprovação</p>
                      <p className="font-semibold">{selectedOffer.requirements.approval}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">Termos e Condições</h4>
                  <p className="text-sm text-muted-foreground">{selectedOffer.terms}</p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="application">Por que você é ideal para esta campanha?</Label>
                  <Textarea
                    id="application"
                    placeholder="Descreva sua experiência, audiência e como você pretende promover estes produtos..."
                    value={applicationText}
                    onChange={(e) => setApplicationText(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmitApplication}
                >
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Enviar Candidatura
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ImportCSVModal
          isOpen={isImportCSVOpen}
          onClose={() => setIsImportCSVOpen(false)}
          onSuccess={() => {
            toast.success('Produtos importados! Atualize a página para visualizá-los.');
            setIsImportCSVOpen(false);
          }}
        />
      </div>
    </div>
  );
}
