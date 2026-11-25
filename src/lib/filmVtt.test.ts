import { describe, expect, it } from "vitest";
import { cuesToVtt } from "./filmVtt";

describe("cuesToVtt", () => {
  it("writes a WebVTT track with hh:mm:ss.mmm stamps", () => {
    const vtt = cuesToVtt([
      { start: 0.3, end: 2.8, text: "시편 100편" },
      { start: 3661.5, end: 3663, text: "끝" },
    ]);
    expect(vtt).toBe(
      "WEBVTT\n\n00:00:00.300 --> 00:00:03.050\n시편 100편\n\n01:01:01.500 --> 01:01:03.250\n끝\n",
    );
  });
  it("is still a valid (empty) track without cues", () => {
    expect(cuesToVtt(null)).toBe("WEBVTT\n\n\n");
  });
});
