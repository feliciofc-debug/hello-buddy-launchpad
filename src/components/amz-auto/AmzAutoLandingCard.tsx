import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AmzAutoMark } from "@/components/amz-auto/AmzAutoMark";

export function AmzAutoLandingCard({ className }: { className?: string }) {
  return (
    <Link
      to="/amz_auto"
      className={cn(
        "flex items-center gap-4 rounded-xl border border-[#F26B1D]/60 bg-[#111420] p-4 no-underline",
        "transition-colors hover:border-[#F26B1D]/90 hover:bg-[#151824]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B1D] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        className,
      )}
    >
      <AmzAutoMark size={56} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F26B1D]">
          NOVO
        </p>
        <p className="text-[19px] font-extrabold leading-tight text-white">AMZ Auto</p>
        <p className="mt-0.5 text-xs leading-snug text-[#C9CDD6]">
          WhatsApp 24h, estoque e lucro por carro
        </p>
      </div>
      <span className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] bg-[#F26B1D] px-4 text-sm font-bold text-[#0C0E11]">
        Conhecer →
      </span>
    </Link>
  );
}
