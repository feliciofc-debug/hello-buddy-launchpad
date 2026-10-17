import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

export function resolveBackPath(
  voltarParam: string | null,
  stateFrom: unknown,
  fallback: string,
): string {
  if (voltarParam?.startsWith("/")) return voltarParam;
  if (typeof stateFrom === "string" && stateFrom.startsWith("/")) return stateFrom;
  return fallback;
}

export function useSmartBack(fallback = "/dashboard") {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  return useCallback(() => {
    const target = resolveBackPath(
      searchParams.get("voltar"),
      (location.state as { from?: string } | null)?.from,
      fallback,
    );
    navigate(target);
  }, [navigate, searchParams, location.state, fallback]);
}

export function withVoltarParam(path: string, returnTo: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}voltar=${encodeURIComponent(returnTo)}`;
}
