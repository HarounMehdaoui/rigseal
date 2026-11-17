// The only file that imports libpg-query (D11): SQL text → statements with line numbers, or a failure.
import { hasSqlDetails, type Node, parse } from "libpg-query";
import { byteOffsetToLine, codePointToLine } from "./line-index.ts";

export interface Statement {
  /** libpg-query's AST node, e.g. `{ AlterTableStmt: {…} }`. */
  readonly node: Node;
  /** 1-based line where the statement starts (comments before it are skipped). */
  readonly line: number;
}

export interface ParsedSql {
  readonly kind: "parsed";
  readonly statements: readonly Statement[];
}

/** Postgres's parser rejected the text; it becomes RG-DB-021, never exit 2 (D20). */
export interface ParseFailure {
  readonly kind: "failure";
  readonly message: string;
  readonly line: number | null;
}

/**
 * Parses with Postgres 18's own grammar. A syntax error is an answer (`ParseFailure`), not a crash;
 * anything else libpg-query throws (WebAssembly failing to load, out of memory) is a real tool
 * failure and propagates (exit 2).
 */
export async function parseSql(sql: string): Promise<ParsedSql | ParseFailure> {
  let result: Awaited<ReturnType<typeof parse>>;
  try {
    result = await parse(sql);
  } catch (error) {
    if (!hasSqlDetails(error) || error.sqlDetails === undefined) throw error;
    const { message, cursorPosition } = error.sqlDetails;
    // cursorPosition counts code points from 0 (checked in T3.1); it's absent for some errors.
    const line = Number.isInteger(cursorPosition) ? codePointToLine(sql, cursorPosition) : null;
    return { kind: "failure", message, line };
  }

  // stmt_location counts UTF-8 bytes, already past leading comments; it's omitted when it is 0.
  const lineAt = byteOffsetToLine(sql);
  const statements = (result.stmts ?? []).map((raw) => {
    if (raw.stmt === undefined) throw new Error("libpg-query returned a statement without a node");
    return { node: raw.stmt, line: lineAt(raw.stmt_location ?? 0) };
  });
  return { kind: "parsed", statements };
}
