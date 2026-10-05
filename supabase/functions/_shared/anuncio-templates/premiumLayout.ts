import {
  type AnuncioData,
  type AnuncioFormato,
  readableAccent,
} from "./darkGold.ts";

export type AnuncioEstilo = "impacto" | "catalogo" | "destaque";
type Node = { type: string; props: Record<string, unknown> };
type Box = { x: number; y: number; width: number; height: number };

export const ANUNCIO_LAYOUT_BOXES: Record<
  AnuncioEstilo,
  Record<AnuncioFormato, { vehicle: Box; text: Box[] }>
> = {
  impacto: {
    feed: {
      vehicle: { x: 48, y: 190, width: 984, height: 510 },
      text: [
        { x: 48, y: 42, width: 984, height: 132 },
        { x: 48, y: 716, width: 984, height: 314 },
      ],
    },
    story: {
      vehicle: { x: 48, y: 270, width: 984, height: 900 },
      text: [
        { x: 48, y: 54, width: 984, height: 190 },
        { x: 48, y: 1190, width: 984, height: 670 },
      ],
    },
  },
  catalogo: {
    feed: {
      vehicle: { x: 48, y: 236, width: 984, height: 420 },
      text: [
        { x: 48, y: 24, width: 984, height: 196 },
        { x: 48, y: 676, width: 984, height: 354 },
      ],
    },
    story: {
      vehicle: { x: 48, y: 350, width: 984, height: 760 },
      text: [
        { x: 48, y: 30, width: 984, height: 294 },
        { x: 48, y: 1136, width: 984, height: 724 },
      ],
    },
  },
  destaque: {
    feed: {
      vehicle: { x: 0, y: 112, width: 1080, height: 470 },
      text: [
        { x: 48, y: 28, width: 984, height: 72 },
        { x: 48, y: 604, width: 984, height: 426 },
      ],
    },
    story: {
      vehicle: { x: 0, y: 150, width: 1080, height: 850 },
      text: [
        { x: 48, y: 36, width: 984, height: 96 },
        { x: 48, y: 1030, width: 984, height: 830 },
      ],
    },
  },
};

function el(
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): Node {
  return {
    type,
    props: { style, ...(children === undefined ? {} : { children }) },
  };
}

function text(
  value: string,
  style: Record<string, unknown>,
): Node {
  return el("div", { display: "flex", ...style }, value);
}

function logo(d: AnuncioData, dark: boolean): Node | null {
  if (d.logoDataUrl) {
    return {
      type: "img",
      props: {
        src: d.logoDataUrl,
        style: {
          width: 220,
          height: 72,
          objectFit: "contain",
          objectPosition: "left center",
        },
      },
    };
  }
  return d.businessName
    ? text(d.businessName.toUpperCase(), {
      color: dark ? "#FFFFFF" : "#151517",
      fontSize: 28,
      fontWeight: 900,
    })
    : null;
}

function yearBadge(d: AnuncioData, accent: string, light: boolean): Node | null {
  return d.ano
    ? text(d.ano, {
      color: light ? "#111113" : "#FFFFFF",
      border: light ? undefined : `3px solid ${accent}`,
      backgroundColor: light ? "#FFFFFF" : "transparent",
      borderRadius: 999,
      padding: "10px 20px",
      fontSize: 27,
      fontWeight: 900,
      whiteSpace: "nowrap",
    })
    : null;
}

function vehicle(d: AnuncioData, box: Box, rounded: boolean): Node {
  const children: Node[] = [];
  if (d.fotoDataUrl) {
    children.push({
      type: "img",
      props: {
        src: d.fotoDataUrl,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center center",
        },
      },
    });
  }
  children.push(el("div", {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: "flex",
    backgroundImage:
      "linear-gradient(180deg,rgba(11,11,12,.48) 0%,transparent 14%,transparent 84%,rgba(11,11,12,.58) 100%)",
  }));
  return el("div", {
    display: "flex",
    position: "absolute",
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    overflow: "hidden",
    borderRadius: rounded ? 24 : 0,
    backgroundColor: "#1A1A1D",
  }, children);
}

