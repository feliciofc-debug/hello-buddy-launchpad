import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = useMemo(() => {
    if (!password || password.length < 8) return false;
    if (password !== confirm) return false;
    return true;
  }, [password, confirm]);

  useEffect(() => {
    // Garante que o estado de auth esteja carregado (link de recuperação faz login temporário)
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Erro ao obter sessão:", error);
        toast.error("Não foi possível validar o link de recuperação.");
        return;
      }

      if (!data.session) {
        toast.error("Link inválido ou expirado. Solicite um novo.");
      }
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Senha atualizada! Agora você pode entrar.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <section className="max-w-md w-full bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Redefinir senha</h1>
          <p className="text-purple-300 mt-2">Defina uma nova senha para sua conta.</p>
        </header>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
              placeholder="mínimo 8 caracteres"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">Confirmar senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
              placeholder="repita a senha"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full border-2 border-purple-500/50 text-purple-300 py-3 rounded-lg font-semibold hover:bg-purple-500/10 transition"
          >
            Voltar para login
          </button>
        </form>
      </section>
    </main>
  );
}
