import { cn } from "@/lib/utils";

type AmzAutoMarkProps = {
  size?: number;
  className?: string;
  /** Quando true, esconde do leitor de tela (ex.: ao lado do texto AMZ AUTO). */
  decorative?: boolean;
};

export function AmzAutoMark({
  size = 64,
  className,
  decorative = false,
}: AmzAutoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : "AMZ Auto"}
      className={cn("shrink-0", className)}
    >
      <rect width="64" height="64" rx="15" fill="#F26B1D" />
      <path
        d="M4.5 31h4.5M3 35.5h4"
        stroke="#FFFFFF"
        strokeOpacity="0.75"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.5 40.5c0-3.4 2.4-6.1 5.7-6.6l5.6-.9 6-7.6c1.2-1.5 3-2.4 4.9-2.4h7.4c2.1 0 4 1 5.2 2.7l4.6 6.6 3.4.8c3 .7 5 3.3 5 6.4v2.6c0 1.4-1.1 2.5-2.5 2.5H12c-1.4 0-2.5-1.1-2.5-2.5z"
        fill="#FFFFFF"
      />
      <path
        d="M28.6 27.6c.6-.8 1.6-1.3 2.6-1.3h3.6v7.2h-10.8z"
        fill="#F26B1D"
      />
      <path
        d="M37.6 26.3h3.3c1.1 0 2.1.5 2.7 1.4l4 5.8h-10z"
        fill="#F26B1D"
      />
      <circle cx="51.3" cy="38.2" r="1.7" fill="#FFD3B0" />
      <circle cx="20.5" cy="45" r="6.2" fill="#2A1A10" />
      <circle cx="20.5" cy="45" r="2.6" fill="#FFFFFF" />
      <circle cx="45" cy="45" r="6.2" fill="#2A1A10" />
      <circle cx="45" cy="45" r="2.6" fill="#FFFFFF" />
    </svg>
  );
}
