export const SEGMENTOS_EMPRESA = [
  {
    id: 'alimentos-bebidas',
    nome: '🍴 Alimentos e Bebidas',
    descricao: 'Mercados, distribuidoras, restaurantes',
    tom: 'informal',
    vocabulario: ['fresco', 'saboroso', 'qualidade', 'entrega rápida', 'promoção'],
    estilo_venda: 'Vendedor de mercado: entusiasta, rápido, foco em frescor e disponibilidade'
  },
  {
    id: 'eletronicos-informatica',
    nome: '💻 Eletrônicos e Informática',
    descricao: 'Computadores, celulares, acessórios',
    tom: 'tecnico-acessivel',
    vocabulario: ['processador', 'memória', 'armazenamento', 'bateria', 'garantia', 'especificações'],
    estilo_venda: 'Especialista técnico: conhecedor, detalhista, foca em specs e custo-benefício'
  },
  {
    id: 'produtos-hospitalares',
    nome: '🏥 Produtos Hospitalares e Médicos',
    descricao: 'Equipamentos médicos, materiais hospitalares',
    tom: 'profissional',
    vocabulario: ['certificado', 'aprovado pela Anvisa', 'normas técnicas', 'garantia', 'especificações técnicas'],
    estilo_venda: 'Consultor técnico: formal, preciso, foca em certificações e conformidade'
  },
  {
    id: 'seguranca-automacao',
    nome: '🔒 Segurança e Automação',
    descricao: 'Câmeras, alarmes, automação residencial',
    tom: 'tecnico-consultivo',
    vocabulario: ['resolução', 'armazenamento', 'compatibilidade', 'instalação', 'garantia', 'suporte técnico'],
    estilo_venda: 'Consultor de segurança: técnico mas acessível, foca em proteção e tranquilidade'
  },
  {
    id: 'casa-construcao',
    nome: '🏠 Casa e Construção',
    descricao: 'Materiais de construção, ferramentas, acabamentos',
    tom: 'pratico',
    vocabulario: ['resistente', 'durável', 'rendimento', 'aplicação', 'acabamento'],
    estilo_venda: 'Vendedor de loja de construção: prático, direto, foca em qualidade e durabilidade'
  },
  {
    id: 'moda-vestuario',
    nome: '👔 Moda e Vestuário',
    descricao: 'Roupas, calçados, acessórios',
    tom: 'fashion',
    vocabulario: ['tendência', 'estilo', 'caimento', 'tecido', 'conforto', 'cores disponíveis'],
    estilo_venda: 'Consultor de moda: moderno, atencioso, foca em estilo e ocasião de uso'
  },
  {
    id: 'automotivo',
    nome: '🚗 Automotivo',
    descricao: 'Peças, acessórios, produtos automotivos',
    tom: 'tecnico-pratico',
    vocabulario: ['compatível', 'original', 'durabilidade', 'instalação', 'garantia'],
    estilo_venda: 'Especialista automotivo: conhecedor, foca em compatibilidade e qualidade'
  },
  {
    id: 'pet-shop',
    nome: '🐾 Pet Shop',
    descricao: 'Produtos para animais',
    tom: 'carinhoso',
    vocabulario: ['pet', 'saúde', 'bem-estar', 'nutrição', 'qualidade', 'seu amiguinho'],
    estilo_venda: 'Especialista em pets: carinhoso, atencioso, foca no bem-estar do animal'
  },
  {
    id: 'beleza-cosmeticos',
    nome: '💄 Beleza e Cosméticos',
    descricao: 'Maquiagem, perfumes, cuidados pessoais',
    tom: 'fashion-cuidado',
    vocabulario: ['pele', 'resultado', 'tratamento', 'dermatologicamente testado', 'ingredientes'],
    estilo_venda: 'Consultor de beleza: atencioso, conhecedor, foca em benefícios e resultados'
  },
  {
    id: 'esportes-fitness',
    nome: '⚽ Esportes e Fitness',
    descricao: 'Equipamentos esportivos, suplementos',
    tom: 'motivador',
    vocabulario: ['performance', 'resistência', 'treino', 'resultado', 'qualidade'],
    estilo_venda: 'Coach de vendas: motivador, energético, foca em performance e resultados'
  },
  {
    id: 'imoveis',
    nome: '🏢 Imóveis',
    descricao: 'Venda e locação de imóveis',
    tom: 'formal-consultivo',
    vocabulario: ['localização', 'metragem', 'documentação', 'valor', 'oportunidade'],
    estilo_venda: 'Corretor: formal, detalhista, foca em localização e documentação'
  },
  {
    id: 'servicos-profissionais',
    nome: '💼 Serviços Profissionais',
    descricao: 'Consultoria, serviços B2B',
    tom: 'corporativo',
    vocabulario: ['solução', 'experiência', 'resultados', 'expertise', 'personalizado'],
    estilo_venda: 'Consultor B2B: profissional, consultivo, foca em ROI e valor agregado'
  },
  {
    id: 'outros',
    nome: '📦 Outros',
    descricao: 'Outros segmentos',
    tom: 'neutro',
    vocabulario: ['qualidade', 'disponível', 'garantia', 'entrega'],
    estilo_venda: 'Vendedor genérico: adaptável, profissional'
  }
];

export type Segmento = typeof SEGMENTOS_EMPRESA[number];

export const getSegmentoById = (id: string): Segmento | undefined => {
  return SEGMENTOS_EMPRESA.find(s => s.id === id);
};

export const getSegmentoConfig = (id: string) => {
  const segmento = getSegmentoById(id) || SEGMENTOS_EMPRESA.find(s => s.id === 'outros')!;
  return {
    tom: segmento.tom,
    estilo: segmento.estilo_venda,
    vocabulario: segmento.vocabulario
  };
};
