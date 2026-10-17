export type GestaoEstoqueVeiculoInput = {
  id: string;
  marca: string;
  preco: number | null;
  status: string;
  created_at?: string | null;
  dataCompra: string | null;
  valorCompra: number | null;
  despesasTotal: number;
};

export type GestaoEstoqueStatusSlice = {
  quantidade: number;
  valorVenda: number;
  valorCusto: number;
};

export type GestaoEstoqueIdadeFaixa = "0-30" | "31-60" | "61-90" | "90+";

export type GestaoEstoqueCustoPendente = {
  quantidade: number;
  valorAnunciado: number;
};

export type GestaoEstoqueSnapshot = {
  totais: {
    quantidade: number;
    valorVenda: number;
    valorCusto: number;
    lucroProjetado: number;
  };
  custoPendente: GestaoEstoqueCustoPendente;
  porStatus: {
    disponivel: GestaoEstoqueStatusSlice;
    reservado: GestaoEstoqueStatusSlice;
  };
  porIdade: Array<{
    faixa: GestaoEstoqueIdadeFaixa;
    quantidade: number;
    valorVenda: number;
    valorCusto: number;
  }>;
  porMarca: Array<{
    marca: string;
    quantidade: number;
    valorVenda: number;
  }>;
};

const FAIXAS: GestaoEstoqueIdadeFaixa[] = ["0-30", "31-60", "61-90", "90+"];

const EMPTY_SLICE: GestaoEstoqueStatusSlice = {
  quantidade: 0,
  valorVenda: 0,
  valorCusto: 0,
};

function isActiveStockStatus(status: string): boolean {
  return status === "disponivel" || status === "reservado";
}

export function daysInStock(
  dataCompra: string | null,
  createdAt: string | null | undefined,
  nowMs = Date.now(),
): number {
  const ref = dataCompra || (createdAt ? createdAt.slice(0, 10) : null);
  if (!ref) return 0;
  const start = Date.parse(ref);
  if (!Number.isFinite(start)) return 0;
  const diff = Math.floor((nowMs - start) / 86400000);
  return diff >= 0 ? diff : 0;
}

export function gestaoEstoqueIdadeFaixa(days: number): GestaoEstoqueIdadeFaixa {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function hasCompra(v: GestaoEstoqueVeiculoInput): boolean {
  return v.valorCompra != null;
}

function investido(v: GestaoEstoqueVeiculoInput): number {
  if (!hasCompra(v)) return 0;
  return (v.valorCompra as number) + (v.despesasTotal ?? 0);
}

function venda(v: GestaoEstoqueVeiculoInput): number {
  return v.preco ?? 0;
}

export function buildGestaoEstoqueSnapshot(
  vehicles: GestaoEstoqueVeiculoInput[],
  nowMs = Date.now(),
): GestaoEstoqueSnapshot {
  const active = vehicles.filter((v) => isActiveStockStatus(v.status));

  const porStatus = {
    disponivel: { ...EMPTY_SLICE },
    reservado: { ...EMPTY_SLICE },
  };

  const idadeMap = new Map<GestaoEstoqueIdadeFaixa, GestaoEstoqueStatusSlice>();
  for (const faixa of FAIXAS) {
    idadeMap.set(faixa, { ...EMPTY_SLICE });
  }

  const marcaMap = new Map<string, { quantidade: number; valorVenda: number }>();

  let totalVenda = 0;
  let totalCusto = 0;
  let pendenteQtd = 0;
  let pendenteAnunciado = 0;

  for (const v of active) {
    const vv = venda(v);
    const pending = !hasCompra(v);
    if (pending) {
      pendenteQtd += 1;
      pendenteAnunciado += vv;
    }
    const cc = investido(v);
    totalVenda += vv;
    if (!pending) totalCusto += cc;

    const statusKey = v.status === "reservado" ? "reservado" : "disponivel";
    const st = porStatus[statusKey];
    st.quantidade += 1;
    st.valorVenda += vv;
    st.valorCusto += cc;

    const faixa = gestaoEstoqueIdadeFaixa(daysInStock(v.dataCompra, v.created_at, nowMs));
    const id = idadeMap.get(faixa)!;
    id.quantidade += 1;
    id.valorVenda += vv;
    id.valorCusto += cc;

    const marca = (v.marca || "Sem marca").trim() || "Sem marca";
    const cur = marcaMap.get(marca) ?? { quantidade: 0, valorVenda: 0 };
    cur.quantidade += 1;
    cur.valorVenda += vv;
    marcaMap.set(marca, cur);
  }

  const porMarca = [...marcaMap.entries()]
    .map(([marca, data]) => ({ marca, ...data }))
    .sort((a, b) => b.valorVenda - a.valorVenda);

  return {
    totais: {
      quantidade: active.length,
      valorVenda: totalVenda,
      valorCusto: totalCusto,
      lucroProjetado: totalVenda - totalCusto - pendenteAnunciado,
    },
    custoPendente: {
      quantidade: pendenteQtd,
      valorAnunciado: pendenteAnunciado,
    },
    porStatus,
    porIdade: FAIXAS.map((faixa) => {
      const s = idadeMap.get(faixa)!;
      return {
        faixa,
        quantidade: s.quantidade,
        valorVenda: s.valorVenda,
        valorCusto: s.valorCusto,
      };
    }),
    porMarca,
  };
}
