/**
 * Template de ANÚNCIO DE PRODUTO "dark-gold" — render server-side via Satori.
 *
 * Estilo padrão do setor automotivo/repasse (preto + dourado), agnóstico de nicho:
 * a lista de itens é livre (km/ano/dono, m²/quartos, horas de uso, garantia...).
 *
 * REGRA DE OURO: a IA cuida SÓ da foto. Texto, preço, logo e contatos são
 * camadas de template — texto exato, logo idêntica à cadastrada pelo tenant.
 *
 * Satori aceita um subset de CSS; a árvore é montada como objetos { type, props }
 * (sem JSX) para rodar direto no Deno.
 */

export type AnuncioFormato = "feed" | "story";

export interface AnuncioItem {
  /** Texto do item (ex: "38 MIL KM", "ÚNICO DONO") */
  texto: string;
  /** Rótulo curto opcional acima do texto (ex: "RODAGEM") */
  rotulo?: string;
}

export interface AnuncioData {
  titulo: string;
  subtitulo?: string | null;
  itens: AnuncioItem[];
  preco?: string | null;
  precoLabel?: string | null;
  badge?: string | null;
  telefone?: string | null;
  instagram?: string | null;
  site?: string | null;
  businessName?: string | null;
  fotoDataUrl?: string | null;
  logoDataUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  formato: AnuncioFormato;
}

type Node = { type: string; props: Record<string, unknown> };

const FONT_FAMILY = "Inter";

export function anuncioSize(formato: AnuncioFormato) {
  return formato === "story"
    ? { width: 1080, height: 1920 }
    : { width: 1080, height: 1080 };
}

function el(type: string, style: Record<string, unknown>, children?: unknown): Node {
  return { type, props: { style, ...(children !== undefined ? { children } : {}) } };
}

function img(src: string, style: Record<string, unknown>): Node {
  return { type: "img", props: { src, style: { objectFit: "cover", ...style } } };
}

