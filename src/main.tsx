import { createRoot } from "react-dom/client";
import "./i18n";
import "./index.css";
import { loadRuntimeConfig } from "./config/runtime-config";

async function bootstrap() {
  await loadRuntimeConfig();
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap().catch((error) => {
  console.error("[bootstrap] Falha ao iniciar a aplicação:", error);
  const root = document.getElementById("root");
  if (root) {
    root.textContent = "Não foi possível carregar a aplicação. Tente novamente.";
  }
});
