import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AmzAutoLogo } from "./AmzAutoLogo";
import { AmzAutoPageShell } from "./AmzAutoLayout";
import {
  AMZ_AUTO_FAIXA_ESTOQUE_OPTIONS,
  AMZ_AUTO_INTERESSE_OPTIONS,
  AMZ_AUTO_QTD_LOJAS_OPTIONS,
  AMZ_AUTO_TIPOS,
} from "../../../supabase/functions/_shared/amz-auto-cadastro-validate.ts";

export default function AmzAutoCadastroPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [aceite, setAceite] = useState(false);

  useEffect(() => {
    document.title = "Cadastre sua loja — AMZ Auto";
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const fd = new FormData(form);

    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke(
      "amz-auto-cadastro",
      {
        body: {
          loja_nome: fd.get("loja_nome"),
          cnpj: fd.get("cnpj"),
          responsavel: fd.get("responsavel"),
          whatsapp: fd.get("whatsapp"),
          email: fd.get("email"),
          cidade_uf: fd.get("cidade_uf"),
          tipo_operacao: fd.get("tipo_operacao"),
          qtd_lojas: fd.get("qtd_lojas"),
          faixa_estoque: fd.get("faixa_estoque"),
          interesse: fd.get("interesse"),
          aceite_termos: aceite,
          website: fd.get("website"),
        },
      },
    );
    setSubmitting(false);

    if (fnError) {
      setError(fnError.message || "Não foi possível enviar o cadastro.");
      return;
    }
    if (data?.error) {
      setError(String(data.error));
      return;
    }
    setSuccess(true);
    form.reset();
    setAceite(false);
  };

  if (success) {
    return (
      <AmzAutoPageShell>
        <div className="bg-[#0C0E11] text-[#F5F3EE]">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <AmzAutoLogo />
          </nav>
        </div>
        <main className="mx-auto max-w-xl px-6 py-20 text-center">
          <h1 className="font-display mb-4 text-4xl leading-tight">
            Cadastro recebido — sua loja está em análise
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-[#45413B]">
            Nosso time entra em contato pelo WhatsApp em breve para combinar o plano e a implantação.
          </p>
          <Link
            to="/amz_auto"
            className="inline-flex min-h-12 items-center rounded-xl bg-[#FF6B1A] px-6 font-bold text-[#0C0E11] no-underline"
          >
            Voltar para AMZ Auto
          </Link>
        </main>
      </AmzAutoPageShell>
    );
  }

  return (
    <AmzAutoPageShell>
      <div className="bg-[#0C0E11] text-[#F5F3EE]">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <AmzAutoLogo />
          <Link
            to="/amz_auto/entrar"
            className="inline-flex min-h-11 items-center rounded-[10px] border border-[#4A505A] px-[18px] text-[15px] font-semibold text-[#F5F3EE] no-underline"
          >
            Já sou cliente — Entrar
          </Link>
        </nav>
      </div>

      <main className="mx-auto flex max-w-7xl flex-wrap items-start gap-12 px-6 py-12 pb-16">
        <div className="flex min-w-0 flex-1 basis-[380px] flex-col gap-4">
          <Link to="/amz_auto" className="amz-auto-link inline-flex min-h-11 items-center text-[15px] font-semibold">
            ← Voltar
          </Link>
          <h1 className="font-display m-0 text-[clamp(2rem,4vw,2.875rem)] leading-tight">Cadastre sua loja</h1>
          <p className="m-0 text-lg leading-relaxed text-[#45413B]">
            Conte um pouco sobre a loja. Nosso time chama você no WhatsApp para montar o plano e combinar a implantação.
          </p>
          <ol className="m-0 mt-2 flex list-none flex-col gap-3.5 p-0">
            {[
              ["Cadastro", "você preenche agora."],
              ["Conversa e plano", "definimos juntos o que sua loja precisa."],
              ["Acesso liberado", "após o pagamento, sua loja entra na área AMZ Auto."],
            ].map(([title, sub], i) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#0C0E11] text-sm font-bold text-[#F5F3EE]">
                  {i + 1}
                </span>
                <span className="pt-1 text-base leading-relaxed">
                  <strong>{title}</strong> — {sub}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-w-0 flex-1 basis-[560px] rounded-[20px] bg-white p-8">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              {[
                { name: "loja_nome", label: "Nome da loja", type: "text", ph: "Ex.: Prime Veículos" },
                { name: "cnpj", label: "CNPJ", type: "text", ph: "00.000.000/0000-00" },
                { name: "responsavel", label: "Seu nome", type: "text", ph: "Responsável pela loja" },
                { name: "whatsapp", label: "WhatsApp com DDD", type: "tel", ph: "(21) 99999-9999" },
                { name: "email", label: "E-mail", type: "email", ph: "voce@sualoja.com.br" },
                { name: "cidade_uf", label: "Cidade / UF", type: "text", ph: "Rio de Janeiro / RJ" },
              ].map((field) => (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <label htmlFor={field.name} className="text-sm font-semibold">
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    required
                    placeholder={field.ph}
                    className="min-h-12 rounded-[10px] border border-[#C9C3B8] px-3.5 text-base"
                  />
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="tipo_operacao" className="text-sm font-semibold">Tipo de operação</label>
                <select id="tipo_operacao" name="tipo_operacao" required className="min-h-12 rounded-[10px] border border-[#C9C3B8] px-3 text-base">
                  {AMZ_AUTO_TIPOS.map((value) => (
                    <option key={value} value={value}>
                      {value === "revenda" && "Revenda de seminovos"}
                      {value === "concessionaria" && "Concessionária"}
                      {value === "grupo" && "Grupo com várias lojas"}
                      {value === "motos" && "Loja de motos"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qtd_lojas" className="text-sm font-semibold">Quantas lojas</label>
                <select id="qtd_lojas" name="qtd_lojas" required className="min-h-12 rounded-[10px] border border-[#C9C3B8] px-3 text-base">
                  {AMZ_AUTO_QTD_LOJAS_OPTIONS.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="faixa_estoque" className="text-sm font-semibold">Carros em estoque</label>
                <select id="faixa_estoque" name="faixa_estoque" required className="min-h-12 rounded-[10px] border border-[#C9C3B8] px-3 text-base">
                  {AMZ_AUTO_FAIXA_ESTOQUE_OPTIONS.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="interesse" className="text-sm font-semibold">O que mais interessa</label>
                <select id="interesse" name="interesse" required className="min-h-12 rounded-[10px] border border-[#C9C3B8] px-3 text-base">
                  {AMZ_AUTO_INTERESSE_OPTIONS.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                id="aceite"
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-0.5 h-[22px] w-[22px]"
                required
              />
              <label htmlFor="aceite" className="text-[15px] leading-relaxed text-[#45413B]">
                Aceito os <Link to="/termos" className="amz-auto-link font-semibold">termos de uso</Link> e a{" "}
                <Link to="/privacidade" className="amz-auto-link font-semibold">política de privacidade</Link>.
              </label>
            </div>

            {error ? (
              <p className="text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="min-h-14 rounded-xl border-0 bg-[#FF6B1A] text-[17px] font-bold text-[#0C0E11] disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Enviar cadastro"}
            </button>
            <p className="text-sm text-[#5A5650]">
              Seus dados são usados só para o contato comercial e a implantação.
            </p>
          </form>
        </div>
      </main>
    </AmzAutoPageShell>
  );
}
