import { describe, expect, it } from "vitest";

import { parseChatThreadRouteSearch, stripDiffSearchParams } from "./diffRouteSearch";

describe("parseChatThreadRouteSearch", () => {
  it("parses valid diff search values", () => {
    const parsed = parseChatThreadRouteSearch({
      diff: "1",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({
      view: "agent",
      diff: "1",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });
  });

  it("parses explicit agent and room views", () => {
    expect(parseChatThreadRouteSearch({ view: "agent" })).toEqual({
      view: "agent",
    });

    expect(parseChatThreadRouteSearch({ view: "room" })).toEqual({
      view: "room",
    });
  });

  it("defaults invalid or missing view values to agent", () => {
    expect(parseChatThreadRouteSearch({})).toEqual({
      view: "agent",
    });

    expect(parseChatThreadRouteSearch({ view: "elsewhere" })).toEqual({
      view: "agent",
    });
  });

  it("treats numeric and boolean diff toggles as open", () => {
    expect(
      parseChatThreadRouteSearch({
        diff: 1,
        diffTurnId: "turn-1",
      }),
    ).toEqual({
      view: "agent",
      diff: "1",
      diffTurnId: "turn-1",
    });

    expect(
      parseChatThreadRouteSearch({
        diff: true,
        diffTurnId: "turn-1",
      }),
    ).toEqual({
      view: "agent",
      diff: "1",
      diffTurnId: "turn-1",
    });
  });

  it("drops turn and file values when diff is closed", () => {
    const parsed = parseChatThreadRouteSearch({
      view: "room",
      diff: "0",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({
      view: "room",
    });
  });

  it("drops file value when turn is not selected", () => {
    const parsed = parseChatThreadRouteSearch({
      diff: "1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({
      view: "agent",
      diff: "1",
    });
  });

  it("normalizes whitespace-only values", () => {
    const parsed = parseChatThreadRouteSearch({
      diff: "1",
      diffTurnId: "  ",
      diffFilePath: "  ",
    });

    expect(parsed).toEqual({
      view: "agent",
      diff: "1",
    });
  });
});

describe("stripDiffSearchParams", () => {
  it("keeps the current view while removing diff-specific keys", () => {
    expect(
      stripDiffSearchParams({
        view: "room",
        diff: "1",
        diffTurnId: "turn-1",
        diffFilePath: "src/app.ts",
      }),
    ).toEqual({
      view: "room",
    });
  });
});
