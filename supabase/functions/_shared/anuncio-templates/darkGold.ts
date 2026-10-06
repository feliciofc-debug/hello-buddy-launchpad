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
  ficha?: string[];
  ano?: string | null;
  preco?: string | null;
  precoLabel?: string | null;
  precoReferencia?: string | null;
  precoReferenciaLabel?: string | null;
  precoReferenciaObs?: string | null;
  badge?: string | null;
  telefone?: string | null;
  instagram?: string | null;
  site?: string | null;
  businessName?: string | null;
  fotoDataUrl?: string | null;
  fotoPrecomposed?: boolean;
  logoDataUrl?: string | null;
  logoIsIcon?: boolean;
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

function rgb(hex: string): [number, number, number] {
  const normalized = String(hex || "").replace("#", "");
  const value = /^[0-9a-f]{6}$/i.test(normalized)
    ? Number.parseInt(normalized, 16)
    : 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex: string): number {
  const channels = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] +
    0.0722 * channels[2];
}

export function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) /
    (Math.min(first, second) + 0.05);
}

function mix(hex: string, target: "#FFFFFF" | "#000000", amount: number): string {
  const source = rgb(hex);
  const destination = rgb(target);
  return "#" + source.map((channel, index) =>
    Math.round(channel + (destination[index] - channel) * amount)
      .toString(16).padStart(2, "0")
  ).join("").toUpperCase();
}

export function readableAccent(
  requested: string,
  background = "#08090B",
): {
  detailColor: string;
  textColor: string;
  onAccentColor: string;
  adjusted: boolean;
} {
  const valid = /^#[0-9a-f]{6}$/i.test(requested)
    ? requested.toUpperCase()
    : "#E8B93B";
  let textColor = valid;
  let adjusted = false;
  if (contrastRatio(textColor, background) < 4.5) {
    const target = luminance(background) > 0.45 ? "#000000" : "#FFFFFF";
    for (let step = 1; step <= 10; step++) {
      const candidate = mix(valid, target, step / 10);
      if (contrastRatio(candidate, background) >= 4.5) {
        textColor = candidate;
        adjusted = candidate !== valid;
        break;
      }
    }
  }
  if (contrastRatio(textColor, background) < 4.5) {
    textColor = "#FFFFFF";
    adjusted = true;
  }
  const blackRatio = contrastRatio("#08090B", valid);
  const whiteRatio = contrastRatio("#FFFFFF", valid);
  const onAccentColor = blackRatio >= 4.5 || blackRatio >= whiteRatio
    ? "#08090B"
    : "#FFFFFF";
  return { detailColor: valid, textColor, onAccentColor, adjusted };
}

