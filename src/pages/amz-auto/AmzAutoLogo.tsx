import { Link } from "react-router-dom";
import { AmzAutoMark } from "@/components/amz-auto/AmzAutoMark";

function AmzAutoBrandText() {
  return (
    <span className="font-display text-2xl tracking-wide">AMZ AUTO</span>
  );
}

export function AmzAutoLogo({ to = "/amz_auto" }: { to?: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center gap-2.5 text-[#F5F3EE] no-underline"
    >
      <AmzAutoMark size={34} decorative />
      <AmzAutoBrandText />
    </Link>
  );
}

export function AmzAutoLogoAnchor({ href = "/amz_auto" }: { href?: string }) {
  return (
    <a
      href={href}
      className="flex min-h-11 items-center gap-2.5 text-[#F5F3EE] no-underline"
    >
      <AmzAutoMark size={34} decorative />
      <AmzAutoBrandText />
    </a>
  );
}
