// ============================================================
// TEMPLATE PARAMÉTRICO — "Produto" (custo zero por render)
//
// Transforma UMA foto de produto num vídeo vertical 1080x1920.
// Todo o visual sai de props (cores, logo, textos, preço), então
// serve qualquer tenant sem código novo.
//
// Dois modos de imagem:
//   recortado = true  -> PNG com fundo transparente (rembg na VPS):
//                        fundo gradiente da marca + sombra + reflexo
//   recortado = false -> fallback: a própria foto desfocada como fundo
//                        e a foto em card à frente (funciona sempre)
//
// FASE 2 (premium/Veo) NÃO entra aqui: quando existir, o clipe de IA
// vira apenas a fonte da cena "herói" (prop `cenaHeroiVideoUrl`), e o
// resto do template continua igual. O campo `nivel` já viaja nas props
// para não precisar refatorar depois.
// ============================================================

import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Series,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../font";
import { ehClaro, fundoLegenda, rgba, textoSobre } from "../agente/contraste";
import type { Paleta } from "../agente/Template";

export type TemplateProdutoProps = {
  marca: string;
  logoUrl?: string;
  site?: string;
  trilhaUrl?: string;
  trilha_volume?: number;
  /** "padrao" hoje; "premium" fica reservado para a fase 2 (IA de vídeo). */
  nivel?: "padrao" | "premium";
  cores: Paleta;
  produto: {
    imagemUrl: string;
    /** true quando o worker recortou o fundo com rembg */
    recortado?: boolean;
    nome: string;
    subtitulo?: string;
    bullets: string[];
    precoDe?: string;
    preco?: string;
    parcelas?: string;
    selo?: string;
  };
  cta: { frase: string; sub?: string; telefone?: string; consultor?: string };
  legendas: string[];
};

// ---------- duração ----------

const IMPACTO = 48;
const HEROI = 150;
const FICHA = 150;
const PRECO = 120;
const CTA_F = 140;

export const framesTemplateProduto = (props?: TemplateProdutoProps) => {
  const temPreco = Boolean(props?.produto?.preco);
  const temFicha = (props?.produto?.bullets?.length ?? 0) > 0;
  // cortes secos: sem sobreposição de cenas, nada a subtrair
  return IMPACTO + HEROI + (temFicha ? FICHA : 0) + (temPreco ? PRECO : 0) + CTA_F;
};

// ---------- peças reutilizáveis ----------

const Fundo: React.FC<{ c: Paleta; imagem?: string; usarImagem?: boolean }> = ({
  c,
  imagem,
  usarImagem,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 110) * 30;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1300px 1000px at 50% 22%, ${c.bg2} 0%, ${c.bg} 62%, ${c.bg} 100%)`,
      }}
    >
      {usarImagem && imagem ? (
        <AbsoluteFill style={{ opacity: 0.5 }}>
          <Img
            src={imagem}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(46px) saturate(1.1)",
              transform: `scale(${1.25 + frame / 9000})`,
            }}
          />
        </AbsoluteFill>
      ) : null}
      {/* luz de destaque atrás do produto */}
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          left: -10 + drift,
          top: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${rgba(c.destaque, ehClaro(c.bg) ? 0.18 : 0.3)} 0%, transparent 66%)`,
          filter: "blur(20px)",
        }}
      />
      {/* vinheta */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, transparent 45%, ${rgba(c.bg, ehClaro(c.bg) ? 0.35 : 0.7)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Produto recortado: sombra projetada + reflexo no chão. */
const ProdutoRecortado: React.FC<{
  c: Paleta;
  src: string;
  escala: number;
  y: number;
  largura?: number;
}> = ({ c, src, escala, y, largura = 820 }) => (
  <div style={{ position: "relative", transform: `translateY(${y}px) scale(${escala})` }}>
    <Img
      src={src}
      style={{
        width: largura,
        maxHeight: 900,
        objectFit: "contain",
        display: "block",
        filter: `drop-shadow(0 40px 60px ${rgba(c.bg, ehClaro(c.bg) ? 0.28 : 0.6)})`,
      }}
    />
    {/* reflexo */}
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "100%",
        height: 260,
        overflow: "hidden",
        opacity: 0.28,
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 72%)",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 72%)",
      }}
    >
      <Img
        src={src}
        style={{
          width: largura,
          maxHeight: 900,
          objectFit: "contain",
          transform: "scaleY(-1)",
          filter: "blur(3px)",
        }}
      />
    </div>
    {/* sombra de contato */}
    <div
      style={{
        position: "absolute",
        left: "12%",
        right: "12%",
        top: "99%",
        height: 46,
        borderRadius: "50%",
        background: `radial-gradient(ellipse at center, ${rgba(c.bg, ehClaro(c.bg) ? 0.3 : 0.75)} 0%, transparent 70%)`,
        filter: "blur(8px)",
      }}
    />
  </div>
);

