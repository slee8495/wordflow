// A curated shortlist rather than the full ~400-zone IANA database — this app's Settings picker
// is a manual override for the auto-detected browser timezone (see TimezoneProvider.tsx), not a
// primary input, so it only needs to cover where this app's actual users are.
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Los_Angeles", label: "Pacific Time (LA)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "Asia/Seoul", label: "Korea Standard Time (Seoul)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (Tokyo)" },
  { value: "Europe/London", label: "UK Time (London)" },
];
