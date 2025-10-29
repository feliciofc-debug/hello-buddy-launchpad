import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, Edit, Copy, Trash2, Download, Instagram, Facebook, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Content {
  id: string;
  thumbnail: string;
  titulo: string;
  tipo: "Post" | "Story" | "Vídeo";
  redes: string[];
  dataCriacao: string;
  status: "Rascunho" | "Agendado" | "Postado";
  texto?: string;
}

const Biblioteca = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("Todos");
  const [redeFilter, setRedeFilter] = useState<string>("Todas");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [contents, setContents] = useState<Content[]>([]);

  useEffect(() => {
    loadContents();
  }, []);

  const loadContents = () => {
    // Carregar do localStorage (histórico de IA Marketing)
    const history = localStorage.getItem('ia-marketing-history');
    if (history) {
      const historyData = JSON.parse(history);
      const mappedContents: Content[] = historyData.map((item: any) => ({
        id: item.id,
        thumbnail: "/placeholder.svg",
        titulo: item.produto,
        tipo: "Post",
        redes: ["Instagram", "WhatsApp"],
        dataCriacao: new Date(item.date).toLocaleDateString('pt-BR'),
        status: item.status === 'agendado' ? 'Agendado' : item.status === 'postado' ? 'Postado' : 'Rascunho',
        texto: item.posts.instagram
      }));
      setContents(mappedContents);
    }
  };

  const filteredContents = contents.filter(content => {
    const matchSearch = content.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = tipoFilter === "Todos" || content.tipo === tipoFilter;
    const matchRede = redeFilter === "Todas" || content.redes.includes(redeFilter);
    const matchStatus = statusFilter === "Todos" || content.status === statusFilter;
    return matchSearch && matchTipo && matchRede && matchStatus;
  });

  const stats = {
    total: contents.length,
    agendados: contents.filter(c => c.status === "Agendado").length,
    postados: contents.filter(c => c.status === "Postado").length,
    rascunhos: contents.filter(c => c.status === "Rascunho").length,
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredContents.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredContents.map(c => c.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleEdit = (id: string) => {
    toast.info("Edição em desenvolvimento");
  };

  const handleDuplicate = (id: string) => {
    const content = contents.find(c => c.id === id);
    if (content) {
      const newContent = {
        ...content,
        id: Date.now().toString(),
        titulo: `${content.titulo} (Cópia)`,
        status: "Rascunho" as const
      };
      setContents([newContent, ...contents]);
      toast.success("Conteúdo duplicado!");
    }
  };

  const handleDelete = (id: string) => {
    setContents(prev => prev.filter(c => c.id !== id));
    setSelectedItems(prev => prev.filter(i => i !== id));
    toast.success("Conteúdo deletado!");
  };

  const handleScheduleSelected = () => {
    if (selectedItems.length === 0) {
      toast.error("Selecione pelo menos um conteúdo!");
      return;
    }
    toast.info(`${selectedItems.length} conteúdos agendados!`);
  };

  const handleExportCSV = () => {
    toast.info("Exportação em desenvolvimento");
  };

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) {
      toast.error("Selecione pelo menos um conteúdo!");
      return;
    }
    setContents(prev => prev.filter(c => !selectedItems.includes(c.id)));
    setSelectedItems([]);
    toast.success(`${selectedItems.length} conteúdos deletados!`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Agendado": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case "Postado": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "Post": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
      case "Story": return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100";
      case "Vídeo": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Biblioteca de Conteúdo</h1>
          <p className="text-muted-foreground">Gerencie todos os seus conteúdos gerados</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Filtros */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={tipoFilter} onValueChange={setTipoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      <SelectItem value="Post">Posts</SelectItem>
                      <SelectItem value="Story">Stories</SelectItem>
                      <SelectItem value="Vídeo">Vídeos</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={redeFilter} onValueChange={setRedeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Rede" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todas">Todas</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="TikTok">TikTok</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      <SelectItem value="Rascunho">Rascunhos</SelectItem>
                      <SelectItem value="Agendado">Agendados</SelectItem>
                      <SelectItem value="Postado">Postados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Ações em Massa */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedItems.length === filteredContents.length && filteredContents.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm font-medium">Selecionar todos</span>
                  </div>
                  <div className="flex-1" />
                  <Button onClick={handleScheduleSelected} variant="default" size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    Agendar Selecionados
                  </Button>
                  <Button onClick={handleExportCSV} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                  <Button onClick={handleDeleteSelected} variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Deletar Selecionados
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Grid de Conteúdos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContents.map((content) => (
                <Card key={content.id} className="group relative overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox 
                      checked={selectedItems.includes(content.id)}
                      onCheckedChange={() => toggleSelectItem(content.id)}
                    />
                  </div>
                  <CardHeader className="p-0">
                    <div className="aspect-video bg-muted flex items-center justify-center relative">
                      <div className="text-center p-4">
                        <p className="text-sm font-medium line-clamp-3">{content.texto?.substring(0, 100)}...</p>
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="icon" variant="secondary" onClick={() => handleEdit(content.id)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="secondary" onClick={() => handleDuplicate(content.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="destructive" onClick={() => handleDelete(content.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-1">{content.titulo}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getTipoColor(content.tipo)}>{content.tipo}</Badge>
                      <Badge className={getStatusColor(content.status)}>{content.status}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {content.redes.map(rede => (
                        rede === "Instagram" ? <Instagram key={rede} className="h-4 w-4" /> :
                        rede === "Facebook" ? <Facebook key={rede} className="h-4 w-4" /> :
                        null
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{content.dataCriacao}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredContents.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum conteúdo encontrado</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Estatísticas */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Estatísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total de conteúdos:</span>
                  <span className="text-2xl font-bold">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Agendados:</span>
                  <span className="text-xl font-bold text-blue-600">{stats.agendados}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Postados:</span>
                  <span className="text-xl font-bold text-green-600">{stats.postados}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Rascunhos:</span>
                  <span className="text-xl font-bold text-gray-600">{stats.rascunhos}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Biblioteca;
