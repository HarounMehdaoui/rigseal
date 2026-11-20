import { describe, expect, it } from "vitest";
import { terminalText } from "./terminal-text.ts";

describe("terminalText", () => {
  it("shows control characters as escapes, so a name from a PR can't drive the terminal", () => {
    expect(terminalText("a\u001b[2Jb\u0007c\u009bd\u007f")).toBe("a\\x1b[2Jb\\x07c\\x9bd\\x7f");
  });

  it("joins lines with a space", () => {
    expect(terminalText("one\ntwo\r\nthree")).toBe("one two three");
  });

  it("leaves printable text, including non-ASCII, alone", () => {
    expect(terminalText('User.name — "é" ✓')).toBe('User.name — "é" ✓');
  });
});
