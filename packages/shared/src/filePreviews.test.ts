import { describe, expect, it } from "vitest";

import { classifyFilePreview, detectLikelyDelimitedTextFormat } from "./filePreviews";

describe("filePreviews", () => {
  it("classifies the broadened tabular extensions", () => {
    expect(classifyFilePreview("planning.csv")).toEqual({
      kind: "tabular",
      tabularKind: "csv",
    });
    expect(classifyFilePreview("planning.psv")).toEqual({
      kind: "tabular",
      tabularKind: "psv",
    });
    expect(classifyFilePreview("planning.txt")).toEqual({
      kind: "tabular",
      tabularKind: "txt",
    });
    expect(classifyFilePreview("planning.xlsm")).toEqual({
      kind: "tabular",
      tabularKind: "xlsm",
    });
    expect(classifyFilePreview("planning.xlsb")).toEqual({
      kind: "tabular",
      tabularKind: "xlsb",
    });
    expect(classifyFilePreview("planning.xls")).toEqual({
      kind: "tabular",
      tabularKind: "xls",
    });
    expect(classifyFilePreview("planning.ods")).toEqual({
      kind: "tabular",
      tabularKind: "ods",
    });
    expect(classifyFilePreview("planning.fods")).toEqual({
      kind: "tabular",
      tabularKind: "fods",
    });
    expect(classifyFilePreview("deck.pdf")).toEqual({
      kind: "document",
      documentKind: "pdf",
    });
    expect(classifyFilePreview("brief.docx")).toEqual({
      kind: "document",
      documentKind: "docx",
    });
    expect(classifyFilePreview("legacy.doc")).toEqual({
      kind: "unsupported",
    });
  });

  it("detects delimited previews for known text-like table formats", () => {
    expect(
      detectLikelyDelimitedTextFormat({
        kind: "psv",
        text: "name|owner\r\nAPI|Ada\r\nUI|Sam\r\n",
      }),
    ).toEqual({
      delimiter: "|",
      lineEnding: "\r\n",
    });

    expect(
      detectLikelyDelimitedTextFormat({
        kind: "txt",
        text: "name,owner\nAPI,Ada\nUI,Sam\n",
      }),
    ).toEqual({
      delimiter: ",",
      lineEnding: "\n",
    });
  });

  it("rejects ordinary prose for safe-sniffed txt previews", () => {
    expect(
      detectLikelyDelimitedTextFormat({
        kind: "txt",
        text: "This is a plain note.\nIt has punctuation, commas, and prose.\nNothing is tabular here.\n",
      }),
    ).toBeNull();
  });
});
