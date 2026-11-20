import { describe, expect, it } from "vitest";
import { parseSql } from "./parse.ts";

// The shape Prisma writes: a comment line, then the statement.
const PRISMA_MIGRATION = `-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN "fullName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
`;

async function parsed(sql: string) {
  const result = await parseSql(sql);
  if (result.kind !== "parsed") throw new Error(`expected SQL to parse: ${result.message}`);
  return result.statements;
}

async function failure(sql: string) {
  const result = await parseSql(sql);
  if (result.kind !== "failure") throw new Error("expected a parse failure");
  return result;
}

describe("parseSql: valid SQL", () => {
  it("returns each statement's node and the line it starts on, after its comments", async () => {
    const statements = await parsed(PRISMA_MIGRATION);
    expect(statements.map((s) => [Object.keys(s.node)[0], s.line])).toEqual([
      ["AlterTableStmt", 2],
      ["IndexStmt", 6],
    ]);
  });

  it("keeps line numbers right after multibyte text and with CRLF line endings", async () => {
    const sql = "-- naïve 😀 comment\r\nSELECT 1;\r\n\r\n/* é */ SELECT 2;\r\n";
    const statements = await parsed(sql);
    expect(statements.map((s) => s.line)).toEqual([2, 4]);
  });

  it("gives no statements for a file of comments only", async () => {
    expect(await parsed("-- This is an empty migration.\n")).toEqual([]);
  });

  it("gives no statements for an empty file, like a whitespace-only one", async () => {
    expect(await parsed("")).toEqual([]);
    expect(await parsed(" \n")).toEqual([]);
  });
});

describe("parseSql: SQL Postgres rejects", () => {
  it("returns a failure with the parser's message and line, instead of throwing", async () => {
    const result = await failure('-- é\nCREATE TABLE "A" ("id" INT);\nALTER TABLE "A" DROP;\n');
    expect(result).toEqual({ kind: "failure", message: 'syntax error at or near ";"', line: 3 });
  });

  it("reports an unterminated string with its line", async () => {
    const result = await failure("SELECT 1;\nSELECT 'oops;\n");
    expect(result.message).toMatch(/unterminated quoted string/);
    expect(result.line).toBe(2);
  });
});
