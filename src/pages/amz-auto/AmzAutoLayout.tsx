import { useEffect } from "react";
import "./amz-auto.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Archivo:wght@400;500;600;700&display=swap";

const FAVICON_HREF = "/amz-auto-mark.svg";

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

export function useAmzAutoFavicon() {
  useEffect(() => {
    const selector = 'link[rel="icon"][data-amz-auto-favicon="1"]';
    let link = document.querySelector(selector) as HTMLLinkElement | null;
    const previousHref =
      document.querySelector('link[rel="icon"]:not([data-amz-auto-favicon])')?.getAttribute("href") ??
      "/favicon.ico";

    if (!link) {
      document
        .querySelectorAll('link[rel="icon"]')
        .forEach((el) => el.setAttribute("data-amz-auto-favicon-replaced", "1"));
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      link.setAttribute("data-amz-auto-favicon", "1");
      document.head.appendChild(link);
    }
    link.href = FAVICON_HREF;

    return () => {
      link?.remove();
      const restored = document.createElement("link");
      restored.rel = "icon";
      restored.href = previousHref;
      document.head.appendChild(restored);
    };
  }, []);
}

export function AmzAutoPageShell({ children }: { children: React.ReactNode }) {
  useAmzAutoFonts();
  useAmzAutoFavicon();
  return (
    <div className="amz-auto-root min-h-screen">{children}</div>
  );
}
