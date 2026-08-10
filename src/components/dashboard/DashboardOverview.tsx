import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  Users,
  Target,
  Share2,
  Moon,
  ArrowUpRight,
  ArrowDownRight,
  Megaphone,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { DashboardMetrics, DashboardPeriod } from '@/hooks/useDashboardMetrics';

const LABEL_PERIODO: Record<DashboardPeriod, string> = {
  hoje: 'hoje',
  '7d': 'nos últimos 7 dias',
  '30d': 'nos últimos 30 dias',
};

function Variacao({ atual, anterior, sufixo }: { atual: number; anterior: number; sufixo?: string }) {
  if (anterior === 0 && atual === 0) {
    return <span className="text-xs text-muted-foreground">sem histórico</span>;
  }
  const diff = anterior === 0 ? 100 : Math.round(((atual - anterior) / anterior) * 100);
  const positivo = diff >= 0;
  const Icon = positivo ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
      }`}
    >
      <Icon className="w-3 h-3" />
      {positivo ? '+' : ''}
      {diff}
      {sufixo || '%'}
    </span>
  );
}

function KpiCard({
  titulo,
  valor,
  anterior,
  icone: Icone,
  formato,
}: {
  titulo: string;
  valor: number;
  anterior: number;
  icone: typeof Users;
  formato?: 'numero' | 'percentual';
}) {
  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-xl bg-brand/10">
            <Icone className="w-5 h-5 text-brand" />
          </div>
          <Variacao atual={valor} anterior={anterior} />
        </div>
        <p className="text-3xl font-bold tracking-tight">
          {formato === 'percentual' ? `${valor}%` : valor.toLocaleString('pt-BR')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{titulo}</p>
      </CardContent>
    </Card>
  );
}

function VazioAmigavel({ texto, acao, onAcao }: { texto: string; acao?: string; onAcao?: () => void }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center mb-3">
        <Sparkles className="w-5 h-5 text-brand" />
      </div>
      <p className="text-sm text-muted-foreground">{texto}</p>
      {acao && onAcao && (
        <Button variant="link" size="sm" className="mt-1 text-brand" onClick={onAcao}>
          {acao}
        </Button>
      )}
    </div>
  );
}

export default function DashboardOverview({
  metrics,
  period,
}: {
  metrics: DashboardMetrics;
  period: DashboardPeriod;
}) {
  const navigate = useNavigate();
  const temConversas = metrics.porHora.some((h) => h.conversas > 0);
  const funilVazio = metrics.funil.convidados === 0;
  const maxFunil = Math.max(metrics.funil.convidados, 1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          titulo="Conversas atendidas"
          valor={metrics.conversas.valor}
          anterior={metrics.conversas.anterior}
          icone={MessageCircle}
        />
        <KpiCard
          titulo="Leads captados"
          valor={metrics.leads.valor}
          anterior={metrics.leads.anterior}
          icone={Users}
        />
        <KpiCard
          titulo="Taxa de qualificação"
          valor={metrics.qualificacao.valor}
          anterior={metrics.qualificacao.anterior}
          icone={Target}
          formato="percentual"
        />
        <KpiCard
          titulo="Posts publicados"
          valor={metrics.posts.valor}
          anterior={metrics.posts.anterior}
          icone={Share2}
        />
      </div>

      {/* Sua IA trabalhou 24/7 */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Moon className="w-4 h-4 text-brand" />
              Sua IA trabalhou 24/7
            </CardTitle>
            {temConversas && (
              <Badge className="bg-brand/10 text-brand border-brand/20 hover:bg-brand/10">
                {metrics.foraHorarioPct}% das conversas fora do horário comercial
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Conversas por hora {LABEL_PERIODO[period]} (horário de São Paulo)
          </p>
        </CardHeader>
        <CardContent>
          {!temConversas ? (
            <VazioAmigavel texto="Sua IA está começando a trabalhar — as primeiras conversas aparecem aqui." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.porHora} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="hora" tickLine={false} axisLine={false} interval={2} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                  }}
                  formatter={(v: number) => [`${v} mensagens`, '']}
                />
                <Bar dataKey="conversas" radius={[6, 6, 0, 0]}>
                  {metrics.porHora.map((h, i) => (
                    <Cell
                      key={i}
                      fill={h.madrugada ? 'hsl(var(--brand))' : 'hsl(var(--brand) / 0.35)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-4 h-4 text-brand" />
              Funil de captação
            </CardTitle>
            <p className="text-xs text-muted-foreground">Convite enviado → respondeu → qualificado</p>
          </CardHeader>
          <CardContent>
            {funilVazio ? (
              <VazioAmigavel
                texto="Nenhum convite enviado ainda. Convide seus contatos para liberar as campanhas."
                acao="Convidar contatos"
                onAcao={() => navigate('/pj/listas-contatos')}
              />
            ) : (
              <div className="space-y-4">
                {[
                  { nome: 'Convidados', valor: metrics.funil.convidados },
                  { nome: 'Responderam', valor: metrics.funil.responderam },
                  { nome: 'Qualificados', valor: metrics.funil.qualificados },
                ].map((etapa) => (
                  <div key={etapa.nome}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{etapa.nome}</span>
                      <span className="font-semibold">{etapa.valor.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${Math.min(100, (etapa.valor / maxFunil) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">
                  As campanhas só são enviadas para os contatos qualificados.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conteúdo nas redes */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="w-4 h-4 text-brand" />
              Conteúdo nas redes
            </CardTitle>
            <p className="text-xs text-muted-foreground">Publicações {LABEL_PERIODO[period]}</p>
          </CardHeader>
          <CardContent>
            {metrics.redes.length === 0 ? (
              <VazioAmigavel
                texto="Nenhuma publicação neste período — sua IA pode postar por você."
                acao="Criar conteúdo"
                onAcao={() => navigate('/ia-marketing')}
              />
            ) : (
              <div className="space-y-3">
                {metrics.redes.map((r) => (
                  <div
                    key={r.rede}
                    className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{r.rede}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.imagens} imagens · {r.videos} vídeos
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-brand">
                      {r.total.toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
                {metrics.errosPublicacao > 0 && (
                  <p className="text-xs text-destructive">
                    {metrics.errosPublicacao} publicação(ões) falharam neste período.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campanhas recentes */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="w-4 h-4 text-brand" />
            Campanhas recentes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Enviados, falhas e respostas dos seus disparos {LABEL_PERIODO[period]}
          </p>
        </CardHeader>
        <CardContent>
          {metrics.campanhas.length === 0 ? (
            <VazioAmigavel
              texto="Nenhum disparo neste período."
              acao="Criar campanha"
              onAcao={() => navigate('/meus-produtos')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left font-medium py-2">Campanha</th>
                    <th className="text-right font-medium py-2">Enviados</th>
                    <th className="text-right font-medium py-2">Falhas</th>
                    <th className="text-right font-medium py-2">Respostas</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.campanhas.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3">
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.quando).toLocaleDateString('pt-BR')}
                        </p>
                      </td>
                      <td className="text-right font-semibold">{c.enviados}</td>
                      <td className="text-right text-muted-foreground">{c.falhas}</td>
                      <td className="text-right font-semibold text-brand">{c.respostas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