/** Sem recorte: card com a foto original. Sempre legível. */
const ProdutoCard: React.FC<{ c: Paleta; src: string; escala: number; y: number }> = ({
  c,
  src,
  escala,
  y,
}) => (
  <div
    style={{
      width: 820,
      height: 820,
      borderRadius: 44,
      overflow: "hidden",
      background: c.panel,
      border: `2px solid ${c.line}`,
      boxShadow: `0 50px 110px ${rgba(c.bg, ehClaro(c.bg) ? 0.22 : 0.6)}`,
      transform: `translateY(${y}px) scale(${escala})`,
    }}
  >
    <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
);

const Produto: React.FC<{
  c: Paleta;
  produto: TemplateProdutoProps["produto"];
  escala: number;
  y: number;
  largura?: number;
}> = ({ c, produto, escala, y, largura }) =>
  produto.recortado ? (
    <ProdutoRecortado c={c} src={produto.imagemUrl} escala={escala} y={y} largura={largura} />
  ) : (
    <ProdutoCard c={c} src={produto.imagemUrl} escala={escala} y={y} />
  );

/** Luz varrendo o produto uma vez. */
const Sweep: React.FC<{ inicio: number; duracao?: number }> = ({ inicio, duracao = 40 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [inicio, inicio + duracao], [-40, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame < inicio || frame > inicio + duracao) return null;
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.22) 50%, transparent 60%)",
        transform: `translateX(${p}%)`,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};

// ---------- cenas ----------

