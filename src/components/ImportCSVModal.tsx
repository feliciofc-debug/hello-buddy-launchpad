import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Todos os campos da tabela produtos
const ALL_PRODUCT_FIELDS = [
  // Básicos
  'nome', 'descricao', 'preco', 'categoria', 'sku', 'estoque',
  // Mídia
  'imagem_url',
  // Técnicos
  'ficha_tecnica', 'informacao_nutricional', 'ingredientes', 'modo_uso', 'beneficios', 'garantia', 'especificacoes',
  // Físicos
  'dimensoes', 'peso', 'cor', 'tamanhos',
  // Links
  'link', 'link_marketplace',
  // Extras
  'tipo', 'brand', 'preparation', 'warranty', 'tags', 'ativo', 'publicar_marketplace'
];

export default function ImportCSVModal({ isOpen, onClose, onSuccess }: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: number } | null>(null);

  const downloadTemplate = () => {
    // Template com campos mais importantes
    const template = `nome,descricao,preco,categoria,sku,estoque,imagem_url,ficha_tecnica,informacao_nutricional,ingredientes,modo_uso,beneficios,garantia,especificacoes,dimensoes,peso,cor,tamanhos,link,link_marketplace,tipo,brand,tags,ativo,publicar_marketplace
iPhone 15 Pro,Smartphone Apple última geração,7999.00,Eletrônicos,IPH001,50,https://exemplo.com/img.jpg,Processador: A17|RAM: 8GB,,,,"Câmera 48MP;Face ID",12 meses,IP68;Cerâmica,14x7x0.8cm,187g,Azul Titânio,256GB;512GB,https://apple.com,https://hotmart.com/link,fisico,Apple,smartphone;apple;iphone,true,true
Whey Protein,Suplemento proteico premium,149.90,Suplementos,WHEY001,100,https://exemplo.com/whey.jpg,,Proteína: 24g|Carbs: 3g,Whey Isolado;Cacau,Misturar com água,"Ganho muscular;Recuperação",6 meses,,15x10x25cm,1kg,,,https://loja.com,digital,GrowthSupp,whey;proteina;suplemento,true,true`;
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_produtos_completo.csv';
    link.click();
    toast.success('Template baixado com sucesso!');
  };

  const parseCSV = (text: string): any[] => {
    console.log('📥 Iniciando parseCSV...');
    console.log('📄 Conteúdo bruto:', text.substring(0, 500) + '...');
    
    const lines = text.split('\n').filter(line => line.trim());
    console.log('📋 Total de linhas:', lines.length);
    
    if (lines.length < 2) {
      console.warn('⚠️ Arquivo vazio ou sem dados');
      return [];
    }

    // Parse headers - normalizar para lowercase e remover espaços
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    console.log('📋 Headers encontrados:', headers);

    // Validar campos obrigatórios
    if (!headers.includes('nome')) {
      console.error('❌ Campo obrigatório "nome" não encontrado');
      toast.error('Campo obrigatório "nome" não encontrado no CSV');
      return [];
    }

    if (!headers.includes('categoria')) {
      console.warn('⚠️ Campo "categoria" não encontrado, usando "Sem categoria"');
    }

    const products = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      console.log(`📝 Processando linha ${i}:`, line.substring(0, 100) + '...');
      
      // Parse CSV considerando campos com vírgulas dentro de aspas
      const values = parseCSVLine(line);
      console.log(`📝 Valores extraídos (${values.length}):`, values);
      
      const product: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index]?.trim().replace(/^["']|["']$/g, '') || '';
        
        if (!value) return;

        // Campos numéricos
        if (header === 'preco') {
          const parsed = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'));
          product[header] = isNaN(parsed) ? 0 : parsed;
        } 
        else if (header === 'estoque') {
          const parsed = parseInt(value.replace(/\D/g, ''));
          product[header] = isNaN(parsed) ? 0 : parsed;
        }
        // Campos booleanos
        else if (header === 'ativo' || header === 'publicar_marketplace') {
          product[header] = value.toLowerCase() === 'true' || value === '1';
        }
        // Campos array (separados por ;)
        else if (header === 'tags') {
          product[header] = value.split(';').map(t => t.trim()).filter(Boolean);
        }
        // Campos de texto normais
        else {
          product[header] = value;
        }
      });

      // Validar campos obrigatórios
      if (!product.nome) {
        console.warn(`⚠️ Linha ${i+1} ignorada: nome vazio`);
        continue;
      }

      // Definir defaults
      if (!product.categoria) product.categoria = 'Sem categoria';
      if (product.ativo === undefined) product.ativo = true;
      if (product.publicar_marketplace === undefined) product.publicar_marketplace = true;
      if (!product.tipo) product.tipo = 'fisico';
      if (!product.estoque) product.estoque = 0;

      console.log(`✅ Produto válido:`, product);
      products.push(product);
    }

    console.log(`📦 Total de produtos processados: ${products.length}`);
    return products;
  };

  // Função auxiliar para parsear linha CSV respeitando aspas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      console.log('📁 Arquivo selecionado:', selectedFile.name, 'Tamanho:', selectedFile.size);
      
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Por favor, selecione um arquivo CSV válido');
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      console.log('📥 Lendo arquivo...');
      const text = await file.text();
      console.log('📄 Arquivo lido, tamanho:', text.length, 'caracteres');
      
      const products = parseCSV(text);

      if (products.length === 0) {
        toast.error('Nenhum produto válido encontrado no arquivo');
        setIsProcessing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsProcessing(false);
        return;
      }

      console.log('👤 User ID:', user.id);
      console.log('📦 Inserindo', products.length, 'produtos...');

      for (const product of products) {
        try {
          const productData = {
            user_id: user.id,
            // Básicos
            nome: product.nome,
            descricao: product.descricao || null,
            preco: product.preco || 0,
            categoria: product.categoria || 'Sem categoria',
            sku: product.sku || null,
            estoque: product.estoque || 0,
            // Mídia
            imagem_url: product.imagem_url || null,
            imagens: [],
            // Técnicos
            ficha_tecnica: product.ficha_tecnica || null,
            informacao_nutricional: product.informacao_nutricional || null,
            ingredientes: product.ingredientes || null,
            modo_uso: product.modo_uso || null,
            beneficios: product.beneficios || null,
            garantia: product.garantia || null,
            especificacoes: product.especificacoes || null,
            // Físicos
            dimensoes: product.dimensoes || null,
            peso: product.peso || null,
            cor: product.cor || null,
            tamanhos: product.tamanhos || null,
            // Links
            link: product.link || null,
            link_marketplace: product.link_marketplace || null,
            // Extras
            tipo: product.tipo || 'fisico',
            brand: product.brand || null,
            preparation: product.preparation || null,
            warranty: product.warranty || null,
            tags: product.tags || [],
            ativo: product.ativo !== false,
            publicar_marketplace: product.publicar_marketplace !== false,
            // Timestamps
            created_at: new Date().toISOString()
          };

          console.log('💾 Inserindo produto:', productData.nome);

          const { error } = await supabase
            .from('produtos')
            .insert(productData);

          if (error) {
            console.error('❌ Erro ao inserir produto:', error);
            errorCount++;
          } else {
            console.log('✅ Produto inserido:', productData.nome);
            successCount++;
          }
        } catch (err) {
          console.error('❌ Erro ao processar produto:', err);
          errorCount++;
        }
      }

      console.log(`📊 Resultado: ${successCount} sucesso, ${errorCount} erros`);
      setResults({ success: successCount, errors: errorCount });
      
      if (successCount > 0) {
        toast.success(`${successCount} produtos importados com sucesso!`);
        onSuccess();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} produtos falharam na importação`);
      }

    } catch (error) {
      console.error('💥 Erro ao processar CSV:', error);
      toast.error('Erro ao processar o arquivo CSV');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Produtos via CSV
          </DialogTitle>
          <DialogDescription>
            Importe múltiplos produtos de uma vez usando uma planilha CSV (28 campos suportados)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <strong>Campos obrigatórios:</strong> nome, categoria
              <br /><br />
              <strong>Campos opcionais:</strong>
              <br />• <strong>Básicos:</strong> descricao, preco, sku, estoque
              <br />• <strong>Mídia:</strong> imagem_url
              <br />• <strong>Técnicos:</strong> ficha_tecnica, informacao_nutricional, ingredientes, modo_uso, beneficios, garantia, especificacoes
              <br />• <strong>Físicos:</strong> dimensoes, peso, cor, tamanhos
              <br />• <strong>Links:</strong> link, link_marketplace
              <br />• <strong>Extras:</strong> tipo, brand, preparation, warranty, tags, ativo, publicar_marketplace
              <br /><br />
              <strong>Dicas:</strong>
              <br />• <strong>Tags:</strong> Separe por ponto e vírgula (;) Ex: "tag1;tag2;tag3"
              <br />• <strong>Booleanos:</strong> Use "true" ou "false"
              <br />• <strong>Tipo:</strong> "fisico" ou "digital"
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Template CSV Completo
            </Button>

            <div className="space-y-2">
              <Label htmlFor="csv-file">Selecionar Arquivo CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  ✅ Arquivo selecionado: {file.name}
                </p>
              )}
            </div>

            {results && (
              <Alert className={results.errors === 0 ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'}>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Resultado da Importação:</strong>
                  <br />
                  ✅ {results.success} produtos importados com sucesso
                  {results.errors > 0 && (
                    <>
                      <br />
                      ❌ {results.errors} produtos com erro (verifique o console)
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || isProcessing}
            >
              {isProcessing ? 'Importando...' : 'Importar Produtos'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