function titleBlock(
  d: AnuncioData,
  color: string,
  accent: string,
  maxWidth = 790,
): Node {
  return el("div", {
    display: "flex",
    flexDirection: "column",
    maxWidth,
  }, [
    text(d.titulo.toUpperCase(), {
      color,
      fontSize: d.titulo.length > 28 ? 48 : 62,
      lineHeight: 1,
      fontWeight: 900,
      letterSpacing: -1,
    }),
    ...(d.subtitulo
      ? [text(d.subtitulo.toUpperCase().replace(/\s*[|·]\s*/g, " • "), {
        color: accent,
        marginTop: 12,
        fontSize: 25,
        fontWeight: 700,
      })]
      : []),
  ]);
}

function priceBlock(
  d: AnuncioData,
  colors: { value: string; label: string; reference: string },
  align: "left" | "right" = "left",
): Node | null {
  if (!d.preco && !d.precoReferencia) return null;
  const price = String(d.preco || "");
  return el("div", {
    display: "flex",
    flexDirection: "column",
    alignItems: align === "right" ? "flex-end" : "flex-start",
  }, [
    ...(d.precoReferencia
      ? [text(
        `${d.precoReferenciaLabel ? `${d.precoReferenciaLabel} ` : ""}${d.precoReferencia}${
          d.precoReferenciaObs ? ` (${d.precoReferenciaObs})` : ""
        }`,
        {
          color: colors.reference,
          fontSize: 21,
          textDecoration: "line-through",
          whiteSpace: "nowrap",
        },
      )]
      : []),
    ...(d.preco
      ? [
        text((d.precoLabel || "HOJE").toUpperCase(), {
          color: colors.label,
          fontSize: 22,
          fontWeight: 900,
          marginTop: 4,
        }),
        text(price, {
          color: colors.value,
          fontSize: price.length > 14 ? 44 : price.length > 11 ? 52 : 64,
          fontWeight: 900,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }),
      ]
      : []),
  ]);
}

function contacts(d: AnuncioData, color: string): Node | null {
  const values = [d.telefone, d.instagram, d.site].filter(Boolean);
  return values.length
    ? text(values.join("  •  "), {
      color,
      fontSize: 20,
      fontWeight: 700,
      whiteSpace: "nowrap",
    })
    : null;
}

function items(
  d: AnuncioData,
  style: AnuncioEstilo,
  accent: string,
  dark: boolean,
): Node | null {
  if (!d.itens.length) return null;
  return el("div", {
    display: "flex",
    flexWrap: "wrap",
    gap: style === "catalogo" ? 12 : 14,
    width: "100%",
  }, d.itens.map((item) =>
    el("div", {
      display: "flex",
      alignItems: "center",
      width: style === "catalogo" ? "31%" : style === "destaque" ? "47%" : "auto",
      minWidth: style === "impacto" ? 180 : undefined,
      borderLeft: style === "destaque" ? `5px solid ${accent}` : undefined,
      border: style === "impacto" ? "1px solid #333338" : undefined,
      borderRadius: style === "impacto" ? 30 : 0,
      backgroundColor: style === "impacto" ? "#1A1A1D" : "transparent",
      padding: style === "impacto" ? "11px 18px" : "10px 12px",
      color: dark ? "#FFFFFF" : "#262629",
      fontSize: 20,
      fontWeight: 800,
    }, [
      ...(style === "catalogo"
        ? [el("div", {
          width: 9,
          height: 9,
          borderRadius: 9,
          backgroundColor: accent,
          marginRight: 10,
        })]
        : []),
      item.texto.toUpperCase(),
    ])
  ));
}

