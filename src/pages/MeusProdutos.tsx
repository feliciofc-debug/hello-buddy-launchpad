import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
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
import { Package, Search, Plus, Pencil, Trash2, Rocket, ArrowLeft, Sun, Moon, Upload, Image as ImageIcon, X, Play, Pause, Plug, Megaphone, Copy, Clock, Calendar, Facebook, Instagram, Video, Download } from 'lucide-react';
import { ProductImageCarousel } from '@/components/ProductImageCarousel';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ImportCSVModal from '@/components/ImportCSVModal';
import { CriarCampanhaModal } from '@/components/CriarCampanhaModal';
import { CriarCampanhaWhatsAppModal } from '@/components/CriarCampanhaWhatsAppModal';
import { CampanhaDebugPanel } from '@/components/CampanhaDebugPanel';
import { CATEGORIAS_MARKETPLACE } from '@/lib/categories';
import StockIntegrations from '@/components/StockIntegrations';
import { PostarFacebookModal } from '@/components/PostarFacebookModal';
import { PostarInstagramModal } from '@/components/PostarInstagramModal';
import { AutopilotModal } from '@/components/AutopilotModal';
import { PublicarReelsModal } from '@/components/PublicarReelsModal';
import { PublicarSimultaneoModal } from '@/components/PublicarSimultaneoModal';
import { AreaVideos } from '@/components/AreaVideos';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { TikTokIcon } from '@/components/tiktok/TikTokIcon';
import { useGerarReel } from '@/hooks/useGerarReel';
import { ModalProgressoReel } from '@/components/videos/ModalProgressoReel';

