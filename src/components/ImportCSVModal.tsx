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

export default function ImportCSVModal({ isOpen, onClose, onSuccess }: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: number } | null>(null);

  const downloadTemplate = () => {
    const template = `nome,descricao,preco,categoria,sku,link,tags,ativo
Produto Exemplo 1,Descrição do produto 1,99.90,Eletrônicos,SKU001,https://exemplo.com/produto1,"tag1,tag2",true
Produto Exemplo 2,Descrição do produto 2,149.90,Roupas,SKU002,https://exemplo.com/produto2,"tag3,tag4",true`;
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_produtos.csv';
    link.click();
    toast.success('Template baixado com sucesso!');
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const products = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const product: any = {};
      
      headers.forEach((header, index) => {
        if (values[index]) {
          if (header === 'preco') {
            product[header] = parseFloat(values[index].replace(/[^\d.-]/g, ''));
          } else if (header === 'ativo') {
            product[header] = values[index].toLowerCase() === 'true';
          } else if (header === 'tags') {
            product[header] = values[index].split(';').map(t => t.trim()).filter(Boolean);
          } else {
            product[header] = values[index].replace(/^"(.*)"$/, '$1');
          }
        }
      });

      if (product.nome) {
        products.push(product);
      }
    }

    return products;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
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
      const text = await file.text();
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

      for (const product of products) {
        try {
          const { error } = await supabase
            .from('produtos')
            .insert({
              user_id: user.id,
              nome: product.nome,
              descricao: product.descricao || '',
              preco: product.preco || 0,
              categoria: product.categoria || 'Sem categoria',
              sku: product.sku || null,
              link: product.link || null,
              tags: product.tags || [],
              ativo: product.ativo !== false
            });

          if (error) {
            console.error('Erro ao inserir produto:', error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error('Erro ao processar produto:', err);
          errorCount++;
        }
      }

      setResults({ success: successCount, errors: errorCount });
      
      if (successCount > 0) {
        toast.success(`${successCount} produtos importados com sucesso!`);
        onSuccess();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} produtos falharam na importação`);
      }

    } catch (error) {
      console.error('Erro ao processar CSV:', error);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Produtos via CSV
          </DialogTitle>
          <DialogDescription>
            Importe múltiplos produtos de uma vez usando uma planilha CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <strong>Formato do CSV:</strong> nome, descricao, preco, categoria, sku, link, tags, ativo
              <br />
              <strong>Tags:</strong> Separe múltiplas tags com ponto e vírgula (;)
              <br />
              <strong>Ativo:</strong> Use "true" ou "false"
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Modelo CSV
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
                  Arquivo selecionado: {file.name}
                </p>
              )}
            </div>

            {results && (
              <Alert className={results.errors === 0 ? 'border-green-500' : 'border-yellow-500'}>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Resultado da Importação:</strong>
                  <br />
                  ✅ {results.success} produtos importados com sucesso
                  {results.errors > 0 && (
                    <>
                      <br />
                      ❌ {results.errors} produtos com erro
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