export function buildPremiumAnuncio(
  d: AnuncioData,
  style: AnuncioEstilo,
): Node {
  const story = d.formato === "story";
  const layout = ANUNCIO_LAYOUT_BOXES[style][d.formato];
  const light = style === "catalogo";
  const defaults = style === "impacto" ? "#F2B544" : "#F36812";
  const accent = readableAccent(d.accentColor || defaults, light ? "#F4F4F2" : "#101012");
  const detail = /^#[0-9A-F]{6}$/i.test(d.accentColor)
    ? d.accentColor
    : defaults;
  const accentText = accent.textColor;
  const bg = light ? "#F4F4F2" : style === "impacto" ? "#0B0B0C" : "#101012";
  const nodes: Node[] = [
    el("div", {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: bg,
    }),
    vehicle(d, layout.vehicle, style === "catalogo"),
  ];

  if (style === "impacto") {
    nodes.push(
      el("div", {
        position: "absolute", display: "flex", left: 48, right: 48, top: story ? 54 : 42,
        justifyContent: "space-between", alignItems: "flex-start",
      }, [titleBlock(d, "#FFFFFF", accentText), yearBadge(d, detail, false)].filter(Boolean)),
      el("div", {
        position: "absolute", display: "flex", flexDirection: "column",
        left: 48, right: 48, top: story ? 1190 : 716, bottom: story ? 60 : 48,
        justifyContent: "space-between",
      }, [
        items(d, style, detail, true),
        el("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, [
          priceBlock(d, { value: "#FFFFFF", label: accentText, reference: "#A7A7AB" }),
          el("div", { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }, [
            logo(d, true),
            contacts(d, "#D1D1D4"),
          ].filter(Boolean)),
        ].filter(Boolean)),
      ].filter(Boolean)),
    );
  } else if (style === "catalogo") {
    nodes.push(
      el("div", { position: "absolute", display: "flex", top: 0, left: 0, right: 0, height: 10, backgroundColor: detail }),
      el("div", {
        position: "absolute", display: "flex", left: 48, right: 48, top: story ? 30 : 24,
        justifyContent: "space-between", alignItems: "flex-start",
      }, [logo(d, false), yearBadge(d, detail, false)].filter(Boolean)),
      el("div", { position: "absolute", display: "flex", left: 48, top: story ? 135 : 105 }, titleBlock(d, "#18181B", accentText)),
      el("div", {
        position: "absolute", display: "flex", flexDirection: "column",
        left: 48, right: 48, top: story ? 1136 : 676, bottom: story ? 60 : 40,
        justifyContent: "space-between",
      }, [
        items(d, style, detail, false),
        el("div", {
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          borderTop: "2px solid #D5D5D1", paddingTop: 20,
        }, [
          contacts(d, "#55555B"),
          priceBlock(d, { value: "#18181B", label: accentText, reference: "#77777C" }, "right"),
        ].filter(Boolean)),
      ].filter(Boolean)),
    );
  } else {
    nodes.push(
      el("div", {
        position: "absolute", display: "flex", left: 48, right: 48, top: story ? 36 : 28,
        justifyContent: "space-between", alignItems: "center",
      }, [logo(d, true), yearBadge(d, detail, true)].filter(Boolean)),
      el("div", {
        position: "absolute", display: "flex", flexDirection: "column",
        left: 48, right: 48, top: story ? 1030 : 604, bottom: story ? 54 : 42,
      }, [
        titleBlock(d, "#FFFFFF", "#A7A7AD"),
        el("div", { display: "flex", marginTop: story ? 34 : 18 }, items(d, style, detail, true)),
        el("div", {
          display: "flex", marginTop: "auto", marginLeft: 260,
          marginRight: -48, borderRadius: "32px 0 0 32px",
          backgroundColor: detail, padding: "20px 34px",
          justifyContent: "flex-end",
        }, priceBlock(d, { value: accent.onAccentColor, label: accent.onAccentColor, reference: accent.onAccentColor }, "right")),
        el("div", { display: "flex", marginTop: 18 }, contacts(d, "#C8C8CC")),
      ].filter(Boolean)),
    );
  }

  return el("div", {
    position: "relative",
    display: "flex",
    width: 1080,
    height: story ? 1920 : 1080,
    overflow: "hidden",
    fontFamily: "Inter",
    backgroundColor: bg,
  }, nodes);
}