const CenaImpacto: React.FC<{ c: Paleta; p: TemplateProdutoProps }> = ({ c, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 22, stiffness: 110 } });
  const blur = interpolate(frame, [0, 26], [26, 0], { extrapolateRight: "clamp" });
  const flash = interpolate(frame, [0, 8, 20], [0.7, 0.25, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div style={{ filter: `blur(${blur}px)`, opacity: s }}>
        <Produto c={c} produto={p.produto} escala={interpolate(s, [0, 1], [1.14, 1])} y={interpolate(s, [0, 1], [140, 40])} largura={720} />
      </div>
      <AbsoluteFill style={{ background: rgba(c.destaqueSoft, flash), pointerEvents: "none" }} />
      {p.produto.selo ? (
        <div
          style={{
            position: "absolute",
            top: 190,
            color: c.suave,
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
            opacity: interpolate(frame, [10, 26], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {p.produto.selo}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const CenaHeroi: React.FC<{ c: Paleta; p: TemplateProdutoProps }> = ({ c, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const zoom = interpolate(frame, [0, HEROI], [1, 1.045]);
  const float = Math.sin(frame / 26) * 8;
  const nome = interpolate(frame, [18, 44], [0, 1], { extrapolateRight: "clamp" });
  const sub = interpolate(frame, [38, 64], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div style={{ marginBottom: 120, opacity: entrada }}>
        <Produto c={c} produto={p.produto} escala={zoom} y={float - 60} />
      </div>
      <Sweep inicio={54} />
      {/* Bloco de texto empilhado: nome e apoio nunca se sobrepõem. */}
      <div
        style={{
          position: "absolute",
          bottom: 220,
          left: 80,
          right: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: c.texto,
            fontSize: p.produto.nome.length > 28 ? 58 : p.produto.nome.length > 22 ? 66 : 82,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1.06,
            opacity: nome,
            transform: `translateY(${interpolate(nome, [0, 1], [34, 0])}px)`,
          }}
        >
          {p.produto.nome}
        </div>
        {p.produto.subtitulo ? (
          <div
            style={{
              textAlign: "center",
              color: c.suave,
              fontSize: p.produto.subtitulo.length > 46 ? 30 : 36,
              lineHeight: 1.3,
              opacity: sub,
            }}
          >
            {p.produto.subtitulo}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const CenaFicha: React.FC<{ c: Paleta; p: TemplateProdutoProps }> = ({ c, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const desloca = spring({ frame, fps, config: { damping: 200 } });
  const bullets = p.produto.bullets.slice(0, 4);

  return (
    <AbsoluteFill style={{ ...font }}>
      <div
        style={{
          position: "absolute",
          left: interpolate(desloca, [0, 1], [180, -70]),
          top: 300,
        }}
      >
        <Produto
          c={c}
          produto={p.produto}
          escala={interpolate(desloca, [0, 1], [1, 0.82])}
          y={Math.sin(frame / 28) * 6}
          largura={720}
        />
      </div>
      <div
        style={{
          position: "absolute",
          right: 70,
          top: 380,
          width: 520,
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        {bullets.map((b, i) => {
          const s = spring({
            frame: frame - (18 + i * 22),
            fps,
            config: { damping: 18, stiffness: 140 },
          });
          return (
            <div
              key={`${i}-${b}`}
              style={{
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [70, 0])}px)`,
                background: rgba(fundoLegenda(c.bg, c.panel), 0.92),
                border: `1px solid ${c.line}`,
                borderLeft: `8px solid ${c.destaque}`,
                borderRadius: 18,
                padding: "22px 24px",
                color: textoSobre(fundoLegenda(c.bg, c.panel)),
                fontSize: 34,
                fontWeight: 600,
                lineHeight: 1.25,
                boxShadow: `0 24px 48px ${rgba(c.bg, ehClaro(c.bg) ? 0.14 : 0.5)}`,
              }}
            >
              {b}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const CenaPreco: React.FC<{ c: Paleta; p: TemplateProdutoProps }> = ({ c, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const escurece = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const selo = spring({ frame: frame - 46, fps, config: { damping: 12, stiffness: 150 } });

  // O preço NUNCA anima de zero: exibimos o valor final desde o primeiro
  // frame (contador partindo de 0 fazia o vídeo anunciar produto de graça).
  const numero = Number(
    String(p.produto.preco ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."),
  );
  const temNumero = Number.isFinite(numero) && numero > 0;
  const precoTexto = temNumero
    ? `R$ ${numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : String(p.produto.preco ?? "");
  const entradaPreco = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 140 } });

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: rgba(c.bg, 0.55 * escurece) }} />
      <div style={{ marginBottom: 40, opacity: 0.95 }}>
        <Produto c={c} produto={p.produto} escala={0.62} y={-180} largura={620} />
      </div>
      {p.produto.precoDe ? (
        <div
          style={{
            position: "absolute",
            bottom: 540,
            color: c.suave,
            fontSize: 40,
            textDecoration: "line-through",
            opacity: interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {p.produto.precoDe}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          bottom: 400,
          color: c.texto,
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -4,
          opacity: Math.min(1, entradaPreco * 1.2),
          transform: `scale(${interpolate(entradaPreco, [0, 1], [0.82, 1])})`,
        }}
      >
        {precoTexto}
      </div>
      {p.produto.parcelas ? (
        <div
          style={{
            position: "absolute",
            bottom: 300,
            transform: `scale(${selo}) rotate(${interpolate(selo, [0, 1], [-8, -3])}deg)`,
            background: `linear-gradient(135deg, ${c.destaque}, ${c.destaqueSoft})`,
            color: textoSobre(c.destaque),
            fontSize: 38,
            fontWeight: 800,
            padding: "16px 30px",
            borderRadius: 16,
            boxShadow: `0 24px 50px ${rgba(c.destaque, 0.35)}`,
          }}
        >
          {p.produto.parcelas}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Placeholder nunca vai para a tela; só logo ou sigla real da marca. */
const ehPlaceholderMarca = (m?: string) =>
  !m || /^(sua marca|sua empresa)$/i.test(m.trim());

const sigla = (nome: string) => {
  const limpo = nome.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (limpo.length <= 12) return limpo;
  const palavras = limpo.split(/\s+/);
  if (palavras.length === 1) return palavras[0].slice(0, 8).toUpperCase();
  return palavras.slice(0, 3).map((x) => x[0]).join("").toUpperCase();
};

const CenaCTA: React.FC<{ c: Paleta; p: TemplateProdutoProps }> = ({ c, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const texto = interpolate(frame, [16, 42], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + Math.sin(frame / 8) * 0.02;
  const marcaTexto = ehPlaceholderMarca(p.marca) ? "" : sigla(p.marca);
  const mostrarBadge = Boolean(p.logoUrl) || marcaTexto.length > 0;

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      {mostrarBadge ? (
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: 52,
          background: p.logoUrl ? c.bg2 : `linear-gradient(135deg, ${c.destaque}, ${c.destaqueSoft})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: p.logoUrl ? c.texto : textoSobre(c.destaque),
          fontSize: marcaTexto.length <= 4 ? 66 : marcaTexto.length <= 8 ? 36 : 26,
          fontWeight: 800,
          textAlign: "center",
          padding: 14,
          overflowWrap: "anywhere",
          transform: `scale(${logo})`,
          boxShadow: `0 40px 90px ${rgba(c.destaque, ehClaro(c.bg) ? 0.18 : 0.32)}`,
        }}
      >
        {p.logoUrl ? (
          <Img src={p.logoUrl} style={{ width: 164, height: 164, objectFit: "contain" }} />
        ) : (
          marcaTexto
        )}
      </div>
      ) : null}
      <div
        style={{
          marginTop: 50,
          padding: "0 80px",
          color: c.texto,
          fontSize: 62,
          fontWeight: 800,
          textAlign: "center",
          letterSpacing: -1.5,
          lineHeight: 1.1,
          opacity: texto,
          transform: `translateY(${interpolate(texto, [0, 1], [28, 0])}px)`,
        }}
      >
        {p.cta.frase}
      </div>
      {p.cta.sub ? (
        <div style={{ marginTop: 24, color: c.suave, fontSize: 36, opacity: texto, textAlign: "center" }}>
          {p.cta.sub}
        </div>
      ) : null}
      {p.cta.telefone ? (
        <div
          style={{
            marginTop: 40,
            background: `linear-gradient(135deg, ${c.destaque}, ${c.destaqueSoft})`,
            color: textoSobre(c.destaque),
            fontSize: 38,
            fontWeight: 800,
            padding: "20px 40px",
            borderRadius: 22,
            opacity: texto,
            transform: `scale(${pulse})`,
          }}
        >
          {p.cta.telefone}
        </div>
      ) : null}
      {p.cta.consultor ? (
        <div style={{ marginTop: 20, color: c.texto, fontSize: 30, fontWeight: 700, opacity: texto }}>
          {p.cta.consultor}
        </div>
      ) : null}
      {p.site ? (
        <div style={{ marginTop: 16, color: c.destaque, fontSize: 34, fontWeight: 700, opacity: texto }}>
          {p.site}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const LinhaLegenda: React.FC<{ c: Paleta; text: string }> = ({ c, text }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const fundo = fundoLegenda(c.bg, c.panel);
  return (
    <AbsoluteFill style={{ ...font, justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 140,
          maxWidth: 900,
          textAlign: "center",
          background: rgba(fundo, 0.92),
          border: `1px solid ${c.line}`,
          borderRadius: 20,
          padding: "18px 28px",
          color: textoSobre(fundo),
          fontSize: 38,
          fontWeight: 600,
          lineHeight: 1.25,
          opacity: o,
          transform: `translateY(${interpolate(o, [0, 1], [16, 0])}px)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// ---------- composição ----------

export const TemplateProduto: React.FC<TemplateProdutoProps> = (props) => {
  const { cores: c, produto, legendas, trilhaUrl } = props;
  const total = framesTemplateProduto(props);
  const temFicha = (produto.bullets?.length ?? 0) > 0;
  const temPreco = Boolean(produto.preco);

  const volumeBase = Math.min(1, Math.max(0, props.trilha_volume ?? 0.28));
  const volumeTrilha = (f: number) => {
    const entrada = interpolate(f, [0, 18], [0, 1], { extrapolateRight: "clamp" });
    const saida = interpolate(f, [total - 45, total], [1, 0], { extrapolateLeft: "clamp" });
    return volumeBase * entrada * saida;
  };

  const legendasValidas = (legendas ?? []).filter((l) => String(l ?? "").trim().length > 0);
  const passo = legendasValidas.length > 0 ? Math.floor((total - 20) / legendasValidas.length) : 0;

  // CORTE SECO entre cenas (sem crossfade). Crossfade mostrava o produto
  // duas vezes ao mesmo tempo, em escalas/posições diferentes — era a
  // "imagem fantasma" que aparecia atrás do produto.
  return (
    <AbsoluteFill>
      <Fundo c={c} imagem={produto.imagemUrl} usarImagem={!produto.recortado} />
      <Series>
        <Series.Sequence durationInFrames={IMPACTO}>
          <CenaImpacto c={c} p={props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={HEROI}>
          <CenaHeroi c={c} p={props} />
        </Series.Sequence>
        {temFicha ? (
          <Series.Sequence durationInFrames={FICHA}>
            <CenaFicha c={c} p={props} />
          </Series.Sequence>
        ) : null}
        {temPreco ? (
          <Series.Sequence durationInFrames={PRECO}>
            <CenaPreco c={c} p={props} />
          </Series.Sequence>
        ) : null}
        <Series.Sequence durationInFrames={CTA_F}>
          <CenaCTA c={c} p={props} />
        </Series.Sequence>
      </Series>

      {trilhaUrl ? <Audio src={trilhaUrl} volume={volumeTrilha} startFrom={0} endAt={total} /> : null}

      {legendasValidas.map((text, i) => (
        <Sequence
          key={`${i}-${text}`}
          from={10 + i * passo}
          durationInFrames={Math.max(40, passo - 8)}
        >
          <LinhaLegenda c={c} text={text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const PROPS_PRODUTO_EXEMPLO: TemplateProdutoProps = {
  marca: "SUA MARCA",
  nivel: "padrao",
  cores: {
    bg: "#0f1720",
    bg2: "#1a2332",
    panel: "#16202c",
    line: "#26313f",
    destaque: "#FF7A1A",
    destaqueSoft: "#ff9e56",
    texto: "#f4f7fb",
    suave: "#93a4b8",
  },
  produto: {
    imagemUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
    recortado: false,
    nome: "Relógio Clássico",
    subtitulo: "Aço escovado, pulseira de couro",
    bullets: ["À prova d'água 50m", "Garantia de 2 anos", "Entrega em 48h"],
    precoDe: "R$ 1.290",
    preco: "899,90",
    parcelas: "12x sem juros",
    selo: "Novidade",
  },
  cta: { frase: "Chame no WhatsApp.", sub: "Estoque limitado", telefone: "(21) 99999-0000" },
  legendas: [
    "Chegou o modelo novo.",
    "Aço escovado e couro legítimo.",
    "Garantia de 2 anos.",
    "Fale com a gente hoje.",
  ],
};
