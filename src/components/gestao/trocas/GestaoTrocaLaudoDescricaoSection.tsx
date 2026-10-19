import { useMemo } from "react";
import {
  GESTAO_TROCA_IA_DESCRICAO_AREA_LABEL,
  gestaoTrocaIaDescricaoIcon,
  type GestaoTrocaIaDescricaoAreaRow,
  type GestaoTrocaIaDescricaoSecao,
} from "@/lib/gestao-troca-ia-descricao-display.ts";
import type { GestaoTrocaIaQualidadeFoto } from "@/lib/gestao-troca-ia-types.ts";

type Props = {
  externo: GestaoTrocaIaDescricaoAreaRow[];
  interno: GestaoTrocaIaDescricaoAreaRow[];
  conclusao_visual: string | null;
  qualidade: GestaoTrocaIaQualidadeFoto[];
  thumbUrls: Record<string, string>;
};

function SecaoBlock({
  titulo,
  rows,
  fotoPaths,
  thumbUrls,
}: {
  titulo: string;
  rows: GestaoTrocaIaDescricaoAreaRow[];
  fotoPaths: string[];
  thumbUrls: Record<string, string>;
}) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.area} className="text-sm">
            <div className="flex flex-wrap items-start gap-2">
              <span aria-hidden>{gestaoTrocaIaDescricaoIcon(r.condicao)}</span>
              <div className="min-w-0 flex-1">
                <span className="font-medium">
                  {GESTAO_TROCA_IA_DESCRICAO_AREA_LABEL[r.area] ?? r.area}:
                </span>{" "}
                {r.texto}
                {r.fotos.length > 0 && (
                  <span className="text-muted-foreground"> ({r.fotos.join(", ")})</span>
                )}
              </div>
              {r.fotos.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.fotos.map((idx) => {
                    const path = fotoPaths[idx - 1];
                    const url = path ? thumbUrls[path] : undefined;
                    if (!url) return null;
                    return (
                      <a
                        key={`${r.area}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img src={url} alt="" className="h-10 w-14 rounded object-cover border" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GestaoTrocaLaudoDescricaoSection({
  externo,
  interno,
  conclusao_visual,
  qualidade,
  thumbUrls,
}: Props) {
  const fotoPaths = useMemo(
    () => qualidade.filter((q) => q.usada).map((q) => q.path),
    [qualidade],
  );

  if (!externo.length && !interno.length && !conclusao_visual) return null;

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-3">
      <p className="text-sm font-semibold">Laudo descritivo (IA)</p>
      <SecaoBlock titulo="Externo" rows={externo} fotoPaths={fotoPaths} thumbUrls={thumbUrls} />
      <SecaoBlock titulo="Interno" rows={interno} fotoPaths={fotoPaths} thumbUrls={thumbUrls} />
      {conclusao_visual && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Conclusão visual:</span> {conclusao_visual}
        </p>
      )}
    </div>
  );
}

export function splitDescricaoPorSecao(
  rows: GestaoTrocaIaDescricaoAreaRow[],
): Record<GestaoTrocaIaDescricaoSecao, GestaoTrocaIaDescricaoAreaRow[]> {
  return {
    externo: rows.filter((r) => r.secao === "externo"),
    interno: rows.filter((r) => r.secao === "interno"),
  };
}
