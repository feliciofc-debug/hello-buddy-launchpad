// Template "Estúdio concessionária" — só jobs de veículo (template-veiculo-estudio).
// Produto AMZ tradicional permanece em templates/produto/Template.tsx.

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
import type { TemplateProdutoProps } from "../produto/Template";
import { framesTemplateProduto } from "../produto/Template";
import { quebrarTituloVeiculo, tamanhoFonteTituloVeiculo, formatPrecoExibicao } from "./texto";

export type TemplateVeiculoEstudioProps = TemplateProdutoProps;

const IMPACTO = 48;
const HEROI = 150;
const FICHA = 150;
const PRECO = 120;
const CTA_F = 140;

const SAFE_TOP = Math.round(1920 * 0.14);
const SAFE_BOTTOM = Math.round(1920 * 0.2);
const LARGURA_CARRO = Math.round(1080 * 0.72);

export const framesTemplateVeiculoEstudio = (props?: TemplateVeiculoEstudioProps) =>
  framesTemplateProduto(props);

const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
};

/** Fundo estúdio neutro — sem glow colorido nem foto desfocada sobre o carro. */
const FundoEstudio: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(180deg, #EEF0F2 0%, #F8F9FA 55%, #F3F4F6 100%)",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "8%",
        right: "8%",
        bottom: SAFE_BOTTOM + 80,
        height: 48,
        borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(17,17,17,0.12) 0%, transparent 72%)",
        filter: "blur(10px)",
      }}
    />
  </AbsoluteFill>
);

const CarroRecortado: React.FC<{
  src: string;
  escala: number;
  y: number;
  largura?: number;
}> = ({ src, escala, y, largura = LARGURA_CARRO }) => (
  <div style={{ position: "relative", transform: `translateY(${y}px) scale(${escala})` }}>
    <Img
      src={src}
      style={{
        width: largura,
        maxHeight: 920,
        objectFit: "contain",
        display: "block",
        filter: "drop-shadow(0 28px 40px rgba(17,17,17,0.18))",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "100%",
        height: 200,
        overflow: "hidden",
        opacity: 0.22,
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 70%)",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 70%)",
      }}
    >
      <Img
        src={src}
        style={{
          width: largura,
          maxHeight: 920,
          objectFit: "contain",
          transform: "scaleY(-1)",
          filter: "blur(2px)",
        }}
      />
    </div>
    <div
      style={{
        position: "absolute",
        left: "14%",
        right: "14%",
        top: "99%",
        height: 36,
        borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(17,17,17,0.2) 0%, transparent 70%)",
        filter: "blur(6px)",
      }}
    />
  </div>
);

const CarroCard: React.FC<{ src: string; escala: number; y: number }> = ({ src, escala, y }) => (
  <div
    style={{
      width: LARGURA_CARRO,
      height: LARGURA_CARRO * 0.75,
      borderRadius: 32,
      overflow: "hidden",
      background: "#fff",
      border: "1px solid #D8DCE0",
      boxShadow: "0 32px 64px rgba(17,17,17,0.12)",
      transform: `translateY(${y}px) scale(${escala})`,
    }}
  >
    <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
);

const Carro: React.FC<{
  produto: TemplateVeiculoEstudioProps["produto"];
  escala: number;
  y: number;
  largura?: number;
}> = ({ produto, escala, y, largura }) =>
  produto.recortado ? (
    <CarroRecortado src={produto.imagemUrl} escala={escala} y={y} largura={largura} />
  ) : (
    <CarroCard src={produto.imagemUrl} escala={escala} y={y} />
  );

const LogoTopo: React.FC<{ logoUrl?: string; marca: string; destaque: string }> = ({
  logoUrl,
  marca,
  destaque,
}) => {
  if (!logoUrl && !marca.trim()) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_TOP - 8,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 5,
      }}
    >
      {logoUrl ? (
        <Img src={logoUrl} style={{ height: 72, maxWidth: 220, objectFit: "contain" }} />
      ) : (
        <div
          style={{
            color: destaque,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -0.5,
          }}
        >
          {marca}
        </div>
      )}
    </div>
  );
};

