import {
  type VehicleCarouselFormat,
  vehicleCarouselLayout,
  type VehicleCarouselSlide,
} from "../vehicle-carousel.ts";

type Node = { type: string; props: Record<string, unknown> };

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

export function buildVehiclePhotoSlide(input: {
  slide: VehicleCarouselSlide;
  format: VehicleCarouselFormat;
  photoDataUrl: string;
  logoDataUrl?: string | null;
  totalSlides: number;
}): Node {
  const layout = vehicleCarouselLayout(input.format);
  const slide = input.slide;
  const textLines = [slide.title, slide.body].filter(Boolean);
  return el(
    "div",
    {
      width: layout.width,
      height: layout.height,
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#151515",
      color: "#FFFFFF",
      fontFamily: "Inter",
      position: "relative",
      overflow: "hidden",
    },
    [
      {
        type: "img",
        props: {
          src: input.photoDataUrl,
          style: {
            width: layout.width,
            height: layout.photoHeight,
            objectFit: "fill",
          },
        },
      },
      el(
        "div",
        {
          width: layout.width,
          height: layout.stripHeight,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: input.format === "square" ? "22px 48px" : "28px 54px",
          backgroundColor: "rgba(9, 9, 10, 0.92)",
          borderTop: "2px solid rgba(255,255,255,0.14)",
        },
        [
          slide.reference
            ? el("div", {
              display: "flex",
              fontSize: 22,
              color: "#D3D3D3",
              textDecoration: "line-through",
              marginBottom: 5,
            }, slide.reference)
            : null,
          el("div", {
            display: "flex",
            fontSize: layout.fontSize,
            lineHeight: 1.12,
            fontWeight: 800,
            letterSpacing: "-0.5px",
          }, textLines[0] || ""),
          textLines[1]
            ? el("div", {
              display: "flex",
              fontSize: Math.max(22, layout.fontSize - 5),
              lineHeight: 1.1,
              fontWeight: 600,
              color: "#E8E8E8",
              marginTop: 6,
            }, textLines[1])
            : null,
        ].filter(Boolean),
      ),
      input.logoDataUrl
        ? el("div", {
          position: "absolute",
          top: 28,
          left: 28,
          width: 210,
          height: 72,
          display: "flex",
          alignItems: "center",
          padding: "9px 14px",
          borderRadius: 12,
          backgroundColor: "rgba(10,10,11,0.72)",
        }, {
          type: "img",
          props: {
            src: input.logoDataUrl,
            style: {
              width: 182,
              height: 54,
              objectFit: "contain",
              objectPosition: "left center",
            },
          },
        })
        : null,
      el("div", {
        position: "absolute",
        top: 34,
        right: 34,
        display: "flex",
        padding: "8px 13px",
        borderRadius: 18,
        backgroundColor: "rgba(10,10,11,0.72)",
        color: "#FFFFFF",
        fontSize: 22,
        fontWeight: 700,
      }, `${slide.number}/${input.totalSlides}`),
    ].filter(Boolean),
  );
}
