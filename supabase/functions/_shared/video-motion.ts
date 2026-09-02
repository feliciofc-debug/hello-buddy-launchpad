// ============================================================
// VÍDEO MOTION — roteiro paramétrico do template Remotion.
// Multi-tenant: marca, cores, site e textos saem do contexto do
// próprio cliente (empresa_config / produtos), nunca fixos da AMZ.
//
// O objeto devolvido aqui é EXATAMENTE o `props` do componente
// `template-agente` em remotion/src/templates/agente/Template.tsx.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getTenantBusinessContext } from "./business-context.ts";

export type Mensagem = { de: "dono" | "agente"; texto: string };

export type MotionProps = {
  marca: string;
  /** preenchido pelo backend; nunca vem do usuário para outro tenant */
  logo_path?: string;
  logoUrl?: string;
  site: string;
  cores: {
    bg: string;
    bg2: string;
    panel: string;
    line: string;
    destaque: string;
    destaqueSoft: string;
    texto: string;
    suave: string;
  };
  hook: { kicker: string; linhas: string[]; destaque?: string; sub?: string };
  chat: { titulo: string; tituloDestaque?: string; mensagens: Mensagem[] };
  cta: { frase: string; sub?: string };
  legendas: string[];
};

export const PALETA_PADRAO: MotionProps["cores"] = {
  bg: "#0f1720",
  bg2: "#1a2332",
  panel: "#16202c",
  line: "#26313f",
  destaque: "#FF7A1A",
  destaqueSoft: "#ff9e56",
  texto: "#f4f7fb",
  suave: "#93a4b8",
};

const MODELO = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const limparBruto = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .slice(0, max)
    .trim();

const sigla = (nome: string) => {
  const limpo = nome.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!limpo) return "AMZ";
  const palavras = limpo.split(/\s+/);
  if (palavras.length === 1) return palavras[0].slice(0, 8).toUpperCase();
  return palavras
    .slice(0, 3)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
};

