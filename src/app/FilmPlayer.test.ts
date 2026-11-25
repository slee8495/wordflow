import { describe, expect, it } from "vitest";
import { cueAt } from "./FilmPlayer";

const cues = [
  { start: 0.3, end: 2.8, text: "title" },
  { start: 3, end: 7.97, text: "one" },
  { start: 10.57, end: 17.14, text: "two" },
];

describe("cueAt", () => {
  it("finds the cue playing at t", () => {
    expect(cueAt(cues, 1)).toBe("title");
    expect(cueAt(cues, 12)).toBe("two");
  });
  it("holds a cue briefly past its end, then clears in a long gap", () => {
    expect(cueAt(cues, 8.1)).toBe("one");
    expect(cueAt(cues, 9.5)).toBeNull();
  });
  it("handles a film without cues", () => {
    expect(cueAt(null, 5)).toBeNull();
  });
});
