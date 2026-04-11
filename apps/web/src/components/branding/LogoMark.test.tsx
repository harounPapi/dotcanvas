import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LogoMark } from "./LogoMark";

describe("LogoMark", () => {
  it("uses shared brand token fills by default", () => {
    const html = renderToStaticMarkup(<LogoMark title="DotCanvas" />);

    expect(html).toContain('fill="var(--brand-mark-light)"');
    expect(html).toContain('fill="var(--brand-mark-mid)"');
    expect(html).toContain('fill="var(--brand-mark-dark)"');
  });

  it("uses currentColor for the foreground variant", () => {
    const html = renderToStaticMarkup(<LogoMark variant="foreground" title="DotCanvas" />);

    expect(html).toContain('fill="currentColor"');
    expect(html).not.toContain("var(--brand-mark-");
  });
});
