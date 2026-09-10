// Wordflow's mark: a scroll unrolling from a gilt rod, with the Hebrew bet on the open
// sheet — the letter Genesis 1:1 (בְּרֵאשִׁית) opens with. Every icon the app ships
// (favicon, apple-touch, PWA 192/512) is this one component rendered through next/og at a
// different size, so the artwork has a single source here. It is also plain React, so the
// landing page renders the same component rather than a second copy of the drawing.
const CREAM = "#fbf1e2";
const GOLD = "#f5cd8d";

// The bet, drawn as an outline rather than a stroked line so the horizontals can sit
// heavier than the vertical. That contrast is the most recognizable thing about Hebrew
// square script — a monoline version reads as a bracket, not a letter. Traced clockwise
// from the top-left: top bar, down the stem, out to the heel, along the base, then back up
// the inside of the counter.
const BET =
  "M27 26.5H38.5V36.5H40.5V41H24V36.5H35.3V30.7H27Z";

export function AppIconMark({ size, radius = 0 }: { size: number; radius?: number }) {
  // Below ~48px the bet collapses into a gold smudge and costs more legibility than it
  // buys, so the favicon keeps the scroll silhouette on its own.
  const showLetter = size >= 48;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius,
        background: "linear-gradient(145deg, #d97a49 0%, #9c4726 62%, #6e3018 100%)",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64">
        {/* The sheet, hanging from the rod and rippling where it hasn't flattened out yet. */}
        <path d="M16 22h32v23q-8 6-16 0t-16 0z" fill={CREAM} />
        {showLetter ? <path d={BET} fill={GOLD} /> : null}
        {/* Drawn last so the rod sits over the top edge of the sheet. */}
        <rect x={12} y={12.5} width={40} height={9} rx={4.5} fill={GOLD} />
      </svg>
    </div>
  );
}
