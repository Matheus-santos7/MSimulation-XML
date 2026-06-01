import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** `full` — sidebar; `compact` — header; `mark` — só o ícone; `hero` — login. */
  variant?: "full" | "compact" | "mark" | "hero";
  className?: string;
  href?: string;
};

function BrandMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "size-7" : size === "lg" ? "size-14" : "size-9";
  const text = size === "sm" ? "text-[10px]" : size === "lg" ? "text-lg" : "text-[11px]";

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-lg bg-gradient-to-br from-accent/25 via-accent/10 to-transparent",
        "border border-accent/35 shadow-[0_0_24px_-6px_oklch(0.769_0.166_70.5_/_0.45)]",
        "flex items-center justify-center overflow-hidden",
        dim,
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,oklch(0.769_0.166_70.5_/_0.08)_100%)]" />
      <span className={cn("relative font-mono font-black tracking-tighter text-accent", text)}>M</span>
      <span
        className={cn(
          "absolute font-mono text-brand-xml opacity-80",
          size === "lg" ? "bottom-1.5 right-1.5 text-[9px]" : "bottom-0.5 right-0.5 text-[7px]",
        )}
      >
        {"</>"}
      </span>
    </div>
  );
}

function BrandWordmark({ variant }: { variant: BrandLogoProps["variant"] }) {
  if (variant === "mark") return null;

  const isHero = variant === "hero";
  const wordSize = isHero ? "text-2xl" : variant === "compact" ? "text-[12px]" : "text-[14px]";

  return (
    <div className="min-w-0 flex flex-col">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={cn("font-mono tracking-tight leading-none", wordSize)}>
          <span className="font-medium text-foreground">{BRAND.namePrefix}</span>
          <span className="font-medium text-foreground">{BRAND.nameStem}</span>
        </span>
        <span
          className={cn(
            "font-mono font-bold uppercase tracking-widest text-brand-xml bg-brand-xml/10 border border-brand-xml/25 rounded px-1 py-px",
            isHero ? "text-[10px]" : "text-[9px]",
          )}
        >
          {BRAND.suffix}
        </span>
      </div>
      {(variant === "full" || variant === "hero") && (
        <span
          className={cn(
            "text-muted-foreground truncate",
            isHero ? "text-sm mt-1" : "text-[11px] mt-0.5 tracking-wide",
          )}
        >
          {BRAND.tagline}
        </span>
      )}
    </div>
  );
}

export function BrandLogo({ variant = "full", className, href = "/" }: BrandLogoProps) {
  const markSize = variant === "hero" ? "lg" : variant === "compact" ? "sm" : "md";
  const content = (
    <>
      <BrandWordmark variant={variant} />
    </>
  );

  const layout = cn(
    "flex items-center gap-3 min-w-0",
    variant === "hero" && "flex-col text-center gap-4",
    className,
  );

  if (variant === "mark") {
    return href ? (
      <Link href={href} className={cn("inline-flex", className)} aria-label={BRAND.fullName}>
        <BrandMark size={markSize} />
      </Link>
    ) : (
      <BrandMark size={markSize} className={className} />
    );
  }

  if (href) {
    return (
      <Link href={href} className={cn(layout, "group hover:opacity-95 transition-opacity")}>
        {content}
      </Link>
    );
  }

  return <div className={layout}>{content}</div>;
}
