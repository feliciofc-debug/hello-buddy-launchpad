import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { resolveBackPath } from "../../supabase/functions/_shared/app-back-nav.ts";

export { resolveBackPath };

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
