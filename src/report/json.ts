// Renders the Report as JSON in D49's fixed key order, 2-space indent and one trailing newline (D24).
import type { Report, ReportEntry } from "./types.ts";

/**
 * Every object is rebuilt key by key, so the byte order never depends on how the Report was
 * assembled, and nothing outside the format can slip in. The same Report always gives the same bytes.
 */
export function renderJson(report: Report): string {
  const ordered = {
    schemaVersion: report.schemaVersion,
    tool: { name: report.tool.name, version: report.tool.version },
    verdict: report.verdict,
    base: { ref: report.base.ref, sha: report.base.sha, method: report.base.method },
    head: { ref: report.head.ref, sha: report.head.sha },
    warnings: [...report.warnings],
    migrations: report.migrations.map((m) => ({
      file: m.file,
      status: m.status,
      sha256: m.sha256,
    })),
    entries: report.entries.map(entry),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

function entry(e: ReportEntry) {
  return {
    ruleId: e.ruleId,
    severity: e.severity,
    target: e.target,
    file: e.file,
    line: e.line,
    action: e.action,
    reason: e.reason,
    ...(e.fix === undefined ? {} : { fix: e.fix }),
  };
}