export function rgba(hex: string, alpha: number): string {
  const h = (hex || "#D4A017").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Foto do produto com escurecimento restrito às bordas. */
function fotoBloco(d: AnuncioData, style: Record<string, unknown>): Node {
  const children: Node[] = [];
  if (d.fotoDataUrl) {
    children.push(img(d.fotoDataUrl, {
      width: "100%",
      height: "100%",
      flexShrink: 0,
    }));
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
  children.push(el("div", {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "10%",
    display: "flex",
    backgroundImage:
      "linear-gradient(180deg, rgba(8,9,11,0.48) 0%, rgba(8,9,11,0) 100%)",
  }));
  children.push(el("div", {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: "14%",
    display: "flex",
    backgroundImage:
      "linear-gradient(0deg, rgba(8,9,11,0.58) 0%, rgba(8,9,11,0) 100%)",
  }));
  children.push(el("div", {
    position: "absolute",
    top: 0,
    left: 0,
    width: "7%",
    height: "100%",
    display: "flex",
    backgroundImage:
      "linear-gradient(90deg, rgba(8,9,11,0.42) 0%, rgba(8,9,11,0) 100%)",
  }));
  children.push(
    el("div", {
      position: "absolute",
      top: 0,
      right: 0,
      width: "7%",
      height: "100%",
      display: "flex",
      backgroundImage:
        "linear-gradient(270deg, rgba(8,9,11,0.42) 0%, rgba(8,9,11,0) 100%)",
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
  const palette = readableAccent(d.accentColor);
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
        color: palette.textColor,
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
        d.subtitulo.toUpperCase().split(/\s*(?:•|\||,)\s*/).filter(Boolean)
          .join(" • ").slice(0, 80),
      ),
    );
  }
  return el("div", { display: "flex", flexDirection: "column" }, children);
}

function itemLinha(item: AnuncioItem, d: AnuncioData, compact: boolean): Node {
  const palette = readableAccent(d.accentColor);
  const children: Node[] = [
    el(
      "div",
      {
        display: "flex",
        width: compact ? 30 : 36,
        height: compact ? 30 : 36,
        borderRadius: 36,
        backgroundColor: rgba(palette.detailColor, 0.16),
        border: `2px solid ${palette.detailColor}`,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      },
      el(
        "div",
        {
          display: "flex",
          color: palette.textColor,
          fontSize: compact ? 19 : 22,
          fontWeight: 900,
          lineHeight: 1,
        },
        "✓",
      ),
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
  const palette = readableAccent(d.accentColor);
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
        backgroundColor: palette.detailColor,
      },
      el(
        "div",
        {
          display: "flex",
          color: palette.onAccentColor,
          fontSize: compact ? 22 : 26,
          fontWeight: 900,
          letterSpacing: 1,
        },
        d.badge.toUpperCase().slice(0, 34),
      ),
    ),
  ];
}

function anoBloco(d: AnuncioData, compact: boolean): Node[] {
  if (!d.ano) return [];
  const palette = readableAccent(d.accentColor);
  return [
    el(
      "div",
      {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: compact ? 9 : 12,
        paddingBottom: compact ? 9 : 12,
        paddingLeft: compact ? 18 : 24,
        paddingRight: compact ? 18 : 24,
        borderRadius: 999,
        backgroundColor: palette.detailColor,
        color: palette.onAccentColor,
        fontSize: compact ? 24 : 30,
        fontWeight: 900,
      },
      d.ano.slice(0, 16),
    ),
  ];
}

function precoBloco(d: AnuncioData, compact: boolean): Node[] {
  if (!d.preco) return [];
  const palette = readableAccent(d.accentColor);
  const children: Node[] = [];
  if (d.precoReferencia) {
    const referenceParts: Node[] = [];
    if (d.precoReferenciaLabel) {
      referenceParts.push(el("div", {
        display: "flex",
        color: "rgba(255,255,255,0.68)",
        fontSize: compact ? 17 : 20,
        fontWeight: 700,
        marginRight: 10,
      }, d.precoReferenciaLabel.toUpperCase().slice(0, 18)));
    }
    referenceParts.push(el("div", {
      display: "flex",
      color: "rgba(255,255,255,0.72)",
      fontSize: compact ? 23 : 28,
      fontWeight: 700,
      textDecoration: "line-through",
    }, d.precoReferencia.slice(0, 24)));
    if (d.precoReferenciaObs) {
      referenceParts.push(el("div", {
        display: "flex",
        color: "rgba(255,255,255,0.58)",
        fontSize: compact ? 15 : 18,
        marginLeft: 10,
      }, `(${d.precoReferenciaObs.slice(0, 30)})`));
    }
    children.push(el("div", {
      display: "flex",
      alignItems: "center",
      marginBottom: 5,
    }, referenceParts));
  }
  if (d.precoLabel) {
    children.push(el(
      "div",
      {
        display: "flex",
        color: rgba("#FFFFFF", 0.65),
        fontSize: compact ? 20 : 23,
        fontWeight: 700,
        letterSpacing: 3,
      },
      d.precoLabel.toUpperCase().slice(0, 24),
    ));
  }
  children.push(el(
      "div",
      {
        display: "flex",
        color: palette.textColor,
        fontSize: d.preco.length > 13 ? (compact ? 46 : 58) : d.preco.length > 10 ? (compact ? 54 : 66) : compact ? 64 : 78,
        whiteSpace: "nowrap",

        fontWeight: 900,
        letterSpacing: -1,
        lineHeight: 1.05,
      },
      d.preco,
    ));
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

export const ANUNCIO_FOOTER_BOXES = {
  feed: {
    logo: { x: 390, y: 902, width: 300, height: 78 },
    contacts: { x: 58, y: 990, width: 964, height: 48 },
  },
  story: {
    logo: { x: 365, y: 1695, width: 350, height: 115 },
    contacts: { x: 68, y: 1825, width: 944, height: 54 },
  },
} as const;

function footerFaixas(d: AnuncioData, formato: AnuncioFormato): Node {
  const boxes = ANUNCIO_FOOTER_BOXES[formato];
  const compact = formato === "feed";
  return el("div", {
    position: "absolute",
    top: 0,
    left: 0,
    width: formato === "feed" ? 1080 : 1080,
    height: formato === "feed" ? 1080 : 1920,
    display: "flex",
  }, [
    el("div", {
      position: "absolute",
      left: boxes.logo.x,
      top: boxes.logo.y,
      width: boxes.logo.width,
      height: boxes.logo.height,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }, logoBloco(d, {
      width: "100%",
      height: "100%",
      maxWidth: boxes.logo.width,
      maxHeight: boxes.logo.height,
    })),
    el("div", {
      position: "absolute",
      left: boxes.contacts.x,
      top: boxes.contacts.y,
      width: boxes.contacts.width,
      height: boxes.contacts.height,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }, rodape(d, { justifyContent: "center" }, compact)),
  ]);
}

// ---------------------------------------------------------------- FEED 1:1
function feed(d: AnuncioData): Node {
  const { width, height } = anuncioSize("feed");
  const itemColumns = d.itens.slice(0, 8).map((item) =>
    el("div", { display: "flex", width: "48%" }, itemLinha(item, d, true))
  );

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
      fotoBloco(d, {
        top: 210,
        left: 48,
        width: width - 96,
        height: 475,
        borderRadius: 28,
      }),
      el("div", {
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height: 8,
        display: "flex",
        backgroundImage: `linear-gradient(90deg, ${d.accentColor}, ${d.primaryColor}, ${d.accentColor})`,
      }),
      el(
        "div",
        {
          position: "absolute",
          top: 44,
          left: 58,
          width: width - 116,
          display: "flex",
          flexDirection: "column",
        },
        [
          el("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-start" }, [
            el("div", { display: "flex", width: d.ano ? "78%" : "100%" }, tituloBloco(d, false)),
            ...anoBloco(d, true),
          ]),
        ],
      ),
      el("div", {
        position: "absolute",
        top: 705,
        left: 58,
        width: 560,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 14,
      }, itemColumns),
      el("div", {
        position: "absolute",
        left: 650,
        top: 705,
        width: 372,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }, [
        el("div", { display: "flex", flexDirection: "column", gap: 10, width: 510 }, [
          ...precoBloco(d, true),
          ...badgeBloco(d, true),
        ]),
      ]),
      footerFaixas(d, "feed"),
    ],
  );
}

