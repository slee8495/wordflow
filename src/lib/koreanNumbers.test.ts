import { describe, expect, it } from "vitest";
import { spellOutKoreanNumbers } from "./koreanNumbers";

describe("spellOutKoreanNumbers", () => {
  it("fixes the reported Numbers 2 case: 74,600 -> 칠만사천육백, not 칠십사천육백", () => {
    expect(spellOutKoreanNumbers("유다 74,600명")).toBe("유다 칠만사천육백명");
  });

  it("groups by 만(10^4) for a six-digit total", () => {
    expect(spellOutKoreanNumbers("총 603,550명이다")).toBe("총 육십만삼천오백오십명이다");
  });

  it("drops the leading 일 for a bare 만/천 coefficient", () => {
    expect(spellOutKoreanNumbers("10,000")).toBe("만");
    expect(spellOutKoreanNumbers("1,000")).toBe("천");
  });

  it("keeps 일 in the ones place", () => {
    expect(spellOutKoreanNumbers("21,001")).toBe("이만천일");
  });

  it("handles multiple numbers in one passage", () => {
    expect(spellOutKoreanNumbers("유다 74,600명, 잇사갈 54,400명")).toBe("유다 칠만사천육백명, 잇사갈 오만사천사백명");
  });

  it("leaves numbers without comma grouping untouched", () => {
    expect(spellOutKoreanNumbers("40일 동안 광야에 있었다")).toBe("40일 동안 광야에 있었다");
    expect(spellOutKoreanNumbers("(3) 셋째 날에")).toBe("(3) 셋째 날에");
  });

  it("leaves text with no numbers untouched", () => {
    expect(spellOutKoreanNumbers("여호와께서 모세에게 말씀하셨다")).toBe("여호와께서 모세에게 말씀하셨다");
  });
});
