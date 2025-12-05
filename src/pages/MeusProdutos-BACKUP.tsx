// BACKUP DO CÓDIGO ATUAL - MeusProdutos.tsx
// Criado em: 2025-12-05
// Para referência futura caso precise restaurar

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Package, Search, Plus, Pencil, Trash2, Rocket, ArrowLeft, Sun, Moon, Upload, Image as ImageIcon, X, Play, Pause } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ImportCSVModal from '@/components/ImportCSVModal';
import { CriarCampanhaModal } from '@/components/CriarCampanhaModal';
import { CriarCampanhaWhatsAppModal } from '@/components/CriarCampanhaWhatsAppModal';
import { CampanhaDebugPanel } from '@/components/CampanhaDebugPanel';
import { CATEGORIAS_MARKETPLACE } from '@/lib/categories';

interface Campanha {
  id: string;
  nome: string;
  frequencia: string;
  data_inicio: string;
  horarios: string[];
  dias_semana: number[];
  mensagem_template: string;
  listas_ids: string[];
  ativa: boolean;
  status: string;
  ultima_execucao: string | null;
  total_enviados: number;
  proxima_execucao: string | null;
}

interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  categoria: string;
  sku: string | null;
  link: string | null;
  tags: string[] | null;
  ativo: boolean;
  created_at: string;
  cliente_id: string | null;
  clientes?: { nome: string; tipo_negocio: string | null };
  campanha?: Campanha | null;
  estoque: number;
  especificacoes: string | null;
  link_marketplace: string | null;
  publicar_marketplace: boolean;
  imagens: any; // Json do banco pode ser string[] ou string
}

interface ProductFormProps {
  formData: {
    nome: string;
    descricao: string;
    preco: string;
    categoria: string;
    sku: string;
    link: string;
    tags: string;
    ativo: boolean;
    estoque: string;
    especificacoes: string;
    link_marketplace: string;
    publicar_marketplace: boolean;
    imagens: string[];
    tipo: string;
    ficha_tecnica: string;
    informacao_nutricional: string;
    ingredientes: string;
    modo_uso: string;
    beneficios: string;
    garantia: string;
    dimensoes: string;
    peso: string;
    cor: string;
    tamanhos: string;
  };
  setFormData: (data: any) => void;
  onSubmit: () => void;
  submitLabel: string;
  setIsAddModalOpen: (open: boolean) => void;
  setIsEditModalOpen: (open: boolean) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  previewImage: string | null;
  currentImageUrl?: string | null;
}