// Limite de fotos por produto (capa + extras). Atende sellers de imóveis/carros que precisam de muitas fotos.
const MAX_PRODUCT_PHOTOS = 30;

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
  imagens_reel?: any; // Json do banco — array de URLs selecionadas para Reel (até 5)
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
    brand: string;
    attributes: Record<string, string>;
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
  setCurrentImageUrl?: (url: string | null) => void;
  extraImageFiles: (File | null)[];
  setExtraImageFiles: (files: (File | null)[]) => void;
  existingExtraImages: string[];
  setExistingExtraImages: (imgs: string[]) => void;
  imagensReel: string[];
  setImagensReel: (urls: string[]) => void;
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
  currentImageUrl,
  setCurrentImageUrl,
  extraImageFiles,
  setExtraImageFiles,
  existingExtraImages,
  setExistingExtraImages,
  imagensReel,
  setImagensReel
}: ProductFormProps) => {
  const { t } = useTranslation();
  const extraPreviews = extraImageFiles.map(f => f ? URL.createObjectURL(f) : null);

  // Helper: alterna seleção de uma URL para o Reel (máx 5, ordem preservada)
  const toggleReelImage = (url: string) => {
    if (!url) return;
    if (imagensReel.includes(url)) {
      setImagensReel(imagensReel.filter(u => u !== url));
    } else {
      if (imagensReel.length >= 5) {
        toast.error('Máximo 5 fotos pro Reel. Desmarque uma pra selecionar outra.');
        return;
      }
      setImagensReel([...imagensReel, url]);
    }
  };
  const reelIndex = (url: string | null | undefined) =>
    url ? imagensReel.indexOf(url) : -1;
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('products.only_images'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('products.image_too_large'));
        return;
      }
      setImageFile(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (setCurrentImageUrl) {
      setCurrentImageUrl(null);
    }
  };

  return (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="nome">{t('products.product_name_required')}</Label>
      <Input
        id="nome"
        value={formData.nome}
        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
        placeholder={t('products.product_name')}
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="descricao">{t('products.description')}</Label>
      <Textarea
        id="descricao"
        value={formData.descricao}
        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
        placeholder={t('products.description')}
        rows={3}
      />
    </div>

    {/* Upload de Fotos do Produto (até MAX_PRODUCT_PHOTOS) */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{t('products.photos_label')}</Label>
        <span className="text-xs text-muted-foreground">
          {(currentImageUrl && !imageFile ? 1 : imageFile ? 1 : 0) + existingExtraImages.length + extraImageFiles.filter(Boolean).length}/{MAX_PRODUCT_PHOTOS}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('products.photos_hint')}
      </p>
      <div className="border-2 border-dashed rounded-lg p-4 max-h-[480px] overflow-y-auto">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {/* Foto principal */}
          {(previewImage || (currentImageUrl && !imageFile)) && (() => {
            const mainUrl = previewImage || currentImageUrl!;
            const isLocalPreview = !!previewImage; // blob: URLs não persistem ainda no banco
            const idxReel = isLocalPreview ? -1 : reelIndex(mainUrl);
            return (
              <div className="relative aspect-square overflow-hidden rounded border-2 border-primary bg-muted/20">
                <img src={mainUrl} className="h-full w-full object-cover" alt={t('products.main_photo')} />
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{t('products.main_photo')}</span>
                {!isLocalPreview && (
                  <label className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 cursor-pointer shadow">
                    <Checkbox
                      checked={idxReel >= 0}
                      onCheckedChange={() => toggleReelImage(mainUrl)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-[10px] font-medium">🎬 Reel</span>
                  </label>
                )}
                {idxReel >= 0 && (
                  <Badge variant="default" className="absolute bottom-1 right-1 px-1.5 py-0 text-[10px]">
                    Reel #{idxReel + 1}
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute right-1 top-1 h-6 w-6 p-0"
                  onClick={removeImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })()}

          {/* Fotos extras já salvas (deduplicadas: remove URL que já é a principal) */}
          {(() => {
            const principal = previewImage || currentImageUrl;
            const existingExtraImagesDedupeadas = existingExtraImages.filter(
              (url) => url && url !== principal
            );
            return existingExtraImagesDedupeadas.map((url, idx) => {
              const idxReel = reelIndex(url);
              // Índice real no array original para o botão de remoção
              const realIdx = existingExtraImages.indexOf(url);
              return (
                <div key={`existing-${idx}`} className="relative aspect-square overflow-hidden rounded border border-border bg-muted/20">
                  <img src={url} className="h-full w-full object-cover" alt={`Foto ${idx + 2}`} />
                  <label className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 cursor-pointer shadow">
                    <Checkbox
                      checked={idxReel >= 0}
                      onCheckedChange={() => toggleReelImage(url)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-[10px] font-medium">🎬 Reel</span>
                  </label>
                  {idxReel >= 0 && (
                    <Badge variant="default" className="absolute bottom-1 right-1 px-1.5 py-0 text-[10px]">
                      Reel #{idxReel + 1}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute right-1 top-1 h-6 w-6 p-0"
                    onClick={() => setExistingExtraImages(existingExtraImages.filter((_, i) => i !== realIdx))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            });
          })()}

          {/* Fotos extras novas (upload) */}
          {extraImageFiles.map((file, idx) =>
            file ? (
              <div key={`new-${idx}`} className="relative aspect-square overflow-hidden rounded border border-border bg-muted/20">
                <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt={`Nova foto ${idx + 1}`} />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute right-1 top-1 h-6 w-6 p-0"
                  onClick={() => setExtraImageFiles(extraImageFiles.filter((_, i) => i !== idx))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : null
          )}

          {/* Botão adicionar foto */}
          {((currentImageUrl && !imageFile ? 1 : imageFile ? 1 : 0) + existingExtraImages.length + extraImageFiles.filter(Boolean).length) < MAX_PRODUCT_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-border bg-muted/20 transition-colors hover:bg-muted/50">
              <ImageIcon className="mb-1 h-6 w-6 text-muted-foreground" />
              <span className="text-center text-xs text-muted-foreground">{t('products.attach_photo')}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith('image/')) {
                    toast.error(t('products.only_images_format'));
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error(t('products.image_too_large'));
                    return;
                  }
                  // Se não tem foto principal, seta como principal
                  if (!imageFile && !currentImageUrl) {
                    setImageFile(file);
                  } else {
                    setExtraImageFiles([...extraImageFiles, file]);
                  }
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="preco">{t('products.price')}</Label>
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
        <Label htmlFor="sku">{t('products.sku')}</Label>
        <Input
          id="sku"
          value={formData.sku}
          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          placeholder="Ex: PROD-001"
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="link">{t('products.product_link')}</Label>
      <Input
        id="link"
        type="url"
        value={formData.link}
        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
        placeholder="https://..."
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="tags">{t('products.tags')}</Label>
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
        <Label htmlFor="estoque">{t('products.stock')}</Label>
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
      <Label htmlFor="tipo">{t('products.product_type')}</Label>
      <Select
        value={formData.tipo}
        onValueChange={(v) => setFormData({...formData, tipo: v})}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fisico">{t('products.physical')}</SelectItem>
          <SelectItem value="servico">{t('products.service')}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* CAMPOS DETALHADOS EXPANDIDOS */}
    <details className="border rounded-lg p-4 space-y-4">
      <summary className="cursor-pointer font-semibold mb-2">
        {t('products.detailed_info')}
      </summary>
      
      <div className="space-y-4 mt-4">
        
        {/* FICHA TÉCNICA */}
        <div className="space-y-2">
          <Label htmlFor="ficha_tecnica">{t('products.tech_specs')}</Label>
          <Textarea
            id="ficha_tecnica"
            value={formData.ficha_tecnica}
            onChange={(e) => setFormData({...formData, ficha_tecnica: e.target.value})}
            placeholder="Voltagem: 110V&#10;Potência: 1500W&#10;Dimensões: 30x40x50cm"
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {t('products.tech_specs_hint')}
          </p>
        </div>

        {/* INFORMAÇÃO NUTRICIONAL */}
        {formData.tipo === 'fisico' && (
          <div className="space-y-2">
            <Label htmlFor="informacao_nutricional">{t('products.nutritional')}</Label>
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
            <Label htmlFor="ingredientes">{t('products.ingredients')}</Label>
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
          <Label htmlFor="modo_uso">{t('products.how_to_use')}</Label>
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
          <Label htmlFor="beneficios">{t('products.benefits')}</Label>
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
          <Label htmlFor="garantia">{t('products.warranty')}</Label>
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
              <Label htmlFor="dimensoes">{t('products.dimensions')}</Label>
              <Input
                id="dimensoes"
                value={formData.dimensoes}
                onChange={(e) => setFormData({...formData, dimensoes: e.target.value})}
                placeholder="30x40x50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="peso">{t('products.weight')}</Label>
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
              <Label htmlFor="cor">{t('products.colors')}</Label>
              <Input
                id="cor"
                value={formData.cor}
                onChange={(e) => setFormData({...formData, cor: e.target.value})}
                placeholder="Preto, Branco, Azul"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tamanhos">{t('products.sizes')}</Label>
              <Input
                id="tamanhos"
                value={formData.tamanhos}
                onChange={(e) => setFormData({...formData, tamanhos: e.target.value})}
                placeholder="P, M, G, GG"
              />
            </div>
          </div>
        )}

        {/* MARCA */}
        <div className="space-y-2">
          <Label htmlFor="brand">{t('products.brand')}</Label>
          <Input
            id="brand"
            value={formData.brand}
            onChange={(e) => setFormData({...formData, brand: e.target.value})}
            placeholder="Ex: Samsung, Apple, Nike..."
          />
        </div>

        {/* ATRIBUTOS POR CATEGORIA */}
        {formData.categoria === 'Alimentos e Bebidas' && (
          <div className="border p-4 rounded space-y-3">
            <h4 className="font-semibold text-sm">{t('products.food_attrs')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Peso (ex: 500g)"
                value={formData.attributes?.peso || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, peso: e.target.value}})}
              />
              <Input
                placeholder="Proteínas (ex: 21g)"
                value={formData.attributes?.proteinas || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, proteinas: e.target.value}})}
              />
              <Input
                placeholder="Origem (ex: Nacional)"
                value={formData.attributes?.origem || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, origem: e.target.value}})}
              />
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.attributes?.sem_gluten === 'true'}
                  onCheckedChange={(c) => setFormData({...formData, attributes: {...formData.attributes, sem_gluten: c ? 'true' : 'false'}})}
                />
                <span className="text-sm">{t('products.gluten_free')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.attributes?.vegano === 'true'}
                  onCheckedChange={(c) => setFormData({...formData, attributes: {...formData.attributes, vegano: c ? 'true' : 'false'}})}
                />
                <span className="text-sm">{t('products.vegan')}</span>
              </div>
            </div>
          </div>
        )}

        {(formData.categoria === 'Automotivo') && (
          <div className="border p-4 rounded space-y-3">
            <h4 className="font-semibold text-sm">{t('products.vehicle_attrs')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Ano"
                value={formData.attributes?.ano || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, ano: e.target.value}})}
              />
              <Input
                placeholder="KM"
                value={formData.attributes?.km || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, km: e.target.value}})}
              />
              <Input
                placeholder="Cor"
                value={formData.attributes?.cor || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, cor: e.target.value}})}
              />
              <Input
                placeholder="Combustível"
                value={formData.attributes?.combustivel || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, combustivel: e.target.value}})}
              />
              <Input
                placeholder="Motor"
                value={formData.attributes?.motor || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, motor: e.target.value}})}
              />
              <Input
                placeholder="Câmbio"
                value={formData.attributes?.cambio || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, cambio: e.target.value}})}
              />
            </div>
          </div>
        )}

        {formData.categoria === 'Eletrônicos' && (
          <div className="border p-4 rounded space-y-3">
            <h4 className="font-semibold text-sm">{t('products.electronics_attrs')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Voltagem"
                value={formData.attributes?.voltagem || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, voltagem: e.target.value}})}
              />
              <Input
                placeholder="Garantia"
                value={formData.attributes?.garantia || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, garantia: e.target.value}})}
              />
              <Input
                placeholder="Potência"
                value={formData.attributes?.potencia || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, potencia: e.target.value}})}
              />
            </div>
          </div>
        )}

      </div>
    </details>

    <div className="space-y-2">
      <Label htmlFor="especificacoes">{t('products.specs_legacy')}</Label>
      <Textarea
        id="especificacoes"
        value={formData.especificacoes}
        onChange={(e) => setFormData({ ...formData, especificacoes: e.target.value })}
        rows={3}
        placeholder="• Peso: 500g&#10;• Validade: 30 dias&#10;• Origem: Nacional"
      />
      <p className="text-xs text-muted-foreground">
        {t('products.specs_legacy_hint')}
      </p>
    </div>

    <div className="space-y-2">
      <Label htmlFor="link_marketplace">{t('products.marketplace_link')}</Label>
      <Input
        id="link_marketplace"
        type="url"
        value={formData.link_marketplace}
        onChange={(e) => setFormData({ ...formData, link_marketplace: e.target.value })}
        placeholder="https://pay.mercadopago.com/..."
      />
      <p className="text-xs text-muted-foreground">
        {t('products.marketplace_link_hint')}
      </p>
    </div>


    {/* CATEGORIA COM SELECT */}
    <div className="space-y-2">
      <Label htmlFor="categoria">{t('products.category')} *</Label>
      <Select 
        value={formData.categoria}
        onValueChange={(value) => setFormData({ ...formData, categoria: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('products.select_category')} />
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
      <Label className="cursor-pointer">{t('products.publish_marketplace')}</Label>
    </div>

    <div className="flex items-center gap-3">
      <Label htmlFor="ativo">{t('products.status')}</Label>
      <Select 
        value={formData.ativo ? 'true' : 'false'} 
        onValueChange={(v) => setFormData({ ...formData, ativo: v === 'true' })}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t('products.active')}</SelectItem>
          <SelectItem value="false">{t('products.paused')}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex gap-3 justify-end pt-4">
      <Button variant="outline" onClick={() => {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
      }}>
        {t('common.cancel')}
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
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false);
  const [vitrineUrl, setVitrineUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const [isCampanhaModalOpen, setIsCampanhaModalOpen] = useState(false);
  const [isCampanhaWhatsAppOpen, setIsCampanhaWhatsAppOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCampanha, setSelectedCampanha] = useState<Campanha | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [duplicateCards, setDuplicateCards] = useState<{id: string; product: Product}[]>([]);
  const [isFacebookModalOpen, setIsFacebookModalOpen] = useState(false);
  const [facebookProduct, setFacebookProduct] = useState<Product | null>(null);
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false);
  const [instagramProduct, setInstagramProduct] = useState<Product | null>(null);
  const [isAutopilotOpen, setIsAutopilotOpen] = useState(false);
  const [isReelsModalOpen, setIsReelsModalOpen] = useState(false);
  const [reelsProduct, setReelsProduct] = useState<Product | null>(null);
  const [isSimultaneoModalOpen, setIsSimultaneoModalOpen] = useState(false);
  const [simultaneoProduct, setSimultaneoProduct] = useState<Product | null>(null);
  
  const showTikTok = useFeatureFlag('tiktok_integration');

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
    tamanhos: '',
    brand: '',
    attributes: {} as Record<string, string>
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [extraImageFiles, setExtraImageFiles] = useState<(File | null)[]>([]);
  const [existingExtraImages, setExistingExtraImages] = useState<string[]>([]);
  const [imagensReel, setImagensReel] = useState<string[]>([]);

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

  const handleImportarVitrine = async () => {
    const url = vitrineUrl.trim();
    const isValid = url.includes('collshp.com') || /^[A-Za-z0-9_.\-]+$/.test(url);
    if (!isValid) {
      toast.error('Link inválido. Use collshp.com/sualoja');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sessão expirada, faça login');
      return;
    }

    setIsImporting(true);
    const loadingId = toast.loading('Importando vitrine... aguarde');
    try {
      const { data, error } = await supabase.functions.invoke('importar-vitrine-shopee', {
        body: { vitrine_url: url, user_id: user.id }
      });

      if (error || !data?.success) {
        toast.error((data as any)?.error || error?.message || 'Erro ao importar vitrine');
        return;
      }

      toast.success(`✅ ${data.total_importados} produtos importados! (${data.total_duplicados} já existiam)`);
      setVitrineUrl('');
      await fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao importar vitrine');
    } finally {
      toast.dismiss(loadingId);
      setIsImporting(false);
    }
  };

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
      toast.error(t('products.error_load'));
    } finally {
      setIsLoading(false);
    }
  };

  const { gerarReel, progresso } = useGerarReel();
  const [modalReelAberto, setModalReelAberto] = useState(false);

  const handleGerarReel = async (product: Product) => {
    const reelImgs = Array.isArray(product.imagens_reel) ? product.imagens_reel.filter(Boolean) : [];
    if (reelImgs.length < 3) {
      toast.error('Selecione pelo menos 3 fotos pra gerar o Reel. Clique em Editar e marque as fotos.');
      return;
    }
    setModalReelAberto(true);
    await gerarReel({
      produtoId: product.id,
      nomeProduto: product.nome,
      imagensUrls: reelImgs as string[],
      preco: product.preco || 0,
      precoOriginal: undefined,
    });
  };

  const uploadImage = async (file: File, productId: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('products.user_not_auth'));
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
      toast.error(t('products.error_upload'));
      return null;
    }
  };

  const handleAddProduct = async () => {
    if (!formData.nome || !formData.categoria) {
      toast.error(t('products.name_category_required'));
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('products.user_not_auth'));
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
          imagens_reel: imagensReel || [],
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
          tamanhos: formData.tamanhos || null,
          brand: formData.brand || null,
          attributes: formData.attributes || {}
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Produto criado:', newProduct);

      // Se tem imagem, faz upload e atualiza o produto
      if (imageFile && newProduct) {
        toast.loading(t('products.sending_image'));
        const imageUrl = await uploadImage(imageFile, newProduct.id);
        
        if (imageUrl) {
          console.log('🔄 Atualizando produto com URL da imagem...');
          const { error: updateError } = await supabase
            .from('produtos')
            .update({ imagem_url: imageUrl })
            .eq('id', newProduct.id);

          if (updateError) {
            console.error('❌ Erro ao atualizar URL da imagem:', updateError);
            toast.error(t('products.error_save_url'));
          } else {
            console.log('✅ Produto atualizado com imagem');
            toast.dismiss();
          }
        }
      }

      // Upload extra images
      if (newProduct && extraImageFiles.filter(Boolean).length > 0) {
        toast.loading(t('products.sending_extra'));
        const extraUrls: string[] = [];
        for (const file of extraImageFiles) {
          if (file) {
            const url = await uploadImage(file, newProduct.id);
            if (url) extraUrls.push(url);
          }
        }
        if (extraUrls.length > 0) {
          await supabase.from('produtos').update({ imagens: extraUrls }).eq('id', newProduct.id);
        }
        toast.dismiss();
      }

      setIsAddModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('❌ Erro ao adicionar produto:', error);
      toast.dismiss();
      toast.error(t('products.error_add'));
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
        toast.loading(t('products.sending_new_image'));
        imagemUrl = await uploadImage(imageFile, selectedProduct.id);
        
        if (!imagemUrl) {
          toast.dismiss();
          toast.error(t('products.error_upload_new'));
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
          imagens: existingExtraImages || [],
          imagens_reel: imagensReel || [],
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
          tamanhos: formData.tamanhos || null,
          brand: formData.brand || null,
          attributes: formData.attributes || {}
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      // Upload extra images
      if (extraImageFiles.filter(Boolean).length > 0) {
        toast.loading(t('products.sending_extra'));
        const extraUrls: string[] = [...existingExtraImages];
        for (const file of extraImageFiles) {
          if (file) {
            const url = await uploadImage(file, selectedProduct.id);
            if (url) extraUrls.push(url);
          }
        }
        await supabase.from('produtos').update({ imagens: extraUrls }).eq('id', selectedProduct.id);
        toast.dismiss();
      }

      console.log('✅ Produto atualizado com sucesso');
      toast.success(t('products.updated_success'));
      setIsEditModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('❌ Erro ao atualizar produto:', error);
      toast.dismiss();
      toast.error(t('products.error_update'));
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm(t('products.confirm_delete'))) return;

    try {
      // First delete related images from storage
      const { data: product } = await supabase
        .from('produtos')
        .select('imagem_url, imagens')
        .eq('id', productId)
        .maybeSingle();

      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', productId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '');

      if (error) {
        console.error('Delete error details:', JSON.stringify(error));
        throw error;
      }

      toast.success(t('products.deleted'));
      fetchProducts();
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      toast.error(error?.message || t('products.error_delete'));
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
      toast.success(t('products.campaign_paused_success'));
      fetchProducts();
    } catch (error) {
      console.error('Erro ao pausar campanha:', error);
      toast.error(t('products.error_pause'));
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
      toast.success(t('products.campaign_renewed'));
      fetchProducts();
    } catch (error) {
      console.error('Erro ao renovar campanha:', error);
      toast.error(t('products.error_renew'));
    }
  };

  const handlePostTikTok = async (produto: any) => {
    if (!produto.imagem_url) {
      toast.error('TikTok requer uma imagem ou vídeo do produto');
      return;
    }

    try {
      toast.loading('Publicando no TikTok...');
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.dismiss();
        toast.error('Você precisa estar logado');
        return;
      }

      const { data, error } = await supabase.functions.invoke('tiktok-post-content', {
        body: {
          user_id: userData.user.id,
          content_type: 'image',
          content_url: produto.imagem_url,
          title: produto.nome?.substring(0, 150) || 'Produto',
          post_mode: 'direct'
        }
      });

      toast.dismiss();

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao publicar');

      toast.success('Publicado no TikTok com sucesso!');
    } catch (err: any) {
      toast.dismiss();
      toast.error(err?.message || 'Erro ao publicar no TikTok');
    }
  };

  const handleTestarCampanha = async (product: Product) => {
    if (!product.campanha?.id) {
      toast.error(t('products.error_campaign'));
      return;
    }

    toast.warning(t('products.dispatcher_disabled'));
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
      tamanhos: (product as any).tamanhos || '',
      brand: (product as any).brand || '',
      attributes: (product as any).attributes || {}
    });
    setCurrentImageUrl(product.imagem_url);
    setImageFile(null);
    setExtraImageFiles([]);
    setExistingExtraImages(Array.isArray(product.imagens) ? product.imagens.filter(Boolean) : []);
    setImagensReel(Array.isArray(product.imagens_reel) ? product.imagens_reel.filter(Boolean).slice(0, 5) : []);
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
      tamanhos: '',
      brand: '',
      attributes: {}
    });
    setSelectedProduct(null);
    setImageFile(null);
    setCurrentImageUrl(null);
    setExtraImageFiles([]);
    setExistingExtraImages([]);
    setImagensReel([]);
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
                <h1 className="text-4xl font-bold">{t('products.title')}</h1>
                <p className="text-muted-foreground mt-1">{t('products.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => setIsAutopilotOpen(true)}
                className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
              >
                <Rocket className="w-4 h-4" />
                {t('products.autopilot')}
              </Button>
              <Button onClick={openAddModal} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('products.add_product')}
              </Button>
              <Button onClick={() => setIsImportCSVOpen(true)} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                {t('products.import_csv')}
              </Button>
              <Button onClick={() => setIsIntegrationsOpen(true)} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <Plug className="w-4 h-4" />
                {t('products.integrations')}
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t('nav.dashboard')}
              </Button>
              <Button variant="outline" size="icon" onClick={toggleDarkMode}>
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Importar Vitrine Shopee */}
        <Card className="mb-4 border-orange-500/30 bg-orange-50/40 dark:bg-orange-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🛒 Importar Vitrine Shopee
            </CardTitle>
            <CardDescription>
              Cole o link da sua vitrine de afiliado (ex: collshp.com/sualoja) e importe todos os produtos de uma vez, já com seu link de afiliado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                placeholder="https://collshp.com/sualoja"
                value={vitrineUrl}
                onChange={(e) => setVitrineUrl(e.target.value)}
                disabled={isImporting}
                className="flex-1"
              />
              <Button
                onClick={handleImportarVitrine}
                disabled={!vitrineUrl.trim() || isImporting}
                className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Download className="w-4 h-4" />
                {isImporting ? 'Importando... (pode demorar 1 min)' : 'Importar Vitrine'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Produtos e Vídeos */}
        <Tabs defaultValue="produtos" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="produtos">{t('products.product_tab')}</TabsTrigger>
            <TabsTrigger value="videos">{t('products.video_tab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos">

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              {t('products.filters')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('products.search_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('products.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('products.all_categories')} ({filteredProducts.length})</SelectItem>
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
            <p className="text-muted-foreground">{t('products.loading')}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg mb-4">
                {searchTerm || categoryFilter !== 'all' 
                  ? t('products.no_products_filtered')
                  : t('products.no_products')}
              </p>
              {!searchTerm && categoryFilter === 'all' && (
                <Button onClick={openAddModal} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t('products.add_first')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <React.Fragment key={product.id}>
              <div className="space-y-4">
              <Card className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className="relative">
                      <ProductImageCarousel
                        imagem_url={product.imagem_url}
                        imagens={product.imagens}
                        alt={product.nome}
                      />
                      {product.campanha && product.campanha.total_enviados > 0 && (
                        <div className="absolute -bottom-2 -left-2 bg-black/70 text-white px-2 py-0.5 rounded text-[10px]">
                          📤 {product.campanha.total_enviados}
                        </div>
                      )}
                    </div>
                    
                    {/* BADGES DE STATUS DA CAMPANHA + TOGGLE ATIVAR/PAUSAR */}
                    <div className="flex flex-col items-end gap-2">
                      {product.campanha && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {product.campanha.ativa ? t('products.campaign_active') : t('products.campaign_paused')}
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
                                toast.success(checked ? t('products.campaign_activated') : t('products.campaign_paused_msg'));
                                fetchProducts();
                              } catch (error) {
                                toast.error(t('products.error_campaign'));
                              }
                            }}
                          />
                        </div>
                      )}
                      {product.campanha && product.campanha.ativa && (
                        <Badge className="bg-green-500 text-white text-xs animate-pulse">
                          {t('products.in_campaign')}
                        </Badge>
                      )}
                      <Badge variant={product.ativo ? 'default' : 'secondary'}>
                        {product.ativo ? t('products.active') : t('products.paused')}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-xl">{product.nome}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {product.descricao || t('products.no_description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {product.preco && (
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                      <span className="text-sm font-medium">{t('products.price_label')}</span>
                      <span className="text-2xl font-bold text-primary">
                        R$ {product.preco.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('products.category_label')}</span>
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
                            {t('products.edit_campaign')}
                          </Button>
                          {product.campanha.ativa ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handlePausarCampanha(product)}
                            >
                              {t('products.pause_campaign')}
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => handleRenovarCampanha(product)}
                            >
                              {t('products.renew_campaign')}
                            </Button>
                          )}
                        </div>
                        <Button 
                          variant="outline"
                          size="sm" 
                          className="w-full gap-2 border-primary text-primary hover:bg-primary/10"
                          onClick={() => setDuplicateCards(prev => [...prev, { id: crypto.randomUUID(), product }])}
                        >
                          <Copy className="w-4 h-4" />
                          {t('products.duplicate_campaign')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 bg-gradient-to-r from-blue-600 to-pink-600 text-white hover:from-blue-700 hover:to-pink-700 border-0"
                          onClick={() => { setSimultaneoProduct(product); setIsSimultaneoModalOpen(true); }}
                        >
                          {t('products.publish_now')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                          onClick={() => { setFacebookProduct(product); setIsFacebookModalOpen(true); }}
                        >
                          <Facebook className="w-4 h-4" />
                           {t('products.post_facebook')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-pink-600 border-pink-300 hover:bg-pink-50"
                          onClick={() => { setInstagramProduct(product); setIsInstagramModalOpen(true); }}
                        >
                          <Instagram className="w-4 h-4" />
                          {t('products.post_instagram')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-purple-600 border-purple-300 hover:bg-purple-50"
                          onClick={() => handleGerarReel(product)}
                        >
                          <Video className="w-4 h-4" />
                          🎬 Gerar Reel
                        </Button>
                        {showTikTok && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-foreground border-border hover:bg-muted"
                            onClick={() => handlePostTikTok(product)}
                          >
                            <TikTokIcon className="w-4 h-4" />
                            Post on TikTok
                          </Button>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditModal(product)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            {t('products.edit_product')}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive mr-1" />
                            {t('products.delete')}
                          </Button>
                        </div>
                        {product.campanha.proxima_execucao && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            {t('products.next_send')} {new Date(product.campanha.proxima_execucao).toLocaleString('pt-BR', { 
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
                          {t('products.create_campaign')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 bg-gradient-to-r from-blue-600 to-pink-600 text-white hover:from-blue-700 hover:to-pink-700 border-0"
                          onClick={() => { setSimultaneoProduct(product); setIsSimultaneoModalOpen(true); }}
                        >
                          {t('products.publish_now')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                          onClick={() => { setFacebookProduct(product); setIsFacebookModalOpen(true); }}
                        >
                          <Facebook className="w-4 h-4" />
                           {t('products.post_facebook')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-pink-600 border-pink-300 hover:bg-pink-50"
                          onClick={() => { setInstagramProduct(product); setIsInstagramModalOpen(true); }}
                        >
                          <Instagram className="w-4 h-4" />
                          {t('products.post_instagram')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-purple-600 border-purple-300 hover:bg-purple-50"
                          onClick={() => handleGerarReel(product)}
                        >
                          <Video className="w-4 h-4" />
                          🎬 Gerar Reel
                        </Button>
                        {showTikTok && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-foreground border-border hover:bg-muted"
                            onClick={() => handlePostTikTok(product)}
                          >
                            <TikTokIcon className="w-4 h-4" />
                            Post on TikTok
                          </Button>
                        )}
                        <Button 
                          variant="outline"
                          size="sm" 
                          className="w-full gap-2 border-primary text-primary hover:bg-primary/10"
                          onClick={() => setDuplicateCards(prev => [...prev, { id: crypto.randomUUID(), product }])}
                        >
                          <Copy className="w-4 h-4" />
                          {t('products.duplicate_campaign')}
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditModal(product)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            {t('products.edit')}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive mr-1" />
                            {t('products.delete')}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
              </div>

              {/* CARDS DUPLICAR ao lado no grid */}
              {duplicateCards.filter(dc => dc.product.id === product.id).map(dc => (
                <Card key={dc.id} className="border-primary/40 shadow-lg flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Copy className="h-4 w-4 text-primary" />
                        {t('products.new_campaign')}
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setDuplicateCards(prev => prev.filter(c => c.id !== dc.id))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 flex-1 flex flex-col">
                    <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      {product.imagem_url && (
                        <img src={product.imagem_url} alt={product.nome} className="w-12 h-12 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.nome}</p>
                        {product.preco && (
                          <p className="text-xs text-primary font-bold">R$ {product.preco.toFixed(2)}</p>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {t('products.new_campaign_desc')}
                    </p>

                    <div className="flex-1" />

                    <Button 
                      className="w-full gap-2"
                      onClick={() => handleCreateCampaign(product)}
                    >
                      <Rocket className="w-4 h-4" />
                      {t('products.create_campaign')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              </React.Fragment>
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
           {t('products.checker_active')}
        </div>

          </TabsContent>

          <TabsContent value="videos">
            <AreaVideos />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('products.add_modal_title')}</DialogTitle>
            <DialogDescription>{t('products.add_modal_desc')}</DialogDescription>
          </DialogHeader>
          <ProductForm 
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAddProduct}
            submitLabel={t('products.add_product')}
            setIsAddModalOpen={setIsAddModalOpen}
            setIsEditModalOpen={setIsEditModalOpen}
            imageFile={imageFile}
            setImageFile={setImageFile}
            previewImage={previewImage}
            currentImageUrl={null}
            extraImageFiles={extraImageFiles}
            setExtraImageFiles={setExtraImageFiles}
            existingExtraImages={existingExtraImages}
            setExistingExtraImages={setExistingExtraImages}
            imagensReel={imagensReel}
            setImagensReel={setImagensReel}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('products.edit_modal_title')}</DialogTitle>
            <DialogDescription>{t('products.edit_modal_desc')}</DialogDescription>
          </DialogHeader>
          <ProductForm 
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEditProduct}
            submitLabel={t('products.save_changes')}
            setIsAddModalOpen={setIsAddModalOpen}
            setIsEditModalOpen={setIsEditModalOpen}
            imageFile={imageFile}
            setImageFile={setImageFile}
            previewImage={previewImage}
            currentImageUrl={currentImageUrl}
            setCurrentImageUrl={setCurrentImageUrl}
            extraImageFiles={extraImageFiles}
            setExtraImageFiles={setExtraImageFiles}
            existingExtraImages={existingExtraImages}
            setExistingExtraImages={setExistingExtraImages}
            imagensReel={imagensReel}
            setImagensReel={setImagensReel}
          />
        </DialogContent>
      </Dialog>

      <ImportCSVModal
        isOpen={isImportCSVOpen}
        onClose={() => setIsImportCSVOpen(false)}
        onSuccess={fetchProducts}
      />

      <StockIntegrations
        open={isIntegrationsOpen}
        onClose={() => setIsIntegrationsOpen(false)}
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
      {facebookProduct && (
        <PostarFacebookModal
          open={isFacebookModalOpen}
          onOpenChange={(open) => {
            setIsFacebookModalOpen(open);
            if (!open) setFacebookProduct(null);
          }}
          produto={facebookProduct}
        />
      )}
      {instagramProduct && (
        <PostarInstagramModal
          open={isInstagramModalOpen}
          onOpenChange={(open) => {
            setIsInstagramModalOpen(open);
            if (!open) setInstagramProduct(null);
          }}
          produto={instagramProduct}
        />
      )}
      <AutopilotModal
        open={isAutopilotOpen}
        onOpenChange={setIsAutopilotOpen}
      />
      {reelsProduct && (
        <PublicarReelsModal
          open={isReelsModalOpen}
          onOpenChange={(open) => {
            setIsReelsModalOpen(open);
            if (!open) setReelsProduct(null);
          }}
          produto={reelsProduct}
        />
      )}
      {simultaneoProduct && (
        <PublicarSimultaneoModal
          open={isSimultaneoModalOpen}
          onOpenChange={(open) => {
            setIsSimultaneoModalOpen(open);
            if (!open) setSimultaneoProduct(null);
          }}
          produto={simultaneoProduct}
        />
      )}

      {/* Modal de geração de Reel */}
      <ModalProgressoReel
        progresso={progresso}
        aberto={modalReelAberto}
        onFechar={() => setModalReelAberto(false)}
      />
    </div>
  );
}