export function rgba(hex: string, alpha: number): string {
  const h = (hex || "#D4A017").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Foto do produto + véu escuro pro texto respirar. */
function fotoBloco(d: AnuncioData, style: Record<string, unknown>, veil: "left" | "bottom"): Node {
  const children: Node[] = [];
  if (d.fotoDataUrl) {
    children.push(img(d.fotoDataUrl, { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }));
  } else {
    children.push(
      el("div", {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundImage: "linear-gradient(135deg, #1A1C20 0%, #0B0C0E 100%)",
      }),
    );
  }
  children.push(
    el("div", {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      backgroundImage:
        veil === "left"
          ? "linear-gradient(90deg, rgba(8,9,11,0.96) 0%, rgba(8,9,11,0.55) 32%, rgba(8,9,11,0.05) 62%, rgba(8,9,11,0.35) 100%)"
          : "linear-gradient(180deg, rgba(8,9,11,0.25) 0%, rgba(8,9,11,0.05) 40%, rgba(8,9,11,0.92) 88%, rgba(8,9,11,1) 100%)",
    }),
  );
  return el("div", { position: "absolute", display: "flex", overflow: "hidden", ...style }, children);
}

function logoBloco(d: AnuncioData, style: Record<string, unknown>): Node[] {
  if (d.logoDataUrl) {
    return [
      {
        type: "img",
        props: {
          src: d.logoDataUrl,
          style: { objectFit: "contain", ...style },
        },
      } as Node,
    ];
  }
  if (!d.businessName) return [];
  return [
    el(
      "div",
      {
        display: "flex",
        color: "#FFFFFF",
        fontSize: 30,
        fontWeight: 900,
        letterSpacing: 2,
        ...style,
      },
      d.businessName.toUpperCase().slice(0, 26),
    ),
  ];
}

function tituloBloco(d: AnuncioData, big: boolean): Node {
  const titulo = d.titulo.toUpperCase().slice(0, 46);
  const fs = big
    ? titulo.length > 26 ? 66 : titulo.length > 18 ? 80 : 92
    : titulo.length > 26 ? 52 : titulo.length > 18 ? 62 : 72;
  const children: Node[] = [
    el("div", {
      display: "flex",
      width: 92,
      height: 8,
      borderRadius: 8,
      backgroundColor: d.accentColor,
      marginBottom: 18,
    }),
    el(
      "div",
      {
        display: "flex",
        color: "#FFFFFF",
        fontSize: fs,
        fontWeight: 900,
        lineHeight: 1.02,
        letterSpacing: -1,
      },
      titulo,
    ),
  ];
  if (d.subtitulo) {
    children.push(
      el(
        "div",
        {
          display: "flex",
          marginTop: 10,
          color: d.accentColor,
          fontSize: big ? 34 : 28,
          fontWeight: 700,
          letterSpacing: 1,
        },
        d.subtitulo.toUpperCase().slice(0, 60),
      ),
    );
  }
  return el("div", { display: "flex", flexDirection: "column" }, children);
}

function itemLinha(item: AnuncioItem, d: AnuncioData, compact: boolean): Node {
  const children: Node[] = [
    el(
      "div",
      {
        display: "flex",
        width: compact ? 30 : 36,
        height: compact ? 30 : 36,
        borderRadius: 36,
        backgroundColor: rgba(d.accentColor, 0.16),
        border: `2px solid ${d.accentColor}`,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      el("div", {
        display: "flex",
        width: compact ? 10 : 12,
        height: compact ? 10 : 12,
        borderRadius: 12,
        backgroundColor: d.accentColor,
      }),
    ),
  ];

  const textos: Node[] = [];
  if (item.rotulo) {
    textos.push(
      el(
        "div",
        {
          display: "flex",
          color: rgba(d.accentColor, 0.9),
          fontSize: compact ? 17 : 19,
          fontWeight: 700,
          letterSpacing: 2,
          marginBottom: 2,
        },
        item.rotulo.toUpperCase().slice(0, 28),
      ),
    );
  }
  textos.push(
    el(
      "div",
      {
        display: "flex",
        color: "#F5F5F5",
        fontSize: compact ? 27 : 31,
        fontWeight: 700,
        lineHeight: 1.15,
      },
      item.texto.toUpperCase().slice(0, 42),
    ),
  );

  children.push(el("div", { display: "flex", flexDirection: "column" }, textos));

  return el(
    "div",
    { display: "flex", alignItems: "center", gap: compact ? 14 : 18 },
    children,
  );
}

function badgeBloco(d: AnuncioData, compact: boolean): Node[] {
  if (!d.badge) return [];
  return [
    el(
      "div",
      {
        display: "flex",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingTop: compact ? 10 : 14,
        paddingBottom: compact ? 10 : 14,
        paddingLeft: 24,
        paddingRight: 24,
        borderRadius: 999,
        backgroundColor: d.accentColor,
      },
      el(
        "div",
        {
          display: "flex",
          color: "#0B0C0E",
          fontSize: compact ? 22 : 26,
          fontWeight: 900,
          letterSpacing: 1,
        },
        d.badge.toUpperCase().slice(0, 34),
      ),
    ),
  ];
}

function precoBloco(d: AnuncioData, compact: boolean): Node[] {
  if (!d.preco) return [];
  const children: Node[] = [
    el(
      "div",
      {
        display: "flex",
        color: rgba("#FFFFFF", 0.65),
        fontSize: compact ? 20 : 23,
        fontWeight: 700,
        letterSpacing: 3,
      },
      (d.precoLabel || "VALOR").toUpperCase().slice(0, 24),
    ),
    el(
      "div",
      {
        display: "flex",
        color: "#FFFFFF",
        fontSize: d.preco.length > 13 ? (compact ? 46 : 58) : d.preco.length > 10 ? (compact ? 54 : 66) : compact ? 64 : 78,
        whiteSpace: "nowrap",

        fontWeight: 900,
        letterSpacing: -1,
        lineHeight: 1.05,
      },
      d.preco,
    ),
  ];
  return [
    el(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        paddingTop: 18,
        paddingBottom: 18,
        paddingLeft: 26,
        paddingRight: 34,
        borderRadius: 20,
        backgroundColor: "rgba(0,0,0,0.62)",
        border: `2px solid ${rgba(d.accentColor, 0.55)}`,
        alignSelf: "flex-start",
      },
      children,
    ),
  ];
}

function contatoChip(texto: string, d: AnuncioData, compact: boolean): Node {
  return el(
    "div",
    {
      display: "flex",
      alignItems: "center",
      paddingTop: compact ? 8 : 10,
      paddingBottom: compact ? 8 : 10,
      paddingLeft: 20,
      paddingRight: 20,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.08)",
      border: `1px solid ${rgba(d.accentColor, 0.45)}`,
    },
    el(
      "div",
      { display: "flex", color: "#FFFFFF", fontSize: compact ? 22 : 25, fontWeight: 700 },
      texto.slice(0, 34),
    ),
  );
}

