import { Link } from "react-router-dom";

function AmzAutoMark() {
  return (
    <>
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FF6B1A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 16a8 8 0 1 1 16 0" />
        <path d="M12 16l4-5" />
        <circle cx="12" cy="16" r="1.4" />
      </svg>
      <span className="font-display text-2xl tracking-wide">AMZ AUTO</span>
    </>
  );
}

export function AmzAutoLogo({ to = "/amz_auto" }: { to?: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center gap-2.5 text-[#F5F3EE] no-underline"
    >
      <AmzAutoMark />
    </Link>
  );
}

export function AmzAutoLogoAnchor({ href = "/amz_auto" }: { href?: string }) {
  return (
    <a
      href={href}
      className="flex min-h-11 items-center gap-2.5 text-[#F5F3EE] no-underline"
    >
      <AmzAutoMark />
    </a>
  );
}
