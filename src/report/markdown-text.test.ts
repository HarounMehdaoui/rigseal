import { describe, expect, it } from "vitest";
import { codeSpan, escapeMarkdown } from "./markdown-text.ts";

describe("escapeMarkdown", () => {
  it("backslash-escapes characters that could format, link or open HTML", () => {
    expect(escapeMarkdown("a*b_c`d<e>f[g]h|i#j~k&l\\m{n}")).toBe(
      "a\\*b\\_c\\`d\\<e\\>f\\[g\\]h\\|i\\#j\\~k\\&l\\\\m\\{n\\}",
    );
  });

  it("keeps ordinary prose readable", () => {
    expect(escapeMarkdown(`Base's client reads "User.name", then fails.`)).toBe(
      `Base's client reads "User.name", then fails.`,
    );
  });

  it("puts every @word in a code span, so GitHub never turns it into a mention", () => {
    expect(escapeMarkdown("@ignore it, or use @@ignore; ask @some-user_1.")).toBe(
      "`@ignore` it, or use `@@ignore`; ask `@some-user_1`.",
    );
  });

  it("joins lines, so text from a PR can't start a heading or a list", () => {
    expect(escapeMarkdown("one\n# two\r\n- three")).toBe("one \\# two - three");
  });
});

describe("codeSpan", () => {
  it("wraps plain text in single backticks", () => {
    expect(codeSpan("User.name")).toBe("`User.name`");
  });

  it("uses a longer fence than any backtick run inside", () => {
    expect(codeSpan("a`b")).toBe("``a`b``");
    expect(codeSpan("a``b")).toBe("```a``b```");
  });

  it("pads with spaces when the text starts or ends with a backtick", () => {
    expect(codeSpan("`x")).toBe("`` `x ``");
  });

  it("joins lines", () => {
    expect(codeSpan("a\nb")).toBe("`a b`");
  });
});