// -------------------------------------------------------------- STORY 9:16
function story(d: AnuncioData): Node {
  const { width, height } = anuncioSize("story");
  const itemColumns = d.itens.slice(0, 8).map((item) =>
    el("div", { display: "flex", width: "48%" }, itemLinha(item, d, false))
  );

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
      fotoBloco(d, {
        top: 300,
        left: 54,
        width: width - 108,
        height: 840,
        borderRadius: 34,
      }),
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
          top: 70,
          left: 68,
          width: width - 136,
          display: "flex",
          flexDirection: "column",
        },
        [
          el("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-start" }, [
            el("div", { display: "flex", width: d.ano ? "76%" : "100%" }, tituloBloco(d, true)),
            ...anoBloco(d, false),
          ]),
        ],
      ),
      el("div", {
        position: "absolute",
        top: 1170,
        left: 68,
        width: width - 136,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 22,
      }, itemColumns),
      el("div", {
        position: "absolute",
        left: 68,
        top: 1470,
        width: width - 136,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }, [
        el("div", { display: "flex", flexDirection: "column", gap: 14 }, [
          ...precoBloco(d, false),
          ...badgeBloco(d, false),
        ]),
      ]),
      footerFaixas(d, "story"),
    ],
  );
}

export function buildAnuncio(d: AnuncioData): Node {
  return d.formato === "story" ? story(d) : feed(d);
}
