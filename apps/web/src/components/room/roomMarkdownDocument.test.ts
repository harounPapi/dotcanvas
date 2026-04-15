import { describe, expect, it } from "vitest";

import { auditRoomMarkdownDocument, roundTripRoomMarkdown } from "./roomMarkdownDocument";

describe("roomMarkdownDocument", () => {
  it("keeps supported markdown in rich mode and round-trips key markdown blocks", () => {
    const markdown = `# Project Notes

* [x] Ship room editor

See the [Guide](docs/guide.md).

| Name | Status |
| - | - |
| Room | Live |

\`\`\`ts
console.log("room");
\`\`\`

$$
x+1
$$

Inline $room$ math.

\`\`\`mermaid
graph TD
  Room-->Plate
\`\`\`
`;

    expect(auditRoomMarkdownDocument(markdown)).toEqual({ mode: "rich" });

    const output = roundTripRoomMarkdown(markdown);
    expect(output).toContain("# Project Notes");
    expect(output).toContain("* [x] Ship room editor");
    expect(output).toContain("[Guide](docs/guide.md)");
    expect(output).toContain("| Name | Status |");
    expect(output).toContain("```ts");
    expect(output).toContain('console.log("room");');
    expect(output).toContain("$$\nx+1\n$$");
    expect(output).toContain("Inline $room$ math.");
    expect(output).toContain("```mermaid");
    expect(output).toContain("Room-->Plate");
  });

  it("keeps standalone HTML blocks in rich mode and preserves them on save", () => {
    const markdown = `# Project Notes

<div class="callout">Hello <strong>world</strong></div>
`;

    expect(auditRoomMarkdownDocument(markdown)).toEqual({ mode: "rich" });

    const output = roundTripRoomMarkdown(markdown);
    expect(output).toContain('<div class="callout">Hello <strong>world</strong></div>');
    expect(output).not.toContain("\\<div");
  });

  it("keeps reference-style links in rich mode and serializes them as inline markdown links", () => {
    const markdown = `# Links

[Guide][guide]

[guide]: docs/guide.md
`;

    expect(auditRoomMarkdownDocument(markdown)).toEqual({ mode: "rich" });

    const output = roundTripRoomMarkdown(markdown);
    expect(output).toContain("[Guide](docs/guide.md)");
    expect(output).not.toContain("[guide]:");
  });

  it("routes unsupported markdown to raw mode", () => {
    expect(auditRoomMarkdownDocument("![diagram](diagram.png)")).toEqual({
      mode: "raw",
      reason: "images",
    });

    expect(auditRoomMarkdownDocument("before <kbd>cmd</kbd> after")).toEqual({
      mode: "raw",
      reason: "inline HTML",
    });
  });
});
