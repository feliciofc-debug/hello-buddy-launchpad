import ImportContatosPJ from '@/components/pj/ImportContatosPJ';

export default function ContatosWhatsApp() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Importar Contatos WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Extraia contatos dos seus grupos e importe via CSV
          </p>
        </div>
        <ImportContatosPJ />
      </div>
    </div>
  );
}
