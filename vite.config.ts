import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // PROJETO LOVABLE - FORÇA as variáveis no bundle
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://jibpvpqgplmahjhswiza.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrcr'),
  }
}));
