import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const categorias = ['Eletrônicos', 'Casa e Cozinha', 'Esportes', 'Livros', 'Moda', 'Beleza'];
const produtosBase = [
  'Fone de Ouvido Bluetooth', 'Smart Watch', 'Teclado Mecânico', 'Mouse Gamer',
  'Câmera Web HD', 'SSD 1TB', 'Monitor 24"', 'Headset Gamer', 'Webcam 4K',
  'Kit Panelas Antiaderente', 'Air Fryer', 'Cafeteira Elétrica', 'Liquidificador',
  'Jogo de Facas', 'Organizador de Cozinha', 'Batedeira', 'Chaleira Elétrica',
  'Halteres Ajustáveis', 'Tapete de Yoga', 'Bicicleta Ergométrica', 'Corda de Pular',
  'Kit Elásticos', 'Garrafa Térmica', 'Luvas de Treino', 'Esteira Elétrica',
  'Livro Best Seller', 'Kindle', 'Caderno Inteligente', 'Canetas Premium',
  'Camiseta Premium', 'Tênis Esportivo', 'Relógio Digital', 'Mochila Executiva',
  'Kit Skincare', 'Perfume Importado', 'Secador de Cabelo', 'Chapinha Profissional'
];

function gerarProduto(index: number): any {
  const nome = produtosBase[index % produtosBase.length];
  const categoria = categorias[Math.floor(Math.random() * categorias.length)];
  const preco = (Math.random() * 500 + 50).toFixed(2);
  const comissao = (parseFloat(preco) * (Math.random() * 0.1 + 0.05)).toFixed(2);
  const rating = (Math.random() * 2 + 3).toFixed(1);
  const reviews = Math.floor(Math.random() * 5000 + 100);
  const demandaMensal = Math.floor(Math.random() * 10000 + 500);
  
  return {
    id: `prod_${index + 1}`,
    nome: `${nome} ${index + 1}`,
    asin: `B0${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    url: `https://amazon.com.br/dp/B0${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    imagem: `https://picsum.photos/seed/${index}/400/400`,
    preco: parseFloat(preco),
    comissao: parseFloat(comissao),
    rating: parseFloat(rating),
    reviews,
    demandaMensal,
    categoria,
    dataCadastro: new Date().toISOString()
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const limite = parseInt(url.searchParams.get('limite') || '100');
    const busca = url.searchParams.get('busca')?.toLowerCase() || '';

    console.log(`Buscando produtos - Limite: ${limite}, Busca: ${busca}`);

    let produtos = Array.from({ length: Math.min(limite, 1000) }, (_, i) => gerarProduto(i));

    if (busca) {
      produtos = produtos.filter(p => 
        p.nome.toLowerCase().includes(busca) || 
        p.categoria.toLowerCase().includes(busca)
      );
    }

    console.log(`Retornando ${produtos.length} produtos`);

    return new Response(
      JSON.stringify({ produtos, total: produtos.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao buscar oportunidades:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
