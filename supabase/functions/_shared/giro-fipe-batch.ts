import { formatYmdSaoPaulo } from "./gestao-date-br.ts";

export type GiroFipeVeiculoRef = {
  veiculo_id: string;
  fonte: string;
  capturado_em: string;
  referencia_mes?: string | null;
};

export function competenciaCapturadoEm(capturadoEm: string): string {
  const ymd = formatYmdSaoPaulo(new Date(capturadoEm));
  return ymd.slice(0, 7);
}

export function veiculoComFipeNoMes(
  veiculoId: string,
  refs: GiroFipeVeiculoRef[],
  competenciaAtual: string,
): boolean {
  return refs.some(
    (r) =>
      String(r.veiculo_id) === String(veiculoId) &&
      r.fonte === "fipe" &&
      competenciaCapturadoEm(r.capturado_em) === competenciaAtual,
  );
}

export function listarPendentesFipeOrdenados(
  veiculoIds: string[],
  refs: GiroFipeVeiculoRef[],
  competenciaAtual: string,
  skipIds: Iterable<string> = [],
): string[] {
  const skip = new Set([...skipIds].map(String));
  return [...veiculoIds]
    .map(String)
    .filter((id) => !skip.has(id))
    .filter((id) => !veiculoComFipeNoMes(id, refs, competenciaAtual))
    .sort((a, b) => a.localeCompare(b));
}

export function selecionarLotePendentesFipe(input: {
  veiculoIds: string[];
  refs: GiroFipeVeiculoRef[];
  competenciaAtual: string;
  skipIds?: Iterable<string>;
  limit: number;
}): { lote: string[]; pendentesRestantes: number } {
  const pendentes = listarPendentesFipeOrdenados(
    input.veiculoIds,
    input.refs,
    input.competenciaAtual,
    input.skipIds,
  );
  const lote = pendentes.slice(0, input.limit);
  return {
    lote,
    pendentesRestantes: Math.max(0, pendentes.length - lote.length),
  };
}

/** Simula várias rodadas com skip_ids (falhas) até esgotar pendentes consultáveis. */
export function simularRodadasFipeRefresh(input: {
  veiculoIds: string[];
  refs: GiroFipeVeiculoRef[];
  competenciaAtual: string;
  limit: number;
  falhaPorVeiculo: (veiculoId: string) => boolean;
}): {
  tentados: string[];
  gravados: string[];
  falhas: string[];
  rodadas: number;
} {
  const skipIds = new Set<string>();
  const tentados: string[] = [];
  const gravados: string[] = [];
  const falhas: string[] = [];
  let rodadas = 0;

  while (true) {
    const { lote } = selecionarLotePendentesFipe({
      veiculoIds: input.veiculoIds,
      refs: input.refs,
      competenciaAtual: input.competenciaAtual,
      skipIds,
      limit: input.limit,
    });
    if (!lote.length) break;
    rodadas += 1;
    for (const id of lote) {
      tentados.push(id);
      if (input.falhaPorVeiculo(id)) {
        falhas.push(id);
        skipIds.add(id);
      } else {
        gravados.push(id);
        input.refs.push({
          veiculo_id: id,
          fonte: "fipe",
          capturado_em: `${input.competenciaAtual}-15T12:00:00Z`,
        });
      }
    }
  }

  return { tentados, gravados, falhas, rodadas };
}