function rodape(d: AnuncioData, style: Record<string, unknown>, compact: boolean): Node[] {
  const chips: Node[] = [];
  // Sem emoji: a fonte embutida (Inter) não tem glifos de emoji e sairia como quadrado.
  if (d.telefone) chips.push(contatoChip(`Tel. ${d.telefone}`, d, compact));
  if (d.instagram) chips.push(contatoChip(`${d.instagram.startsWith("@") ? d.instagram : "@" + d.instagram}`, d, compact));
  if (d.site) chips.push(contatoChip(d.site, d, compact));

  if (!chips.length) return [];
  return [el("div", { display: "flex", flexWrap: "wrap", gap: 12, ...style }, chips)];
}

// ---------------------------------------------------------------- FEED 1:1
function feed(d: AnuncioData): Node {
  const { width, height } = anuncioSize("feed");
  const panelW = 560;

  const painel: Node[] = [
    tituloBloco(d, false),
    el(
      "div",
      { display: "flex", flexDirection: "column", gap: 14, marginTop: 26 },
      d.itens.slice(0, 8).map((i) => itemLinha(i, d, true)),
    ),
    ...badgeBloco(d, true),
  ];

  return el(
    "div",
    {
      width,
      height,
      display: "flex",
      position: "relative",
      fontFamily: FONT_FAMILY,
      backgroundColor: "#08090B",
    },
    [
      fotoBloco(d, { top: 0, right: 0, width: width - panelW + 200, height }, "left"),
      el("div", {
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height: 8,
        display: "flex",
        backgroundImage: `linear-gradient(90deg, ${d.accentColor}, ${d.primaryColor}, ${d.accentColor})`,
      }),
      // painel de texto
      el(
        "div",
        {
          position: "absolute",
          top: 0,
          left: 0,
          width: panelW,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingTop: 62,
          paddingBottom: 54,
          paddingLeft: 58,
          paddingRight: 34,
        },
        [
          el("div", { display: "flex", flexDirection: "column", gap: 20 }, painel),
          el("div", { display: "flex", flexDirection: "column", gap: 18 }, [
            ...precoBloco(d, true),
            ...rodape(d, {}, true),
          ]),
        ],
      ),
      // logo topo direito
      ...logoBloco(d, {
        position: "absolute",
        top: 44,
        right: 52,
        width: 230,
        height: 92,
      }),
    ],
  );
}

// -------------------------------------------------------------- STORY 9:16
function story(d: AnuncioData): Node {
  const { width, height } = anuncioSize("story");
  const fotoH = 1000;

  return el(
    "div",
    {
      width,
      height,
      display: "flex",
      position: "relative",
      fontFamily: FONT_FAMILY,
      backgroundColor: "#08090B",
    },
    [
      fotoBloco(d, { top: 0, left: 0, width, height: fotoH }, "bottom"),
      el("div", {
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height: 10,
        display: "flex",
        backgroundImage: `linear-gradient(90deg, ${d.accentColor}, ${d.primaryColor}, ${d.accentColor})`,
      }),
      el(
        "div",
        {
          position: "absolute",
          top: fotoH - 210,
          left: 0,
          width,
          height: height - fotoH + 210,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: 40,
          paddingBottom: 60,
          paddingLeft: 72,
          paddingRight: 72,
          gap: 26,
        },
        [
          tituloBloco(d, true),
          el(
            "div",
            { display: "flex", flexDirection: "column", gap: 14 },
            d.itens.slice(0, 7).map((i) => itemLinha(i, d, false)),
          ),
          el("div", { display: "flex", alignItems: "flex-end", gap: 24 }, [
            ...precoBloco(d, false),
            ...badgeBloco(d, false),
          ]),
          ...rodape(d, {}, false),
        ],
      ),
      ...logoBloco(d, {
        position: "absolute",
        top: 60,
        right: 64,
        width: 260,
        height: 104,
      }),
    ],
  );
}

export function buildAnuncio(d: AnuncioData): Node {
  return d.formato === "story" ? story(d) : feed(d);
}