const CenaImpacto: React.FC<{ p: TemplateVeiculoEstudioProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 22, stiffness: 110 } });
  const c = p.cores;
  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <LogoTopo logoUrl={p.logoUrl} marca={p.marca} destaque={c.destaque} />
      <div style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [80, 0])}px)` }}>
        <Carro produto={p.produto} escala={interpolate(s, [0, 1], [0.92, 1])} y={-20} />
      </div>
    </AbsoluteFill>
  );
};

const CenaHeroi: React.FC<{ p: TemplateVeiculoEstudioProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const float = Math.sin(frame / 26) * 6;
  const c = p.cores;
  const linhas = quebrarTituloVeiculo(p.produto.nome);
  const fontSize = tamanhoFonteTituloVeiculo(linhas);
  const nomeOp = interpolate(frame, [18, 44], [0, 1], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [38, 64], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...font }}>
      <LogoTopo logoUrl={p.logoUrl} marca={p.marca} destaque={c.destaque} />
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP + 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: entrada,
        }}
      >
        <Carro produto={p.produto} escala={1} y={float} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: SAFE_BOTTOM + 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: c.texto,
            fontSize,
            fontWeight: 800,
            letterSpacing: -1.5,
            lineHeight: 1.08,
            opacity: nomeOp,
          }}
        >
          {linhas.map((linha) => (
            <div key={linha}>{linha}</div>
          ))}
        </div>
        {p.produto.subtitulo ? (
          <div
            style={{
              textAlign: "center",
              color: c.suave,
              fontSize: p.produto.subtitulo.length > 40 ? 28 : 32,
              fontWeight: 600,
              lineHeight: 1.25,
              opacity: subOp,
            }}
          >
            {p.produto.subtitulo}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const ChipsDestaque: React.FC<{ bullets: string[]; destaque: string; texto: string }> = ({
  bullets,
  destaque,
  texto,
}) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 14,
      maxWidth: 960,
    }}
  >
    {bullets.map((b) => (
      <div
        key={b}
        style={{
          background: "#FFFFFF",
          border: `2px solid ${destaque}`,
          color: texto,
          fontSize: 30,
          fontWeight: 700,
          padding: "14px 22px",
          borderRadius: 999,
          boxShadow: "0 8px 24px rgba(17,17,17,0.08)",
        }}
      >
        {b}
      </div>
    ))}
  </div>
);

const CenaFicha: React.FC<{ p: TemplateVeiculoEstudioProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const bullets = p.produto.bullets.slice(0, 4);
  const c = p.cores;

  return (
    <AbsoluteFill style={{ ...font }}>
      <LogoTopo logoUrl={p.logoUrl} marca={p.marca} destaque={c.destaque} />
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP + 40,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: entrada,
        }}
      >
        <Carro produto={p.produto} escala={0.94} y={Math.sin(frame / 28) * 4} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 48,
          right: 48,
          bottom: SAFE_BOTTOM + 40,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <ChipsDestaque bullets={bullets} destaque={c.destaque} texto={c.texto} />
      </div>
    </AbsoluteFill>
  );
};

const CenaPreco: React.FC<{ p: TemplateVeiculoEstudioProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entradaPreco = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 140 } });
  const c = p.cores;
  const precoTexto = formatPrecoExibicao(p.produto.preco);

  return (
    <AbsoluteFill style={{ ...font }}>
      <LogoTopo logoUrl={p.logoUrl} marca={p.marca} destaque={c.destaque} />
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP + 50,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Carro produto={p.produto} escala={0.88} y={-20} largura={LARGURA_CARRO} />
      </div>
      {p.produto.precoDe ? (
        <div
          style={{
            position: "absolute",
            bottom: SAFE_BOTTOM + 200,
            left: 0,
            right: 0,
            textAlign: "center",
            color: c.suave,
            fontSize: 38,
            textDecoration: "line-through",
          }}
        >
          {p.produto.precoDe}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          bottom: SAFE_BOTTOM + 80,
          left: 0,
          right: 0,
          textAlign: "center",
          color: c.destaque,
          fontSize: 108,
          fontWeight: 800,
          letterSpacing: -3,
          opacity: Math.min(1, entradaPreco * 1.2),
          transform: `scale(${interpolate(entradaPreco, [0, 1], [0.88, 1])})`,
        }}
      >
        {precoTexto}
      </div>
    </AbsoluteFill>
  );
};

const CenaCTA: React.FC<{ p: TemplateVeiculoEstudioProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const texto = interpolate(frame, [16, 42], [0, 1], { extrapolateRight: "clamp" });
  const c = p.cores;
  const pulse = 1 + Math.sin(frame / 8) * 0.015;

  return (
    <AbsoluteFill style={{ ...font, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 240,
          height: 240,
          borderRadius: 32,
          background: "#FFFFFF",
          border: `3px solid ${c.destaque}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logo})`,
          boxShadow: "0 32px 64px rgba(17,17,17,0.12)",
          overflow: "hidden",
        }}
      >
        {p.logoUrl ? (
          <Img src={p.logoUrl} style={{ width: 200, height: 200, objectFit: "contain" }} />
        ) : (
          <div style={{ color: c.destaque, fontSize: 36, fontWeight: 800, textAlign: "center", padding: 16 }}>
            {p.marca}
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 36,
          padding: "0 72px",
          color: c.texto,
          fontSize: 56,
          fontWeight: 800,
          textAlign: "center",
          lineHeight: 1.12,
          opacity: texto,
        }}
      >
        {p.marca}
      </div>
      <div
        style={{
          marginTop: 28,
          padding: "0 72px",
          color: c.texto,
          fontSize: 52,
          fontWeight: 800,
          textAlign: "center",
          opacity: texto,
        }}
      >
        {p.cta.frase}
      </div>
      {p.cta.telefone ? (
        <div
          style={{
            marginTop: 32,
            background: c.destaque,
            color: "#FFFFFF",
            fontSize: 36,
            fontWeight: 800,
            padding: "18px 36px",
            borderRadius: 20,
            opacity: texto,
            transform: `scale(${pulse})`,
          }}
        >
          {p.cta.telefone}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const LinhaLegenda: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...font, justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: SAFE_BOTTOM + 20,
          maxWidth: 900,
          textAlign: "center",
          background: "rgba(255,255,255,0.94)",
          border: "1px solid #D8DCE0",
          borderRadius: 20,
          padding: "18px 28px",
          color: "#111111",
          fontSize: 36,
          fontWeight: 600,
          lineHeight: 1.25,
          opacity: o,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const TemplateVeiculoEstudio: React.FC<TemplateVeiculoEstudioProps> = (props) => {
  const { produto, legendas, trilhaUrl } = props;
  const total = framesTemplateVeiculoEstudio(props);
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

  return (
    <AbsoluteFill>
      <FundoEstudio />
      <Series>
        <Series.Sequence durationInFrames={IMPACTO}>
          <CenaImpacto p={props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={HEROI}>
          <CenaHeroi p={props} />
        </Series.Sequence>
        {temFicha ? (
          <Series.Sequence durationInFrames={FICHA}>
            <CenaFicha p={props} />
          </Series.Sequence>
        ) : null}
        {temPreco ? (
          <Series.Sequence durationInFrames={PRECO}>
            <CenaPreco p={props} />
          </Series.Sequence>
        ) : null}
        <Series.Sequence durationInFrames={CTA_F}>
          <CenaCTA p={props} />
        </Series.Sequence>
      </Series>

      {trilhaUrl ? <Audio src={trilhaUrl} loop volume={volumeTrilha} /> : null}

      {legendasValidas.map((text, i) => (
        <Sequence
          key={`${i}-${text}`}
          from={10 + i * passo}
          durationInFrames={Math.max(40, passo - 8)}
        >
          <LinhaLegenda text={text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const PROPS_VEICULO_ESTUDIO_EXEMPLO: TemplateVeiculoEstudioProps = {
  marca: "Minha Revenda",
  nivel: "padrao",
  cores: {
    bg: "#F8F9FA",
    bg2: "#EEF0F2",
    panel: "#FFFFFF",
    line: "#D8DCE0",
    destaque: "#F26B1D",
    destaqueSoft: "#FF8F4D",
    texto: "#111111",
    suave: "#4B5563",
  },
  produto: {
    imagemUrl:
      "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
    recortado: true,
    nome: "Range Rover Evoque",
    subtitulo: "P300 Gasolina",
    bullets: ["64.000 km", "Automático", "2019/2020"],
    preco: "R$ 269.900",
  },
  cta: { frase: "Chama no WhatsApp", telefone: "(21) 98080-4901" },
  legendas: [],
};
