import { useEffect } from "react";
import "./amz-auto.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Archivo:wght@400;500;600;700&display=swap";

export function useAmzAutoFonts() {
  useEffect(() => {
    const existing = document.querySelector(`link[data-amz-auto-fonts="1"]`);
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      link.setAttribute("data-amz-auto-fonts", "1");
      document.head.appendChild(link);
    }
  }, []);
}

export function AmzAutoPageShell({ children }: { children: React.ReactNode }) {
  useAmzAutoFonts();
  return (
    <div className="amz-auto-root min-h-screen">{children}</div>
  );
}
