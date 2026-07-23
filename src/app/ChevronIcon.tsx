// Shared chevron glyph + icon-only nav button, so every ← / → control in the app (Today's day
// and passage navigation, Reading's back buttons) renders as the same crisp vector shape instead
// of a plain "←"/"→" text character, which varies in weight and baseline across fonts/platforms.
export function ChevronIcon({ direction, className = "" }: { direction: "left" | "right"; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 align-[-1px] ${direction === "right" ? "rotate-180" : ""} ${className}`}
      aria-hidden="true"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronButton({
  direction,
  onClick,
  disabled,
  ariaLabel,
}: {
  direction: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-soft)] transition-colors hover:bg-[var(--clay-tint)] hover:text-[var(--ink)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--ink-soft)]"
    >
      <ChevronIcon direction={direction} />
    </button>
  );
}
