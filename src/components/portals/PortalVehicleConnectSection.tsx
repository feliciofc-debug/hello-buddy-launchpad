import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  PortalPublishChecklist,
  type PortalPublishReadiness,
} from "@/components/portals/PortalPublishChecklist.tsx";

export function PortalVehicleConnectSection(props: {
  portal: "mercadolivre" | "olx" | "webmotors";
  portalLabel: string;
  connectFoco: "olx" | "ml" | "webmotors";
  readiness: PortalPublishReadiness;
}) {
  const href = `/configuracoes/integracoes?foco=${props.connectFoco}`;
  const readinessDisconnected: PortalPublishReadiness = {
    ...props.readiness,
    connected: false,
  };

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">{props.portalLabel}</p>
      <PortalPublishChecklist portal={props.portal} readiness={readinessDisconnected} />
      <Button size="sm" variant="outline" className="w-full" asChild>
        <Link to={href}>Conectar {props.portalLabel}</Link>
      </Button>
    </div>
  );
}
