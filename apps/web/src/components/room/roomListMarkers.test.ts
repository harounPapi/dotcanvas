import { describe, expect, it } from "vitest";

import { getRoomListMarkerLabel } from "./roomListMarkers";

describe("roomListMarkers", () => {
  it("maps bullet list styles to internal marker glyphs", () => {
    expect(getRoomListMarkerLabel({ listStyleType: "disc" })).toBe("•");
    expect(getRoomListMarkerLabel({ listStyleType: "circle" })).toBe("◦");
    expect(getRoomListMarkerLabel({ listStyleType: "square" })).toBe("▪");
  });

  it("formats ordered list styles using stored list start values", () => {
    expect(getRoomListMarkerLabel({ listStyleType: "decimal", listStart: 4 })).toBe("4.");
    expect(getRoomListMarkerLabel({ listStyleType: "lower-alpha", listStart: 27 })).toBe("aa.");
    expect(getRoomListMarkerLabel({ listStyleType: "upper-alpha", listStart: 3 })).toBe("C.");
    expect(getRoomListMarkerLabel({ listStyleType: "lower-roman", listStart: 9 })).toBe("ix.");
    expect(getRoomListMarkerLabel({ listStyleType: "upper-roman", listStart: 12 })).toBe("XII.");
  });

  it("falls back to sibling order and restart metadata when listStart is absent", () => {
    const siblings = [
      { indent: 1, listStyleType: "decimal", listStart: 3 },
      { indent: 1, listStyleType: "decimal" },
      { indent: 2, listStyleType: "decimal", listStart: 1 },
      { indent: 1, listStyleType: "decimal" },
      { indent: 1, listStyleType: "decimal", listRestartPolite: 8 },
      { indent: 1, listStyleType: "decimal" },
    ] as const;

    expect(getRoomListMarkerLabel(siblings[1], siblings, 1)).toBe("4.");
    expect(getRoomListMarkerLabel(siblings[3], siblings, 3)).toBe("5.");
    expect(getRoomListMarkerLabel(siblings[4], siblings, 4)).toBe("8.");
    expect(getRoomListMarkerLabel(siblings[5], siblings, 5)).toBe("9.");
  });

  it("returns no marker for todo items", () => {
    expect(getRoomListMarkerLabel({ checked: false, listStyleType: "todo" })).toBeNull();
  });
});
