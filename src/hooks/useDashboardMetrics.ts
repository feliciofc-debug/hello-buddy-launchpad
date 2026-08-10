import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DashboardPeriod = 'hoje' | '7d' | '30d';

export interface DashboardKpi {
  valor: number;
  anterior: number;
}

export interface CampanhaResumo {
  id: string;
  nome: string;
  quando: string;
  enviados: number;
  falhas: number;
  respostas: number;
}

export interface DashboardMetrics {
  conversas: DashboardKpi;
  leads: DashboardKpi;
  qualificacao: DashboardKpi; // percentual
  posts: DashboardKpi;
  porHora: { hora: string; conversas: number; madrugada: boolean }[];
  foraHorarioPct: number;
  funil: { convidados: number; responderam: number; qualificados: number };
  campanhas: CampanhaResumo[];
  redes: { rede: string; total: number; imagens: number; videos: number }[];
  errosPublicacao: number;
  atualizadoEm: Date | null;
}

const EMPTY: DashboardMetrics = {
  conversas: { valor: 0, anterior: 0 },
  leads: { valor: 0, anterior: 0 },
  qualificacao: { valor: 0, anterior: 0 },
  posts: { valor: 0, anterior: 0 },
  porHora: [],
  foraHorarioPct: 0,
  funil: { convidados: 0, responderam: 0, qualificados: 0 },
  campanhas: [],
  redes: [],
  errosPublicacao: 0,
  atualizadoEm: null,
};

const DIAS: Record<DashboardPeriod, number> = { hoje: 1, '7d': 7, '30d': 30 };

function janelas(period: DashboardPeriod) {
  const dias = DIAS[period];
  const fim = new Date();
  const inicio = new Date();
  if (period === 'hoje') {
    inicio.setHours(0, 0, 0, 0);
  } else {
    inicio.setDate(inicio.getDate() - dias);
  }
  const duracao = fim.getTime() - inicio.getTime();
  const inicioAnterior = new Date(inicio.getTime() - duracao);
  return { inicio, fim, inicioAnterior };
}

const digits = (v?: string | null) => (v || '').replace(/\D/g, '');

/** hora local de São Paulo a partir de um timestamp ISO */
function horaSaoPaulo(iso: string): number {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  });
  return parseInt(fmt.format(d), 10) || 0;
}

