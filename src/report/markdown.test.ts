import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.ts";
import { emptyReport, mixedReport } from "./report-fixture.ts";

describe("renderMarkdown", () => {
  it("matches the golden file for a mixed report", async () => {
    await expect(renderMarkdown(await mixedReport())).toMatchFileSnapshot(
      "golden/mixed.markdown.golden",
    );
  });

  it("matches the golden file for an empty fallback report", async () => {
    await expect(renderMarkdown(await emptyReport())).toMatchFileSnapshot(
      "golden/empty.markdown.golden",
    );
  });

  it("starts with the sticky-comment marker and puts warnings above the findings", async () => {
    const md = renderMarkdown(await emptyReport());
    expect(md.startsWith("<!-- rollback-gate -->\n## Rollback Gate: 🟢 SAFE\n")).toBe(true);
    expect(md.indexOf("> [!WARNING]")).toBeLessThan(md.indexOf("Base `main`"));
  });

  it("shows UNSAFE, then RISKY, then folds SAFE notes into <details>", async () => {
    const md = renderMarkdown(await mixedReport());
    const unsafe = md.indexOf("### 🔴 UNSAFE");
    const risky = md.indexOf("### 🟡 RISKY");
    const details = md.indexOf("<details>");
    expect(unsafe).toBeGreaterThan(-1);
    expect(unsafe).toBeLessThan(risky);
    expect(risky).toBeLessThan(details);
    expect(md.slice(details)).not.toContain("###");
  });

  it("never lets a name from the PR inject HTML or break out of its code span", async () => {
    const md = renderMarkdown(await mixedReport());
    // Inside a code span, `<b>` is shown as text; anywhere else it must arrive escaped.
    const span = "``odd`|<b>*_name``";
    expect(md).toContain(span);
    expect(md.split(span).join("")).not.toContain("<b>");
  });
});