// ---- Proteção do nome da marca -------------------------------------------
// A IA às vezes erra a grafia do nome do cliente ("ADOMICON" em vez de
// "ADEMICON"). Aqui reescrevemos qualquer palavra parecida com um nome
// oficial do tenant pela grafia correta.

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function distancia(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Extrai nomes próprios candidatos (nome do negócio + palavras do tema). */
export function nomesOficiais(nome: string, tema?: string): string[] {
  const out: string[] = [];
  const add = (p: string) => {
    const limpo = p.replace(/[^\p{L}\p{N}]/gu, "");
    if (limpo.length >= 5 && !out.some((o) => semAcento(o) === semAcento(limpo))) out.push(limpo);
  };
  String(nome ?? "").split(/\s+/).forEach(add);
  String(tema ?? "")
    .split(/\s+/)
    .filter((p) => /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(p))
    .forEach(add);
  return out;
}

function corrigirTexto(texto: string, nomes: string[]): string {
  if (!texto || !nomes.length) return texto;
  return texto.replace(/[\p{L}\p{N}]{5,}/gu, (palavra) => {
    const alvo = semAcento(palavra);
    for (const nome of nomes) {
      const ref = semAcento(nome);
      if (alvo === ref) return palavra;
      if (distancia(alvo, ref) <= 2) {
        // preserva o caixa-alta usado pela IA (ex.: "ADOMICON" -> "ADEMICON")
        return palavra === palavra.toUpperCase() ? nome.toUpperCase() : nome;
      }
    }
    return palavra;
  });
}

/** Garante que o objeto vindo da IA (ou do usuário) é renderizável. */
export function normalizarProps(
  bruto: any,
  ctx: { marca: string; site: string; nomes?: string[] },
): MotionProps {
  const nomes = ctx.nomes ?? [];
  const limpar = (s: unknown, max: number) => corrigirTexto(limparBruto(s, max), nomes);

  const mensagensBrutas: any[] = Array.isArray(bruto?.chat?.mensagens) ? bruto.chat.mensagens : [];
  const mensagens: Mensagem[] = mensagensBrutas
    .slice(0, 6)
    .map((m) => ({
      de: m?.de === "agente" ? "agente" : "dono",
      texto: limpar(m?.texto, 110),
    }))
    .filter((m) => m.texto.length > 0);

  const linhas = (Array.isArray(bruto?.hook?.linhas) ? bruto.hook.linhas : [])
    .slice(0, 3)
    .map((l: unknown) => limpar(l, 22))
    .filter(Boolean);

  const legendas = (Array.isArray(bruto?.legendas) ? bruto.legendas : [])
    .slice(0, 6)
    .map((l: unknown) => limpar(l, 64))
    .filter(Boolean);

  const cores = { ...PALETA_PADRAO, ...(bruto?.cores || {}) };
  const marca = limpar(bruto?.marca || ctx.marca, 12) || "AMZ";

  return {
    marca,
    logo_path: typeof bruto?.logo_path === "string" ? bruto.logo_path : undefined,
    logoUrl: typeof bruto?.logoUrl === "string" ? bruto.logoUrl : undefined,
    site: limparBruto(bruto?.site ?? ctx.site, 40),
    cores,
    hook: {
      kicker: limpar(bruto?.hook?.kicker, 28) || marca,
      linhas: linhas.length ? linhas : ["Seu negócio", "no automático."],
      destaque: limpar(bruto?.hook?.destaque, 22) || undefined,
      sub: limpar(bruto?.hook?.sub, 90) || undefined,
    },
    chat: {
      titulo: limpar(bruto?.chat?.titulo, 30) || "Tudo pelo",
      tituloDestaque: limpar(bruto?.chat?.tituloDestaque, 18) || "WhatsApp",
      mensagens: mensagens.length
        ? mensagens
        : [
            { de: "dono", texto: "posta isso hoje às 19h" },
            { de: "agente", texto: "Fechado. Escrevi a legenda e agendei para 19:00." },
          ],
    },
    cta: {
      frase: limpar(bruto?.cta?.frase, 46) || "Fale com a gente.",
      sub: limpar(bruto?.cta?.sub, 60) || undefined,
    },
    legendas: legendas.length ? legendas : linhas.length ? [linhas.join(" ")] : [],
  };
}


/** Duração aproximada em segundos (espelha framesTemplateAgente/30). */
export function duracaoEstimada(props: MotionProps): number {
  const frames = 190 + (40 + Math.max(1, props.chat.mensagens.length) * 52 + 70) + 170 - 60;
  return Math.round((frames / 30) * 10) / 10;
}

/**
 * Gera o roteiro do vídeo com IA a partir do contexto real do tenant.
 * Falha de IA NÃO derruba o fluxo: cai num roteiro base do próprio negócio.
 */
export async function gerarRoteiroMotion(
  sb: SupabaseClient,
  userId: string,
  tema: string,
  opts?: { nomeFallback?: string | null },
): Promise<{ props: MotionProps; legendaPost: string; usouIA: boolean; nomes: string[] }> {
  const ctx = await getTenantBusinessContext(sb, userId, { nomeFallback: opts?.nomeFallback });
  const nome = ctx.nome || "Sua empresa";
  const nomes = nomesOficiais(nome, tema);
  const base = { marca: sigla(nome), site: (ctx.site || "").replace(/^https?:\/\//, ""), nomes };

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const instrucao = `Você escreve roteiros de vídeos verticais (20-25s) para redes sociais.
NEGÓCIO: ${nome}${ctx.segmento ? ` — ${ctx.segmento}` : ""}
${ctx.sobre ? `SOBRE: ${ctx.sobre}\n` : ""}${ctx.diferenciais ? `DIFERENCIAIS: ${ctx.diferenciais}\n` : ""}${ctx.publicoAlvo ? `PÚBLICO: ${ctx.publicoAlvo}\n` : ""}${ctx.produtos.length ? `PRODUTOS: ${ctx.produtos.slice(0, 6).join("; ")}\n` : ""}
TEMA PEDIDO: ${tema}

ATENÇÃO: o nome do negócio e as marcas citadas devem ser escritos EXATAMENTE assim, letra por letra: ${nomes.join(", ") || nome}. Nunca abrevie, traduza ou altere a grafia.


Devolva SOMENTE JSON válido, sem markdown, neste formato:
{
 "hook": {"kicker":"até 24 caracteres","linhas":["até 18 chars","até 18 chars"],"destaque":"até 20 chars","sub":"até 80 chars, pode ter \\n"},
 "chat": {"titulo":"até 24 chars","tituloDestaque":"até 16 chars","mensagens":[{"de":"dono","texto":"até 90 chars"},{"de":"agente","texto":"até 100 chars"}]},
 "cta": {"frase":"até 40 chars","sub":"até 55 chars"},
 "legendas": ["frase curta 1","frase curta 2","frase curta 3","frase curta 4"],
 "legenda_post": "legenda pronta para publicar, 2 a 4 linhas, tom institucional, 6 a 10 hashtags no final"
}
Regras: 4 ou 6 mensagens no chat, alternando dono/agente, linguagem simples de brasileiro real, sem emoji nos textos do vídeo, sem promessa de resultado garantido, sem inventar preço.`;

  if (apiKey) {
    try {
      const r = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODELO,
          messages: [{ role: "user", content: instrucao }],
          response_format: { type: "json_object" },
        }),
      });

      if (!r.ok) {
        const corpo = await r.text();
        console.warn("[video-motion] IA falhou", r.status, corpo.slice(0, 300));
      } else {
        const j = await r.json();
        const txt = j?.choices?.[0]?.message?.content ?? "";
        const bruto = JSON.parse(txt.replace(/^```json|```$/g, "").trim());
        return {
          props: normalizarProps(bruto, base),
          legendaPost: limpar(bruto?.legenda_post, 1200),
          usouIA: true,
        };
      }
    } catch (e) {
      console.warn("[video-motion] roteiro IA erro:", (e as Error).message);
    }
  }

  // Fallback determinístico — ainda personalizado com o nome do negócio.
  const props = normalizarProps(
    {
      hook: {
        kicker: nome.slice(0, 24),
        linhas: [tema.split(/\s+/).slice(0, 2).join(" "), "sem complicação."],
        destaque: "Hoje.",
        sub: ctx.diferenciais?.slice(0, 80) || "Atendimento direto pelo WhatsApp.",
      },
      chat: {
        titulo: "Atendimento pelo",
        tituloDestaque: "WhatsApp",
        mensagens: [
          { de: "dono", texto: `quero saber sobre ${tema.slice(0, 60)}` },
          { de: "agente", texto: "Te explico agora e já deixo tudo agendado." },
          { de: "dono", texto: "pode me mandar as opções?" },
          { de: "agente", texto: "Mandei. Qualquer dúvida, é só responder aqui." },
        ],
      },
      cta: { frase: "Fale com a gente.", sub: nome.slice(0, 55) },
      legendas: [tema.slice(0, 60), "Atendimento pelo WhatsApp.", "Simples e rápido."],
    },
    base,
  );

  return {
    props,
    legendaPost: `${tema}\n\n${nome} — atendimento direto pelo WhatsApp.`,
    usouIA: false,
  };
}
