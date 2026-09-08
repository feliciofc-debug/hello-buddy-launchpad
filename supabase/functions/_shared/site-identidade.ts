// ============================================================
// LEITURA DE IDENTIDADE A PARTIR DA URL — "Camada A" (HTML/CSS).
//
// Nada aqui usa IA e nada aqui inventa cor: tudo é lido do código
// do site. Quando o site não entrega conteúdo (SPA sem HTML, bloqueio
// de robô, timeout), devolvemos o que deu com `parcial: true` e um
// aviso claro — a tela abre os campos para preenchimento manual.
// ============================================================

import { paletaAPartirDe, type CoresVideo } from "./video-cores.ts";

export type IdentidadeSite = {
  url: string;
  dominio: string;
  parcial: boolean;
  avisos: string[];
  nome_empresa: string;
  tagline: string;
  descricao: string;
  segmento_sugerido: string;
  tom_de_voz: string;
  publico_alvo: string;
  diferenciais: string;
  logo_url: string | null;
  fontes: string[];
  cores_detectadas: Array<{ hex: string; peso: number }>;
  paleta: CoresVideo;
  texto_base: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const TEMPO_TOTAL_MS = 20_000;
const MAX_CSS = 5;
const MAX_BYTES = 1_500_000;

async function buscar(url: string, sinal: AbortSignal): Promise<string | null> {
  try {
    const r = await fetch(url, {
      signal: sinal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,text/css,*/*" },
    });
    if (!r.ok) return null;
    const txt = await r.text();
    return txt.slice(0, MAX_BYTES);
  } catch {
    return null;
  }
}

const absoluto = (href: string, base: string): string | null => {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

const semTags = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const meta = (html: string, chave: string): string => {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${chave}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${chave}["']`,
    "i",
  );
  return (html.match(re)?.[1] ?? html.match(re2)?.[1] ?? "").trim();
};

// ---------- cores ----------

const hexOk = (v: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

function normalizar(v: string): string | null {
  let s = v.trim().toLowerCase();
  const rgbm = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgbm) {
    const [r, g, b] = [rgbm[1], rgbm[2], rgbm[3]].map((n) => Math.min(255, Number(n)));
    s = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  if (!hexOk(s)) return null;
  if (s.length === 4) s = "#" + s.slice(1).split("").map((c) => c + c).join("");
  return s;
}

const rgbDe = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function saturacao(hex: string): number {
  const [r, g, b] = rgbDe(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

const brilho = (hex: string) => {
  const [r, g, b] = rgbDe(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
};

const distancia = (a: string, b: string) => {
  const [r1, g1, b1] = rgbDe(a);
  const [r2, g2, b2] = rgbDe(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

/** Peso por ONDE a cor aparece — frequência pura devolveria cinza de borda. */
function pesoDaDeclaracao(seletor: string, propriedade: string): number {
  const s = seletor.toLowerCase();
  const p = propriedade.toLowerCase();

  let peso = 1;
  if (/^background(-color)?$/.test(p)) peso = 6;
  else if (p === "color") peso = 3;
  else if (p === "fill" || p === "stroke") peso = 3;
  else if (p.startsWith("--")) peso = 8; // variável de tema: quase sempre cor de marca
  else if (p.includes("border") || p.includes("outline") || p.includes("shadow")) peso = 0.4;

  if (/(^|[\s.#,>])(header|navbar|topo|hero|banner|masthead)/.test(s)) peso *= 3;
  if (/(btn|button|cta|comprar|primary|primario|principal|brand|marca)/.test(s)) peso *= 3;
  if (/(^|[\s.#,>])a([:.\s,]|$)|link/.test(s)) peso *= 1.6;
  if (/(footer|rodape|cookie|disclaimer|scrollbar|tooltip)/.test(s)) peso *= 0.3;
  if (/^:root|^html|^body/.test(s.trim())) peso *= 2.5;

  return peso;
}

function coresDoCss(css: string, acc: Map<string, number>) {
  const blocos = css.split("}");
  for (const bloco of blocos) {
    const i = bloco.indexOf("{");
    if (i < 0) continue;
    const seletor = bloco.slice(0, i);
    const corpo = bloco.slice(i + 1);
    for (const decl of corpo.split(";")) {
      const j = decl.indexOf(":");
      if (j < 0) continue;
      const prop = decl.slice(0, j).trim();
      const valor = decl.slice(j + 1);
      const achados = valor.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)/g);
      if (!achados) continue;
      const peso = pesoDaDeclaracao(seletor, prop);
      for (const bruto of achados) {
        const cor = normalizar(bruto.slice(0, 7));
        if (!cor) continue;
        acc.set(cor, (acc.get(cor) ?? 0) + peso);
      }
    }
  }
}

function coresInline(html: string, acc: Map<string, number>) {
  const re = /style=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) coresDoCss(`inline{${m[1]}}`, acc);
}

/** Agrupa tons próximos e devolve as 5 cores principais. */
function agrupar(acc: Map<string, number>): Array<{ hex: string; peso: number }> {
  const lista = [...acc.entries()]
    .map(([hex, peso]) => ({ hex, peso }))
    .sort((a, b) => b.peso - a.peso);

  const grupos: Array<{ hex: string; peso: number }> = [];
  for (const c of lista) {
    const perto = grupos.find((g) => distancia(g.hex, c.hex) < 42);
    if (perto) perto.peso += c.peso;
    else grupos.push({ ...c });
    if (grupos.length > 60) break;
  }
  return grupos.sort((a, b) => b.peso - a.peso).slice(0, 5);
}

/** Escolhe fundo (neutro) e destaque (cor viva) a partir das cores lidas. */
function montarPaleta(principais: Array<{ hex: string; peso: number }>): CoresVideo {
  const vivas = principais.filter((c) => saturacao(c.hex) >= 0.25 && brilho(c.hex) > 0.08 && brilho(c.hex) < 0.94);
  const neutras = principais.filter((c) => !vivas.includes(c));

  const destaque = vivas[0]?.hex;
  const fundo = neutras.sort((a, b) => b.peso - a.peso)[0]?.hex;
  const apoio = vivas[1]?.hex;

  return paletaAPartirDe({
    bg: fundo ?? "#ffffff",
    destaque: destaque ?? fundo ?? "#1a2332",
    destaqueSoft: apoio,
  });
}

// ---------- tipografia ----------

function fontesDe(html: string, css: string): string[] {
  const nomes = new Set<string>();

  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>]+)/gi)) {
    for (const f of m[1].matchAll(/family=([^&:]+)/g)) {
      nomes.add(decodeURIComponent(f[1].replace(/\+/g, " ")).trim());
    }
  }

  const alvo = /(^|[\s,{])(body|html|h1|h2|:root)[^{]*\{[^}]*font-family\s*:\s*([^;}]+)/gi;
  for (const m of css.matchAll(alvo)) {
    const primeira = m[3].split(",")[0].replace(/["']/g, "").trim();
    if (primeira && !primeira.startsWith("var(")) nomes.add(primeira);
  }
  if (nomes.size === 0) {
    const qualquer = css.match(/font-family\s*:\s*([^;}]+)/i);
    const primeira = qualquer?.[1].split(",")[0].replace(/["']/g, "").trim();
    if (primeira && !primeira.startsWith("var(")) nomes.add(primeira);
  }

  return [...nomes].filter((n) => n.length > 1 && n.length < 40).slice(0, 4);
}

// ---------- logo ----------

function logoDe(html: string, base: string): string | null {
  const candidatos: string[] = [];

  const og = meta(html, "og:image");
  if (og) candidatos.push(og);

  const icones = [...html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)].map((m) => m[0]);
  const comTamanho = icones
    .map((tag) => ({
      href: tag.match(/href=["']([^"']+)["']/i)?.[1] ?? "",
      tam: Number(tag.match(/sizes=["'](\d+)x/i)?.[1] ?? 0),
      apple: /apple-touch/i.test(tag),
    }))
    .filter((i) => i.href)
    .sort((a, b) => b.tam - a.tam || Number(b.apple) - Number(a.apple));

  const cabecalho = html.match(/<header[\s\S]{0,4000}?<\/header>/i)?.[0] ?? html.slice(0, 6000);
  const imgLogo = [...cabecalho.matchAll(/<img[^>]+>/gi)]
    .map((m) => m[0])
    .find((tag) => /logo|marca|brand/i.test(tag));
  const srcLogo = imgLogo?.match(/(?:data-src|src)=["']([^"']+)["']/i)?.[1];

  if (srcLogo) candidatos.unshift(srcLogo);
  for (const i of comTamanho) candidatos.push(i.href);

  for (const c of candidatos) {
    const url = absoluto(c, base);
    if (url && !url.startsWith("data:")) return url;
  }
  return null;
}

// ---------- texto útil (o que vai para a base do Jarvis) ----------

const LIXO =
  /pol[ií]tica de privacidade|termos de uso|todos os direitos reservados|cookies?|fale conosco|mapa do site|central de ajuda|trabalhe conosco|cnpj|newsletter|entrar|cadastre-se|menu|pular para o conte[uú]do|carregando/i;

function blocosUteis(html: string): string[] {
  const alvo = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");

  const blocos: string[] = [];
  for (const m of alvo.matchAll(/<(h1|h2|h3|p|li)[^>]*>([\s\S]{0,600}?)<\/\1>/gi)) {
    const txt = semTags(m[2]);
    if (txt.length < 25 || txt.length > 400) continue;
    if (LIXO.test(txt)) continue;
    if (!/[a-zà-ú]/i.test(txt)) continue;
    blocos.push(txt);
  }

  const vistos = new Set<string>();
  return blocos.filter((b) => {
    const k = b.slice(0, 60).toLowerCase();
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, 12);
}

const SEGMENTOS: Array<[string, RegExp]> = [
  ["alimentos-bebidas", /supermercado|hortifruti|mercado|padaria|restaurante|bebida|a[çc]ougue|delivery de comida/i],
  ["eletronicos-informatica", /eletr[ôo]nico|inform[áa]tica|notebook|smartphone|tecnologia|software|sistema/i],
  ["produtos-hospitalares", /hospitalar|cl[íi]nica|m[ée]dico|odontol[óo]g|anvisa|sa[úu]de/i],
  ["seguranca-automacao", /seguran[çc]a eletr[ôo]nica|c[âa]mera|alarme|automa[çc][ãa]o|blindagem|blindado/i],
  ["casa-construcao", /constru[çc][ãa]o|material de constru|reforma|m[óo]veis|decora[çc][ãa]o/i],
  ["moda-vestuario", /moda|vestu[áa]rio|roupa|cal[çc]ado|boutique|cole[çc][ãa]o/i],
  ["automotivo", /autom[óo]tiv|ve[íi]culo|carro|concession[áa]ria|pe[çc]as|oficina/i],
  ["pet-shop", /pet ?shop|animal de estima|veterin[áa]ri/i],
  ["beleza-cosmeticos", /beleza|cosm[ée]tico|est[ée]tica|sal[ãa]o|cabelo|maquiagem/i],
  ["esportes-fitness", /academia|fitness|esporte|treino|muscula[çc][ãa]o|suplemento/i],
  ["imoveis", /im[óo]vel|im[óo]veis|imobili[áa]ri|apartamento|corretor/i],
  ["servicos-profissionais", /cons[óo]rcio|advocacia|contabilidade|consultoria|seguros|financeir|agência|assessoria/i],
];

function segmentoDe(texto: string): string {
  for (const [id, re] of SEGMENTOS) if (re.test(texto)) return id;
  return "outros";
}

function tomDeVozDe(texto: string): string {
  const t = texto.toLowerCase();
  const tracos: string[] = [];
  if (/(voc[êe]|a gente|seu|sua)\b/.test(t)) tracos.push("próximo");
  if (/(solu[çc][ãa]o|tecnologia|plataforma|inova|digital)/.test(t)) tracos.push("tecnológico");
  if (/(oferta|promo[çc][ãa]o|desconto|imperd[íi]vel|aproveite)/.test(t)) tracos.push("promocional");
  if (/(especialista|certifica|experi[êe]ncia|tradi[çc][ãa]o|confian[çc]a|seguran[çc]a)/.test(t)) tracos.push("profissional");
  if (/(simples|f[áa]cil|r[áa]pido|pr[áa]tico)/.test(t)) tracos.push("direto");
  if (tracos.length === 0) tracos.push("profissional", "direto");
  return [...new Set(tracos)].slice(0, 4).join(", ");
}

function publicoDe(texto: string): string {
  const m = texto.match(/para\s+(?:quem|empresas|lojistas|cl[íi]nicas|profissionais|fam[íi]lias)[^.]{0,90}\./i);
  return m ? m[0].trim() : "";
}

// ---------- principal ----------

export async function lerIdentidadeDoSite(entrada: string): Promise<IdentidadeSite> {
  const bruto = String(entrada || "").trim();
  const comEsquema = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  const base = new URL(comEsquema);
  const url = base.toString();

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_TOTAL_MS);
  const avisos: string[] = [];

  try {
    // Muitos sites bloqueiam o domínio sem "www" (ou o contrário): tentamos os dois.
    const alternativa = base.hostname.startsWith("www.")
      ? url.replace("://www.", "://")
      : url.replace("://", "://www.");
    let baseEfetiva = url;
    let html = (await buscar(url, controle.signal)) ?? "";
    if (!html) {
      html = (await buscar(alternativa, controle.signal)) ?? "";
      if (html) baseEfetiva = alternativa;
    }
    if (!html) {
      avisos.push("O site não respondeu à leitura (pode estar fora do ar ou bloqueando acesso automático).");
    }

    // CSS: <style> embutido + folhas externas
    let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    const links = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
      .map((m) => m[0].match(/href=["']([^"']+)["']/i)?.[1])
      .filter((h): h is string => !!h)
      .map((h) => absoluto(h, baseEfetiva))
      .filter((u): u is string => !!u && !/fonts\.googleapis/.test(u))
      .slice(0, MAX_CSS);

    const folhas = await Promise.all(links.map((u) => buscar(u, controle.signal)));
    css += "\n" + folhas.filter(Boolean).join("\n");

    const acc = new Map<string, number>();
    coresDoCss(css, acc);
    coresInline(html, acc);
    const principais = agrupar(acc);

    const blocos = blocosUteis(html);
    const titulo = (html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1] ?? "").trim();
    const descricaoMeta = meta(html, "description") || meta(html, "og:description");
    const h1 = semTags(html.match(/<h1[^>]*>([\s\S]{0,300}?)<\/h1>/i)?.[1] ?? "");
    const nomeEmpresa = (meta(html, "og:site_name") || titulo.split(/[|\-–—]/)[0] || base.hostname.replace(/^www\./, "")).trim().slice(0, 60);

    const textoBase = [descricaoMeta, h1, ...blocos].filter(Boolean).join("\n").slice(0, 3000);

    if (principais.length < 2) {
      avisos.push("O site entregou poucas cores no código — provavelmente monta a página por JavaScript.");
    }
    if (textoBase.length < 120) {
      avisos.push("O site entregou pouco texto legível — confira e complete a descrição do negócio à mão.");
    }
    if (!logoDe(html, baseEfetiva)) {
      avisos.push("Não encontrei a logo no site; anexe o arquivo manualmente.");
    }

    clearTimeout(relogio);

    return {
      url,
      dominio: base.hostname.replace(/^www\./, ""),
      parcial: avisos.length > 0,
      avisos,
      nome_empresa: nomeEmpresa,
      tagline: (h1 || titulo).slice(0, 140),
      descricao: (descricaoMeta || blocos[0] || "").slice(0, 600),
      segmento_sugerido: segmentoDe(`${titulo} ${descricaoMeta} ${textoBase}`),
      tom_de_voz: tomDeVozDe(textoBase),
      publico_alvo: publicoDe(textoBase),
      diferenciais: blocos.slice(1, 5).join(" • ").slice(0, 500),
      logo_url: logoDe(html, baseEfetiva),
      fontes: fontesDe(html, css),
      cores_detectadas: principais,
      paleta: montarPaleta(principais),
      texto_base: textoBase,
    };
  } catch (e) {
    clearTimeout(relogio);
    const abortou = (e as Error)?.name === "AbortError";
    avisos.push(
      abortou
        ? "O site demorou mais de 20 segundos para responder."
        : "Não foi possível ler o site automaticamente.",
    );
    return {
      url,
      dominio: base.hostname.replace(/^www\./, ""),
      parcial: true,
      avisos,
      nome_empresa: base.hostname.replace(/^www\./, ""),
      tagline: "",
      descricao: "",
      segmento_sugerido: "outros",
      tom_de_voz: "",
      publico_alvo: "",
      diferenciais: "",
      logo_url: null,
      fontes: [],
      cores_detectadas: [],
      paleta: paletaAPartirDe({}),
      texto_base: "",
    };
  }
}
