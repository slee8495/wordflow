// Converts a 0-9999 value into its Sino-Korean spoken form (e.g. 4600 -> "사천육백"). "일" is
// dropped before 십/백/천 (e.g. 1000 -> "천", not "일천") since that's the natural, commonly-heard
// reading — the same convention news broadcasts and most Korean number-reading tools use.
function readFourDigitGroup(n: number): string {
  const digitNames = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const placeNames = ["", "십", "백", "천"];
  const str = String(n).padStart(4, "0");
  let result = "";
  for (let i = 0; i < 4; i++) {
    const digit = Number(str[i]);
    const place = 3 - i;
    if (digit === 0) continue;
    result += digit === 1 && place > 0 ? placeNames[place] : digitNames[digit] + placeNames[place];
  }
  return result;
}

const BIG_UNITS = [
  { value: 1_0000_0000_0000, name: "조" },
  { value: 1_0000_0000, name: "억" },
  { value: 1_0000, name: "만" },
];

// Full Sino-Korean reading of an arbitrary non-negative integer, correctly grouped by 만(10^4)
// rather than by thousands — the point of this whole file. A bare "1" coefficient of a big unit
// (조/억/만) is dropped the same way "일천" is shortened to "천" (e.g. 10000 -> "만", not "일만").
function numberToKoreanWords(n: number): string {
  if (n === 0) return "영";
  let result = "";
  let remaining = n;
  for (const unit of BIG_UNITS) {
    const groupValue = Math.floor(remaining / unit.value);
    if (groupValue > 0) {
      result += (groupValue === 1 ? "" : readFourDigitGroup(groupValue)) + unit.name;
      remaining %= unit.value;
    }
  }
  if (remaining > 0) result += readFourDigitGroup(remaining);
  return result;
}

// Comma-grouped numbers (e.g. "74,600", "603,550") only — this is specifically the Western
// thousands-grouping notation that a TTS engine's own number normalizer tends to misread for
// Korean (reported: "74,600" read as "칠십사천육백" — treating the comma as a 천-boundary — instead
// of the correct "칠만사천육백", since Korean groups by 만/10^4, not by thousands). A bare small
// number with no comma (e.g. "40일") isn't ambiguous in any grouping system, so it's left alone.
const COMMA_NUMBER_PATTERN = /\d{1,3}(?:,\d{3})+/g;

export function spellOutKoreanNumbers(text: string): string {
  return text.replace(COMMA_NUMBER_PATTERN, (match) => numberToKoreanWords(Number(match.replace(/,/g, ""))));
}
