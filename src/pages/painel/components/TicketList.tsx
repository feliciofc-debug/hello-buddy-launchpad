import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, MessageSquare, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface Ticket {
  id: string;
  cliente_email: string;
  cliente_nome: string | null;
  cliente_phone: string | null;
  assunto: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  categoria: string | null;
  operador_nome: string | null;
  resolucao: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketListProps {
  tickets: Ticket[];
  loading: boolean;
  onSelectTicket: (ticket: Ticket) => void;
  onNewTicket: () => void;
  selectedTicketId?: string;
}

const statusColors: Record<string, string> = {
  aberto: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  em_andamento: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  resolvido: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  fechado: "bg-slate-600/50 text-slate-400 border-slate-500/30",
};

const prioridadeColors: Record<string, string> = {
  urgente: "bg-red-500/20 text-red-400 border-red-500/30",
  alta: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  media: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  baixa: "bg-slate-600/50 text-slate-400 border-slate-500/30",
};

const statusLabels: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em Andamento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export default function TicketList({ tickets, loading, onSelectTicket, onNewTicket, selectedTicketId }: TicketListProps) {
  const [search, setSearch] = useState("");

  const filtered = tickets.filter(
    (t) =>
      t.assunto.toLowerCase().includes(search.toLowerCase()) ||
      t.cliente_email.toLowerCase().includes(search.toLowerCase()) ||
      t.cliente_nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="bg-slate-800 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            Chamados ({tickets.length})
          </CardTitle>
          <Button size="sm" onClick={onNewTicket} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-1" />
            Novo
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar chamado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 overflow-y-auto flex-1">
        {loading ? (
          <p className="text-slate-400 text-sm">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-sm">Nenhum chamado</p>
        ) : (
          filtered.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => onSelectTicket(ticket)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedTicketId === ticket.id
                  ? "bg-blue-600/20 border border-blue-500/40"
                  : "bg-slate-700/50 hover:bg-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">{ticket.assunto}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {ticket.cliente_nome || ticket.cliente_email}
                  </p>
                </div>
                <Badge className={prioridadeColors[ticket.prioridade] || ""}>
                  {ticket.prioridade}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <Badge className={statusColors[ticket.status] || ""}>
                  {statusLabels[ticket.status] || ticket.status}
                </Badge>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