export function useDashboardMetrics(period: DashboardPeriod) {
  const [data, setData] = useState<DashboardMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setData(EMPTY);
        return;
      }

      const { inicio, fim, inicioAnterior } = janelas(period);
      const desde = inicioAnterior.toISOString();

      const [msgsRes, convRes, membrosRes, leadsRes, ebookRes, enviosRes, postsRes, tiktokRes] =
        await Promise.all([
          supabase
            .from('whatsapp_cloud_messages')
            .select('created_at, direction, sender, conversation_id')
            .eq('user_id', user.id)
            .gte('created_at', desde)
            .order('created_at', { ascending: false })
            .limit(5000),
          supabase
            .from('whatsapp_cloud_conversations')
            .select('id, contact_number')
            .eq('user_id', user.id)
            .limit(2000),
          supabase
            .from('pj_lista_membros')
            .select('opt_in_status, convite_enviado_em, opt_in_em, adicionado_em')
            .eq('user_id', user.id)
            .limit(5000),
          supabase
            .from('jarvis_leads')
            .select('created_at')
            .eq('user_id', user.id)
            .gte('created_at', desde)
            .limit(2000),
          supabase
            .from('tenant_ebook_entregas')
            .select('created_at, status')
            .eq('user_id', user.id)
            .gte('created_at', desde)
            .limit(2000),
          supabase
            .from('historico_envios')
            .select('campanha_id, sucesso, timestamp, whatsapp')
            .eq('user_id', user.id)
            .gte('timestamp', desde)
            .order('timestamp', { ascending: false })
            .limit(5000),
          supabase
            .from('social_posts_queue')
            .select('platform, status, published_at, created_at, video_url')
            .eq('user_id', user.id)
            .gte('created_at', desde)
            .limit(5000),
          supabase
            .from('tiktok_posts')
            .select('created_at, status, content_type')
            .eq('user_id', user.id)
            .gte('created_at', desde)
            .limit(1000),
        ]);

      const dentro = (iso?: string | null) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= inicio.getTime() && t <= fim.getTime();
      };
      const dentroAnterior = (iso?: string | null) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= inicioAnterior.getTime() && t < inicio.getTime();
      };

      // ---------- 1) Conversas atendidas + série por hora ----------
      const msgs = msgsRes.data || [];
      const atendimento = msgs.filter((m) => m.sender !== 'campanha');
      const conversasAtuais = new Set(
        atendimento.filter((m) => dentro(m.created_at)).map((m) => m.conversation_id),
      ).size;
      const conversasAnteriores = new Set(
        atendimento.filter((m) => dentroAnterior(m.created_at)).map((m) => m.conversation_id),
      ).size;

      const horas = Array.from({ length: 24 }, (_, h) => ({
        hora: `${String(h).padStart(2, '0')}h`,
        conversas: 0,
        madrugada: h < 6,
      }));
      let foraHorario = 0;
      let totalHoras = 0;
      atendimento
        .filter((m) => dentro(m.created_at))
        .forEach((m) => {
          const h = horaSaoPaulo(m.created_at);
          horas[h].conversas += 1;
          totalHoras += 1;
          if (h < 8 || h >= 18) foraHorario += 1;
        });

      // ---------- 2) Leads captados ----------
      const leadsJarvis = leadsRes.data || [];
      const entregas = ebookRes.data || [];
      const membros = membrosRes.data || [];
      const leadsValor =
        leadsJarvis.filter((l) => dentro(l.created_at)).length +
        entregas.filter((e) => dentro(e.created_at)).length +
        membros.filter((m) => dentro(m.adicionado_em)).length;
      const leadsAnterior =
        leadsJarvis.filter((l) => dentroAnterior(l.created_at)).length +
        entregas.filter((e) => dentroAnterior(e.created_at)).length +
        membros.filter((m) => dentroAnterior(m.adicionado_em)).length;

      // ---------- 3) Funil / taxa de qualificação ----------
      const convidados = membros.filter((m) => !!m.convite_enviado_em).length;
      const qualificados = membros.filter((m) => m.opt_in_status === 'confirmado').length;
      const recusaram = membros.filter((m) => m.opt_in_status === 'recusado').length;
      const responderam = qualificados + recusaram;
      const taxa = convidados > 0 ? Math.round((qualificados / convidados) * 100) : 0;

      const convidadosPeriodo = membros.filter((m) => dentro(m.convite_enviado_em)).length;
      const qualificadosPeriodo = membros.filter(
        (m) => m.opt_in_status === 'confirmado' && dentro(m.opt_in_em),
      ).length;
      const convidadosAnt = membros.filter((m) => dentroAnterior(m.convite_enviado_em)).length;
      const qualificadosAnt = membros.filter(
        (m) => m.opt_in_status === 'confirmado' && dentroAnterior(m.opt_in_em),
      ).length;
      const taxaPeriodo =
        convidadosPeriodo > 0 ? Math.round((qualificadosPeriodo / convidadosPeriodo) * 100) : taxa;
      const taxaAnterior = convidadosAnt > 0 ? Math.round((qualificadosAnt / convidadosAnt) * 100) : 0;

      // ---------- 4) Campanhas (enviados / falhas / respostas inferidas) ----------
      const conversas = convRes.data || [];
      const telefonePorConversa = new Map(conversas.map((c) => [c.id, digits(c.contact_number)]));
      const inboundPorTelefone = new Map<string, number[]>();
      msgs
        .filter((m) => m.direction === 'inbound')
        .forEach((m) => {
          const tel = telefonePorConversa.get(m.conversation_id);
          if (!tel) return;
          const arr = inboundPorTelefone.get(tel) || [];
          arr.push(new Date(m.created_at).getTime());
          inboundPorTelefone.set(tel, arr);
        });

      const envios = (enviosRes.data || []).filter((e) => dentro(e.timestamp));
      const grupos = new Map<string, { enviados: number; falhas: number; respostas: number; quando: string }>();
      envios.forEach((e) => {
        const key = e.campanha_id || `sem-campanha-${new Date(e.timestamp).toISOString().slice(0, 10)}`;
        const g =
          grupos.get(key) || { enviados: 0, falhas: 0, respostas: 0, quando: e.timestamp as string };
        if (e.sucesso) g.enviados += 1;
        else g.falhas += 1;
        const tel = digits(e.whatsapp);
        const respostas = inboundPorTelefone.get(tel) || [];
        const enviadoEm = new Date(e.timestamp).getTime();
        if (respostas.some((t) => t > enviadoEm)) g.respostas += 1;
        if (new Date(e.timestamp).getTime() > new Date(g.quando).getTime()) g.quando = e.timestamp as string;
        grupos.set(key, g);
      });

      const idsCampanhas = Array.from(grupos.keys()).filter((k) => !k.startsWith('sem-campanha'));
      let nomes = new Map<string, string>();
      if (idsCampanhas.length > 0) {
        const { data: camps } = await supabase
          .from('campanhas_recorrentes')
          .select('id, nome')
          .eq('user_id', user.id)
          .in('id', idsCampanhas);
        nomes = new Map((camps || []).map((c) => [c.id as string, c.nome as string]));
      }

      const campanhas: CampanhaResumo[] = Array.from(grupos.entries())
        .map(([id, g]) => ({
          id,
          nome: nomes.get(id) || (id.startsWith('sem-campanha') ? 'Envios avulsos' : 'Campanha'),
          quando: g.quando,
          enviados: g.enviados,
          falhas: g.falhas,
          respostas: g.respostas,
        }))
        .sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())
        .slice(0, 6);

      // ---------- 5) Posts por rede ----------
      const fila = postsRes.data || [];
      const publicados = fila.filter(
        (p) => p.status === 'publicado' && dentro(p.published_at || p.created_at),
      );
      const publicadosAnt = fila.filter(
        (p) => p.status === 'publicado' && dentroAnterior(p.published_at || p.created_at),
      );
      const tiktok = (tiktokRes.data || []).filter((p) => dentro(p.created_at));
      const tiktokAnt = (tiktokRes.data || []).filter((p) => dentroAnterior(p.created_at));

      const porRede = new Map<string, { total: number; imagens: number; videos: number }>();
      publicados.forEach((p) => {
        const rede = p.platform === 'instagram' ? 'Instagram' : p.platform === 'facebook' ? 'Facebook' : 'TikTok';
        const r = porRede.get(rede) || { total: 0, imagens: 0, videos: 0 };
        r.total += 1;
        if (p.video_url) r.videos += 1;
        else r.imagens += 1;
        porRede.set(rede, r);
      });
      if (tiktok.length > 0) {
        const r = porRede.get('TikTok') || { total: 0, imagens: 0, videos: 0 };
        r.total += tiktok.length;
        r.videos += tiktok.filter((p) => p.content_type !== 'image').length;
        r.imagens += tiktok.filter((p) => p.content_type === 'image').length;
        porRede.set('TikTok', r);
      }

      setData({
        conversas: { valor: conversasAtuais, anterior: conversasAnteriores },
        leads: { valor: leadsValor, anterior: leadsAnterior },
        qualificacao: { valor: taxaPeriodo, anterior: taxaAnterior },
        posts: { valor: publicados.length + tiktok.length, anterior: publicadosAnt.length + tiktokAnt.length },
        porHora: horas,
        foraHorarioPct: totalHoras > 0 ? Math.round((foraHorario / totalHoras) * 100) : 0,
        funil: { convidados, responderam, qualificados },
        campanhas,
        redes: Array.from(porRede.entries()).map(([rede, r]) => ({ rede, ...r })),
        errosPublicacao: fila.filter((p) => p.status === 'erro' && dentro(p.created_at)).length,
        atualizadoEm: new Date(),
      });
    } catch (err) {
      console.error('Erro ao carregar métricas do dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { data, loading, refetch: carregar };
}