const ProductForm = ({ 
  formData, 
  setFormData, 
  onSubmit, 
  submitLabel,
  setIsAddModalOpen,
  setIsEditModalOpen,
  imageFile,
  setImageFile,
  previewImage,
  currentImageUrl
}: ProductFormProps) => {
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Apenas imagens são permitidas');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 5MB');
        return;
      }
      setImageFile(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
  };

  return (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="nome">Nome do Produto *</Label>
      <Input
        id="nome"
        value={formData.nome}
        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
        placeholder="Ex: Smartphone Galaxy S21"
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="descricao">Descrição</Label>
      <Textarea
        id="descricao"
        value={formData.descricao}
        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
        placeholder="Descrição detalhada do produto..."
        rows={3}
      />
    </div>

    {/* Upload de Imagem */}
    <div className="space-y-2">
      <Label>Imagem do Produto</Label>
      <div className="border-2 border-dashed rounded-lg p-4">
        {(previewImage || currentImageUrl) && !imageFile && currentImageUrl ? (
          <div className="relative">
            <img 
              src={currentImageUrl} 
              alt="Produto atual" 
              className="w-full h-48 object-cover rounded"
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Imagem atual do produto
            </p>
          </div>
        ) : previewImage ? (
          <div className="relative">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-full h-48 object-cover rounded"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={removeImage}
            >
              <X className="w-4 h-4" />
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Nova imagem selecionada
            </p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <Label 
              htmlFor="image-upload" 
              className="cursor-pointer text-primary hover:underline"
            >
              Clique para selecionar uma imagem
            </Label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground mt-2">
              PNG, JPG ou WEBP (máx. 5MB)
            </p>
          </div>
        )}
        {(previewImage || (currentImageUrl && !previewImage)) && (
          <div className="mt-3">
            <Label 
              htmlFor="image-upload-change" 
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Alterar Imagem
            </Label>
            <input
              id="image-upload-change"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="preco">Preço (R$)</Label>
        <Input
          id="preco"
          type="number"
          step="0.01"
          value={formData.preco}
          onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
          placeholder="0.00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sku">SKU/Código</Label>
        <Input
          id="sku"
          value={formData.sku}
          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          placeholder="Ex: PROD-001"
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="link">Link do Produto</Label>
      <Input
        id="link"
        type="url"
        value={formData.link}
        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
        placeholder="https://..."
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
      <Input
        id="tags"
        value={formData.tags}
        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
        placeholder="Ex: promoção, novo, destaque"
      />
    </div>

    {/* NOVOS CAMPOS */}
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="estoque">Estoque Disponível *</Label>
        <Input
          id="estoque"
          type="number"
          value={formData.estoque}
          onChange={(e) => setFormData({ ...formData, estoque: e.target.value })}
          placeholder="Ex: 50"
        />
      </div>
    </div>

    {/* TIPO DE PRODUTO */}
    <div className="space-y-2">
      <Label htmlFor="tipo">Tipo de Produto/Serviço *</Label>
      <Select
        value={formData.tipo}
        onValueChange={(v) => setFormData({...formData, tipo: v})}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fisico">📦 Produto Físico</SelectItem>
          <SelectItem value="servico">🛠️ Serviço</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* CAMPOS DETALHADOS EXPANDIDOS */}
    <details className="border rounded-lg p-4 space-y-4">
      <summary className="cursor-pointer font-semibold mb-2">
        📋 Informações Detalhadas (Opcional - IA usará para responder clientes)
      </summary>
      
      <div className="space-y-4 mt-4">
        
        {/* FICHA TÉCNICA */}
        <div className="space-y-2">
          <Label htmlFor="ficha_tecnica">Ficha Técnica / Especificações</Label>
          <Textarea
            id="ficha_tecnica"
            value={formData.ficha_tecnica}
            onChange={(e) => setFormData({...formData, ficha_tecnica: e.target.value})}
            placeholder="Voltagem: 110V&#10;Potência: 1500W&#10;Dimensões: 30x40x50cm"
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            💡 IA usará isso para responder perguntas técnicas dos clientes
          </p>
        </div>

        {/* INFORMAÇÃO NUTRICIONAL */}
        {formData.tipo === 'fisico' && (
          <div className="space-y-2">
            <Label htmlFor="informacao_nutricional">Informação Nutricional (Alimentos)</Label>
            <Textarea
              id="informacao_nutricional"
              value={formData.informacao_nutricional}
              onChange={(e) => setFormData({...formData, informacao_nutricional: e.target.value})}
              placeholder="Porção: 100g&#10;Calorias: 250kcal&#10;Carboidratos: 30g&#10;Proteínas: 8g&#10;Gorduras: 10g"
              rows={5}
            />
          </div>
        )}

        {/* INGREDIENTES */}
        {formData.tipo === 'fisico' && (
          <div className="space-y-2">
            <Label htmlFor="ingredientes">Ingredientes</Label>
            <Textarea
              id="ingredientes"
              value={formData.ingredientes}
              onChange={(e) => setFormData({...formData, ingredientes: e.target.value})}
              placeholder="Farinha de trigo, açúcar, ovos, leite..."
              rows={3}
            />
          </div>
        )}

        {/* MODO DE USO */}
        <div className="space-y-2">
          <Label htmlFor="modo_uso">Modo de Uso / Como Usar</Label>
          <Textarea
            id="modo_uso"
            value={formData.modo_uso}
            onChange={(e) => setFormData({...formData, modo_uso: e.target.value})}
            placeholder="Aplique sobre a pele limpa, massageando até completa absorção..."
            rows={3}
          />
        </div>

        {/* BENEFÍCIOS */}
        <div className="space-y-2">
          <Label htmlFor="beneficios">Benefícios / Diferenciais</Label>
          <Textarea
            id="beneficios"
            value={formData.beneficios}
            onChange={(e) => setFormData({...formData, beneficios: e.target.value})}
            placeholder="- Alta durabilidade&#10;- Economia de energia&#10;- Design moderno"
            rows={3}
          />
        </div>

        {/* GARANTIA */}
        <div className="space-y-2">
          <Label htmlFor="garantia">Garantia</Label>
          <Input
            id="garantia"
            value={formData.garantia}
            onChange={(e) => setFormData({...formData, garantia: e.target.value})}
            placeholder="12 meses"
          />
        </div>

        {/* DIMENSÕES E PESO (só produtos físicos) */}
        {formData.tipo === 'fisico' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dimensoes">Dimensões (cm)</Label>
              <Input
                id="dimensoes"
                value={formData.dimensoes}
                onChange={(e) => setFormData({...formData, dimensoes: e.target.value})}
                placeholder="30x40x50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="peso">Peso (kg)</Label>
              <Input
                id="peso"
                value={formData.peso}
                onChange={(e) => setFormData({...formData, peso: e.target.value})}
                placeholder="2.5"
              />
            </div>
          </div>
        )}

        {/* COR E TAMANHOS */}
        {formData.tipo === 'fisico' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cor">Cores Disponíveis</Label>
              <Input
                id="cor"
                value={formData.cor}
                onChange={(e) => setFormData({...formData, cor: e.target.value})}
                placeholder="Preto, Branco, Azul"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tamanhos">Tamanhos Disponíveis</Label>
              <Input
                id="tamanhos"
                value={formData.tamanhos}
                onChange={(e) => setFormData({...formData, tamanhos: e.target.value})}
                placeholder="P, M, G, GG"
              />
            </div>
          </div>
        )}

      </div>
    </details>

    <div className="space-y-2">
      <Label htmlFor="especificacoes">Especificações Técnicas (Campo Legado)</Label>
      <Textarea
        id="especificacoes"
        value={formData.especificacoes}
        onChange={(e) => setFormData({ ...formData, especificacoes: e.target.value })}
        rows={3}
        placeholder="• Peso: 500g&#10;• Validade: 30 dias&#10;• Origem: Nacional"
      />
      <p className="text-xs text-muted-foreground">
        ⚠️ Use o campo "Ficha Técnica" acima para detalhes completos
      </p>
    </div>

    <div className="space-y-2">
      <Label htmlFor="link_marketplace">Link do Marketplace (Pagamento) *</Label>
      <Input
        id="link_marketplace"
        type="url"
        value={formData.link_marketplace}
        onChange={(e) => setFormData({ ...formData, link_marketplace: e.target.value })}
        placeholder="https://pay.mercadopago.com/..."
      />
      <p className="text-xs text-muted-foreground">
        Cole aqui o link onde o cliente vai pagar (Mercado Pago, PagSeguro, etc)
      </p>
    </div>

    {/* MÚLTIPLAS IMAGENS */}
    <div className="space-y-2">
      <Label>Fotos do Produto (até 5 URLs)</Label>
      <div className="space-y-2">
        {formData.imagens.map((img: string, idx: number) => (
          <div key={idx} className="flex gap-2 items-center">
            {img && (
              <img src={img} className="w-16 h-16 object-cover rounded" alt={`Foto ${idx + 1}`} />
            )}
            <Input 
              value={img} 
              onChange={(e) => {
                const novasImagens = [...formData.imagens];
                novasImagens[idx] = e.target.value;
                setFormData({ ...formData, imagens: novasImagens });
              }} 
              placeholder="URL da imagem"
            />
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              onClick={() => {
                const novasImagens = formData.imagens.filter((_: string, i: number) => i !== idx);
                setFormData({ ...formData, imagens: novasImagens });
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {formData.imagens.length < 5 && (
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={() => setFormData({ ...formData, imagens: [...formData.imagens, ''] })}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Adicionar Foto
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        💡 Dica: Use URLs de imagens do Google Drive, Imgur, etc.
      </p>
    </div>

    {/* CATEGORIA COM SELECT */}
    <div className="space-y-2">
      <Label htmlFor="categoria">Categoria *</Label>
      <Select 
        value={formData.categoria}
        onValueChange={(value) => setFormData({ ...formData, categoria: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione uma categoria" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIAS_MARKETPLACE.map(cat => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.icone} {cat.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {/* PUBLICAR NO MARKETPLACE */}
    <div className="flex items-center gap-2">
      <Checkbox
        checked={formData.publicar_marketplace}
        onCheckedChange={(checked) => setFormData({ ...formData, publicar_marketplace: checked as boolean })}
      />
      <Label className="cursor-pointer">🌍 Publicar no Marketplace Público AMZ Ofertas</Label>
    </div>

    <div className="flex items-center gap-3">
      <Label htmlFor="ativo">Status:</Label>
      <Select 
        value={formData.ativo ? 'true' : 'false'} 
        onValueChange={(v) => setFormData({ ...formData, ativo: v === 'true' })}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Ativo</SelectItem>
          <SelectItem value="false">Pausado</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex gap-3 justify-end pt-4">
      <Button variant="outline" onClick={() => {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
      }}>
        Cancelar
      </Button>
      <Button onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  </div>
  );
};

export default function MeusProdutos() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false);
  const [isCampanhaModalOpen, setIsCampanhaModalOpen] = useState(false);
  const [isCampanhaWhatsAppOpen, setIsCampanhaWhatsAppOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCampanha, setSelectedCampanha] = useState<Campanha | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    preco: '',
    categoria: '',
    sku: '',
    link: '',
    tags: '',
    ativo: true,
    estoque: '',
    especificacoes: '',
    link_marketplace: '',
    publicar_marketplace: true,
    imagens: [] as string[],
    // NOVOS CAMPOS DETALHADOS
    tipo: 'fisico',
    ficha_tecnica: '',
    informacao_nutricional: '',
    ingredientes: '',
    modo_uso: '',
    beneficios: '',
    garantia: '',
    dimensoes: '',
    peso: '',
    cor: '',
    tamanhos: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  // Preview da imagem quando selecionada
  useEffect(() => {
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      setPreviewImage(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewImage(null);
    }
  }, [imageFile]);

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    fetchProducts();
    fetchUserId();
  }, []);

  const fetchUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  useEffect(() => {
    // Extract unique categories from products
    const uniqueCategories = Array.from(new Set(products.map(p => p.categoria)));
    setCategories(uniqueCategories);
  }, [products]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          *, 
          clientes(nome, tipo_negocio),
          campanhas_recorrentes!campanhas_recorrentes_produto_id_fkey(
            id, nome, frequencia, data_inicio, horarios, dias_semana,
            mensagem_template, listas_ids, ativa, status, ultima_execucao,
            total_enviados, proxima_execucao
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Processar produtos para incluir campanha ativa
      const produtosComCampanhas = (data || []).map(p => {
        const campanhasAtivas = (p.campanhas_recorrentes as any[])?.filter((c: any) => c.ativa) || [];
        return {
          ...p,
          campanha: campanhasAtivas.length > 0 ? campanhasAtivas[0] : null
        };
      });
      
      setProducts(produtosComCampanhas);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setIsLoading(false);
    }
  };


  const uploadImage = async (file: File, productId: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      console.log('📤 Iniciando upload:', { fileName, filePath, fileSize: file.size });

      const { error: uploadError, data } = await supabase.storage
        .from('produtos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload concluído:', data);

      const { data: { publicUrl } } = supabase.storage
        .from('produtos')
        .getPublicUrl(filePath);

      console.log('🔗 URL pública gerada:', publicUrl);

      return publicUrl;
    } catch (error) {
      console.error('❌ Erro ao fazer upload da imagem:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    }
  };

  const handleAddProduct = async () => {
    if (!formData.nome || !formData.categoria) {
      toast.error('Nome e categoria são obrigatórios');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      console.log('➕ Adicionando produto:', formData);
      console.log('📷 Imagem selecionada:', imageFile ? 'Sim' : 'Não');

      // Primeiro insere o produto sem a imagem
      const { data: newProduct, error } = await supabase
        .from('produtos')
        .insert({
          user_id: user.id,
          nome: formData.nome,
          descricao: formData.descricao || null,
          preco: formData.preco ? parseFloat(formData.preco) : null,
          categoria: formData.categoria,
          sku: formData.sku || null,
          link: formData.link || null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : null,
          ativo: formData.ativo,
          cliente_id: null,
          imagem_url: null,
          estoque: formData.estoque ? parseInt(formData.estoque) : 0,
          especificacoes: formData.especificacoes || null,
          link_marketplace: formData.link_marketplace || null,
          publicar_marketplace: formData.publicar_marketplace,
          imagens: formData.imagens || [],
          tipo: formData.tipo || 'fisico',
          ficha_tecnica: formData.ficha_tecnica || null,
          informacao_nutricional: formData.informacao_nutricional || null,
          ingredientes: formData.ingredientes || null,
          modo_uso: formData.modo_uso || null,
          beneficios: formData.beneficios || null,
          garantia: formData.garantia || null,
          dimensoes: formData.dimensoes || null,
          peso: formData.peso || null,
          cor: formData.cor || null,
          tamanhos: formData.tamanhos || null
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Produto criado:', newProduct);

      // Se tem imagem, faz upload e atualiza o produto
      if (imageFile && newProduct) {
        toast.loading('Enviando imagem...');
        const imageUrl = await uploadImage(imageFile, newProduct.id);
        
        if (imageUrl) {
          console.log('🔄 Atualizando produto com URL da imagem...');
          const { error: updateError } = await supabase
            .from('produtos')
            .update({ imagem_url: imageUrl })
            .eq('id', newProduct.id);

          if (updateError) {
            console.error('❌ Erro ao atualizar URL da imagem:', updateError);
            toast.error('Erro ao salvar URL da imagem');
          } else {
            console.log('✅ Produto atualizado com imagem');
            toast.dismiss();
          }
        }
      }

      toast.success('Produto adicionado com sucesso!');
      setIsAddModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('❌ Erro ao adicionar produto:', error);
      toast.dismiss();
      toast.error('Erro ao adicionar produto');
    }
  };

  const handleEditProduct = async () => {
    if (!selectedProduct) return;

    try {
      console.log('✏️ Editando produto:', selectedProduct.id);
      console.log('📷 Nova imagem selecionada:', imageFile ? 'Sim' : 'Não');

      let imagemUrl = currentImageUrl;

      // Se foi selecionada uma nova imagem, faz o upload
      if (imageFile) {
        toast.loading('Enviando nova imagem...');
        imagemUrl = await uploadImage(imageFile, selectedProduct.id);
        
        if (!imagemUrl) {
          toast.dismiss();
          toast.error('Erro ao fazer upload da nova imagem');
          return;
        }
        
        console.log('✅ Nova imagem enviada:', imagemUrl);
        toast.dismiss();
      }

      // Atualiza o produto com todos os dados, incluindo a nova URL da imagem se houver
      const { error } = await supabase
        .from('produtos')
        .update({
          nome: formData.nome,
          descricao: formData.descricao || null,
          preco: formData.preco ? parseFloat(formData.preco) : null,
          categoria: formData.categoria,
          sku: formData.sku || null,
          link: formData.link || null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : null,
          ativo: formData.ativo,
          cliente_id: null,
          imagem_url: imagemUrl,
          estoque: formData.estoque ? parseInt(formData.estoque) : 0,
          especificacoes: formData.especificacoes || null,
          link_marketplace: formData.link_marketplace || null,
          publicar_marketplace: formData.publicar_marketplace,
          imagens: formData.imagens || [],
          tipo: formData.tipo || 'fisico',
          ficha_tecnica: formData.ficha_tecnica || null,
          informacao_nutricional: formData.informacao_nutricional || null,
          ingredientes: formData.ingredientes || null,
          modo_uso: formData.modo_uso || null,
          beneficios: formData.beneficios || null,
          garantia: formData.garantia || null,
          dimensoes: formData.dimensoes || null,
          peso: formData.peso || null,
          cor: formData.cor || null,
          tamanhos: formData.tamanhos || null
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      console.log('✅ Produto atualizado com sucesso');
      toast.success('Produto atualizado com sucesso!');
      setIsEditModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('❌ Erro ao atualizar produto:', error);
      toast.dismiss();
      toast.error('Erro ao atualizar produto');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Tem certeza que deseja deletar este produto?')) return;

    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produto deletado!');
      fetchProducts();
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast.error('Erro ao excluir produto');
    }
  };

  const handleCreateCampaign = (product: Product) => {
    setSelectedProduct(product);
    setSelectedCampanha(null);
    setIsCampanhaWhatsAppOpen(true);
  };

  const handleEditCampaign = (product: Product) => {
    if (product.campanha) {
      setSelectedProduct(product);
      setSelectedCampanha(product.campanha);
      setIsCampanhaWhatsAppOpen(true);
    }
  };

  const handlePausarCampanha = async (product: Product) => {
    if (!product.campanha) return;
    
    try {
      const { error } = await supabase
        .from('campanhas_recorrentes')
        .update({ ativa: false, status: 'pausada' })
        .eq('id', product.campanha.id);

      if (error) throw error;
      toast.success('✅ Campanha pausada');
      fetchProducts();
    } catch (error) {
      console.error('Erro ao pausar campanha:', error);
      toast.error('Erro ao pausar campanha');
    }
  };

  const handleRenovarCampanha = async (product: Product) => {
    if (!product.campanha) return;
    
    try {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      
      const { error } = await supabase
        .from('campanhas_recorrentes')
        .update({ 
          ativa: true, 
          status: 'ativa',
          proxima_execucao: amanha.toISOString()
        })
        .eq('id', product.campanha.id);

      if (error) throw error;
      toast.success('✅ Campanha renovada!');
      fetchProducts();
    } catch (error) {
      console.error('Erro ao renovar campanha:', error);
      toast.error('Erro ao renovar campanha');
    }
  };

  const handleTestarCampanha = async (product: Product) => {
    if (!product.campanha?.id) {
      toast.error('Campanha não encontrada');
      return;
    }

    toast.info('🧪 Testando envio imediato...');

    try {
      const { data, error } = await supabase.functions.invoke('execute-campaign', {
        body: { campaign_id: product.campanha.id }
      });

      if (error) {
        toast.error('Erro ao executar: ' + error.message);
        console.error(error);
      } else if (data?.success) {
        toast.success(
          `✅ ${data.enviados}/${data.total} mensagens enviadas!`,
          { duration: 5000 }
        );
        fetchProducts();
      } else {
        toast.error('Erro: ' + (data?.error || 'Falha desconhecida'));
      }
    } catch (err) {
      toast.error('Erro ao testar campanha');
      console.error(err);
    }
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      nome: product.nome,
      descricao: product.descricao || '',
      preco: product.preco?.toString() || '',
      categoria: product.categoria,
      sku: product.sku || '',
      link: product.link || '',
      tags: product.tags?.join(', ') || '',
      ativo: product.ativo,
      estoque: product.estoque?.toString() || '0',
      especificacoes: product.especificacoes || '',
      link_marketplace: product.link_marketplace || '',
      publicar_marketplace: product.publicar_marketplace ?? true,
      imagens: Array.isArray(product.imagens) ? product.imagens : [],
      tipo: (product as any).tipo || 'fisico',
      ficha_tecnica: (product as any).ficha_tecnica || '',
      informacao_nutricional: (product as any).informacao_nutricional || '',
      ingredientes: (product as any).ingredientes || '',
      modo_uso: (product as any).modo_uso || '',
      beneficios: (product as any).beneficios || '',
      garantia: (product as any).garantia || '',
      dimensoes: (product as any).dimensoes || '',
      peso: (product as any).peso || '',
      cor: (product as any).cor || '',
      tamanhos: (product as any).tamanhos || ''
    });
    setCurrentImageUrl(product.imagem_url);
    setImageFile(null);
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      preco: '',
      categoria: '',
      sku: '',
      link: '',
      tags: '',
      ativo: true,
      estoque: '',
      especificacoes: '',
      link_marketplace: '',
      publicar_marketplace: true,
      imagens: [],
      tipo: 'fisico',
      ficha_tecnica: '',
      informacao_nutricional: '',
      ingredientes: '',
      modo_uso: '',
      beneficios: '',
      garantia: '',
      dimensoes: '',
      peso: '',
      cor: '',
      tamanhos: ''
    });
    setSelectedProduct(null);
    setImageFile(null);
    setCurrentImageUrl(null);
  };

  const getFilteredProducts = () => {
    return products.filter(product => {
      const matchesSearch = product.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.categoria === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  };

  const filteredProducts = getFilteredProducts();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">📦 Gestão de Produtos</h1>
                <p className="text-muted-foreground mt-1">Gerencie seus produtos e campanhas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={openAddModal} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Produto
              </Button>
              <Button onClick={() => setIsImportCSVOpen(true)} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Importar CSV
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Button>
              <Button variant="outline" size="icon" onClick={toggleDarkMode}>
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
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
                  <SelectItem value="all">Todas Categorias ({filteredProducts.length})</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat} ({filteredProducts.filter(p => p.categoria === cat).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg mb-4">
                {searchTerm || categoryFilter !== 'all' 
                  ? 'Nenhum produto encontrado com os filtros selecionados.'
                  : 'Você ainda não tem produtos cadastrados.'}
              </p>
              {!searchTerm && categoryFilter === 'all' && (
                <Button onClick={openAddModal} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Primeiro Produto
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className="relative">
                      {product.imagem_url ? (
                        <div className="relative">
                          <img src={product.imagem_url} alt={product.nome} className="w-16 h-16 object-cover rounded" />
                          
                          {/* CONTADOR DE ENVIOS */}
                          {product.campanha && product.campanha.total_enviados > 0 && (
                            <div className="absolute -bottom-2 -left-2 bg-black/70 text-white px-2 py-0.5 rounded text-[10px]">
                              📤 {product.campanha.total_enviados}
                            </div>
                          )}
                        </div>
                       ) : (
                        <ImageIcon className="w-16 h-16 text-muted-foreground" />
                      )}
                    </div>
                    
                    {/* BADGES DE STATUS DA CAMPANHA + TOGGLE ATIVAR/PAUSAR */}
                    <div className="flex flex-col items-end gap-2">
                      {product.campanha && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {product.campanha.ativa ? '✅ Ativa' : '⏸️ Pausada'}
                          </span>
                          <Switch
                            checked={product.campanha.ativa}
                            onCheckedChange={async (checked) => {
                              try {
                                const updates: any = { ativa: checked, status: checked ? 'ativa' : 'pausada' };
                                if (checked && !product.campanha?.proxima_execucao) {
                                  const proximaExec = new Date();
                                  proximaExec.setHours(proximaExec.getHours() + 1);
                                  updates.proxima_execucao = proximaExec.toISOString();
                                }
                                await supabase
                                  .from('campanhas_recorrentes')
                                  .update(updates)
                                  .eq('id', product.campanha?.id);
                                toast.success(checked ? '▶️ Campanha ativada!' : '⏸️ Campanha pausada!');
                                fetchProducts();
                              } catch (error) {
                                toast.error('Erro ao alterar campanha');
                              }
                            }}
                          />
                        </div>
                      )}
                      {product.campanha && product.campanha.ativa && (
                        <Badge className="bg-green-500 text-white text-xs animate-pulse">
                          🚀 Em Campanha
                        </Badge>
                      )}
                      <Badge variant={product.ativo ? 'default' : 'secondary'}>
                        {product.ativo ? 'Ativo' : 'Pausado'}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-xl">{product.nome}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {product.descricao || 'Sem descrição'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {product.preco && (
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                      <span className="text-sm font-medium">Preço:</span>
                      <span className="text-2xl font-bold text-primary">
                        R$ {product.preco.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Categoria:</span>
                      <Badge variant="outline">{product.categoria}</Badge>
                    </div>
                    {product.sku && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">SKU:</span>
                        <span className="font-medium">{product.sku}</span>
                      </div>
                    )}
                  </div>

                  {/* BOTÕES DE AÇÃO */}
                  <div className="space-y-2 pt-4">
                    {product.campanha ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditCampaign(product)}
                          >
                            ✏️ Editar Campanha
                          </Button>
                          {product.campanha.ativa ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handlePausarCampanha(product)}
                            >
                              ⏸️ Pausar
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => handleRenovarCampanha(product)}
                            >
                              🔄 Renovar
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditModal(product)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Editar Produto
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive mr-1" />
                            Excluir
                          </Button>
                        </div>
                        {product.campanha.proxima_execucao && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            Próximo envio: {new Date(product.campanha.proxima_execucao).toLocaleString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          className="w-full gap-2"
                          onClick={() => handleCreateCampaign(product)}
                        >
                          <Rocket className="w-4 h-4" />
                          Criar Campanha
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditModal(product)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* PAINEL DE DEBUG DE CAMPANHAS */}
        <div className="mt-8">
          <CampanhaDebugPanel />
        </div>
        
        {/* Indicador Visual de Verificador Ativo */}
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-2 rounded-full text-xs flex items-center gap-2 shadow-lg z-50">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          Verificador Ativo
        </div>
      </div>

      {/* Modals */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Produto</DialogTitle>
            <DialogDescription>Preencha os dados do novo produto</DialogDescription>
          </DialogHeader>
          <ProductForm 
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAddProduct}
            submitLabel="Adicionar Produto"
            setIsAddModalOpen={setIsAddModalOpen}
            setIsEditModalOpen={setIsEditModalOpen}
            imageFile={imageFile}
            setImageFile={setImageFile}
            previewImage={previewImage}
            currentImageUrl={null}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>Atualize as informações do produto</DialogDescription>
          </DialogHeader>
          <ProductForm 
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEditProduct}
            submitLabel="Salvar Alterações"
            setIsAddModalOpen={setIsAddModalOpen}
            setIsEditModalOpen={setIsEditModalOpen}
            imageFile={imageFile}
            setImageFile={setImageFile}
            previewImage={previewImage}
            currentImageUrl={currentImageUrl}
          />
        </DialogContent>
      </Dialog>

      <ImportCSVModal
        isOpen={isImportCSVOpen}
        onClose={() => setIsImportCSVOpen(false)}
        onSuccess={fetchProducts}
      />

      {selectedProduct && (
        <CriarCampanhaModal
          isOpen={isCampanhaModalOpen}
          onClose={() => {
            setIsCampanhaModalOpen(false);
            setSelectedProduct(null);
          }}
          produto={selectedProduct}
          cliente={selectedProduct.clientes || null}
        />
      )}

      {selectedProduct && (
        <CriarCampanhaWhatsAppModal
          open={isCampanhaWhatsAppOpen}
          onOpenChange={(open) => {
            setIsCampanhaWhatsAppOpen(open);
            if (!open) {
              setSelectedProduct(null);
              setSelectedCampanha(null);
            }
          }}
          produto={selectedProduct}
          campanhaExistente={selectedCampanha}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  );
}
