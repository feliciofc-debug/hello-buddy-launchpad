import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ImportCSVAfiliadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportCSVAfiliadoModal({ isOpen, onClose, onSuccess }: ImportCSVAfiliadoModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: number } | null>(null);

  const downloadTemplate = () => {
    const template = `titulo,link_afiliado,marketplace,preco,imagem_url,descricao
iPhone 15 Pro Max,https://amzn.to/abc123,amazon,8999.00,https://exemplo.com/iphone.jpg,Smartphone Apple com chip A17 Pro
Echo Dot 5,https://amzn.to/xyz789,amazon,349.00,https://exemplo.com/echo.jpg,Alexa com som premium
Kindle Paperwhite,https://amzn.to/kindle,amazon,549.00,https://exemplo.com/kindle.jpg,E-reader com luz ajustável
Curso Marketing Digital,https://hotmart.com/produto/123,hotmart,497.00,,Curso completo de marketing digital`;
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_produtos_afiliado.csv';
    link.click();
    toast.success('Template baixado!');
  };

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

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    if (!headers.includes('titulo') || !headers.includes('link_afiliado')) {
      toast.error('Campos obrigatórios: titulo, link_afiliado');
      return [];
    }

    const products = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const product: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index]?.trim().replace(/^["']|["']$/g, '') || '';
        
        if (!value) return;

        if (header === 'preco') {
          const parsed = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'));
          product[header] = isNaN(parsed) ? null : parsed;
        } else {
          product[header] = value;
        }
      });

      if (!product.titulo || !product.link_afiliado) continue;
      
      if (!product.marketplace) product.marketplace = 'outro';

      products.push(product);
    }

    return products;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Selecione um arquivo CSV');
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
      const text = await file.text();
      const products = parseCSV(text);

      if (products.length === 0) {
        toast.error('Nenhum produto válido encontrado');
        setIsProcessing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsProcessing(false);
        return;
      }

      for (const product of products) {
        try {
          const { error } = await supabase
            .from('afiliado_produtos')
            .insert({
              user_id: user.id,
              titulo: product.titulo,
              link_afiliado: product.link_afiliado,
              marketplace: product.marketplace || 'outro',
              preco: product.preco || null,
              imagem_url: product.imagem_url || null,
              descricao: product.descricao || null,
              status: 'ativo'
            });

          if (error) {
            console.error('Erro:', error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error('Erro:', err);
          errorCount++;
        }
      }

      setResults({ success: successCount, errors: errorCount });
      
      if (successCount > 0) {
        toast.success(`${successCount} produtos importados!`);
        onSuccess();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} produtos falharam`);
      }

    } catch (error) {
      console.error('Erro ao processar CSV:', error);
      toast.error('Erro ao processar arquivo');
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Produtos CSV
          </DialogTitle>
          <DialogDescription>
            Importe múltiplos produtos de afiliado via planilha CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <strong>Campos obrigatórios:</strong> titulo, link_afiliado
              <br />
              <strong>Opcionais:</strong> marketplace, preco, imagem_url, descricao
              <br /><br />
              <strong>Marketplaces:</strong> amazon, mercadolivre, shopee, magalu, americanas, hotmart, outro
            </AlertDescription>
          </Alert>

          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Baixar Template CSV
          </Button>

          <div className="space-y-2">
            <Label htmlFor="csv-file">Selecionar Arquivo</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                ✅ {file.name}
              </p>
            )}
          </div>

          {results && (
            <Alert className={results.errors === 0 ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'}>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                ✅ {results.success} importados
                {results.errors > 0 && <> | ❌ {results.errors} com erro</>}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!file || isProcessing}>
              {isProcessing ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
