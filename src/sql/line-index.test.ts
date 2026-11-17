import { describe, expect, it } from "vitest";
import { byteOffsetToLine, codePointToLine } from "./line-index.ts";

describe("byteOffsetToLine", () => {
  it("counts lines by UTF-8 bytes, so multibyte text before a position doesn't shift it", () => {
    const sql = "-- é😀\nSELECT 1;\nSELECT 2;";
    const lineAt = byteOffsetToLine(sql);
    const secondSelect = new TextEncoder().encode(sql.slice(0, sql.lastIndexOf("SELECT"))).length;
    expect(lineAt(0)).toBe(1);
    expect(lineAt(secondSelect)).toBe(3);
  });

  it("treats CRLF as one line break", () => {
    const lineAt = byteOffsetToLine("a\r\nb\r\nc");
    expect([lineAt(0), lineAt(3), lineAt(6)]).toEqual([1, 2, 3]);
  });

  it("puts a position right after a line break on the next line", () => {
    const lineAt = byteOffsetToLine("a\nb");
    expect([lineAt(1), lineAt(2)]).toEqual([1, 2]);
  });
});

describe("codePointToLine", () => {
  it("counts an emoji as one code point, not two UTF-16 units", () => {
    const sql = "-- 😀😀\nSELECT 1;\nDROP;";
    const semicolon = Array.from(sql).lastIndexOf(";");
    expect(codePointToLine(sql, semicolon)).toBe(3);
    expect(codePointToLine(sql, 0)).toBe(1);
  });
});
