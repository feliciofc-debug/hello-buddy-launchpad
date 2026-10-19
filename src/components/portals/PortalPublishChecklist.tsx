import { Link } from "react-router-dom";

export type PortalPublishReadiness = {
  connected: boolean;
  hasCep: boolean;
  hasPhone: boolean;
  hasMlPackage?: boolean;
  phonePreview?: string | null;
};

function Item(props: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex gap-2 text-xs text-muted-foreground">
      <span aria-hidden>{props.ok ? "✅" : "⬜"}</span>
      <span>
        {props.label}
        {props.hint ? <span className="text-foreground/80"> — {props.hint}</span> : null}
      </span>
    </li>
  );
}

export function PortalPublishChecklist(props: {
  portal: "mercadolivre" | "olx" | "webmotors";
  readiness: PortalPublishReadiness;
}) {
  const { readiness: r } = props;
  const title = props.portal === "mercadolivre"
    ? "Pronto para publicar (ML)"
    : props.portal === "olx"
    ? "Pronto para publicar (OLX)"
    : "Pronto para publicar (Webmotors)";

  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-2">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-0.5">
        <Item ok={r.connected} label="Conta conectada" />
        <Item ok={r.hasCep} label="CEP da loja" hint={!r.hasCep ? "Integrações" : undefined} />
        <Item
          ok={r.hasPhone}
          label="Telefone no perfil"
          hint={r.phonePreview ? `Anúncio: ${r.phonePreview}` : undefined}
        />
        {props.portal === "mercadolivre" && (
          <Item ok={!!r.hasMlPackage} label="Pacote ML (Clássico/Destaque)" />
        )}
      </ul>
      {(!r.hasCep || !r.hasPhone) && (
        <Link to="/configuracoes/integracoes" className="mt-1 block text-xs text-primary underline">
          Ajustar em Integrações
        </Link>
      )}
    </div>
  );
}
