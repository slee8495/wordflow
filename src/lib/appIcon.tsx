export function AppIconMark({ size }: { size: number }) {
  const barCount = 4;
  const gap = Math.round(size * 0.06);
  const barWidth = Math.round((size * 0.6 - gap * (barCount - 1)) / barCount);
  const heights = [0.4, 0.7, 0.55, 0.85].map((f) => Math.round(size * 0.6 * f));

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #7c3aed 0%, #1e1b4b 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap, height: size * 0.6 }}>
        {heights.map((h, i) => (
          <div
            key={i}
            style={{
              width: barWidth,
              height: h,
              borderRadius: barWidth / 2,
              background: "#fbbf24",
              opacity: 0.95,
            }}
          />
        ))}
      </div>
    </div>
  );
}
