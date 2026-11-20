import { describe, expect, it } from "vitest";
import { GitError } from "../git/errors.ts";
import { SchemaError } from "../schema/schema-error.ts";
import { failureMessage } from "./failure-message.ts";
import { UsageError } from "./usage-error.ts";

describe("failureMessage", () => {
  it("points a usage error at --help", () => {
    expect(failureMessage(new UsageError("unknown option --nope"))).toBe(
      "rollback-gate: unknown option --nope (see --help)",
    );
  });

  it("keeps only the first line of a multi-line message", () => {
    const err = new SchemaError(
      "base schema.prisma is invalid: error: bad line\n  -->  x:1\n 1 | y",
    );
    expect(failureMessage(err)).toBe(
      "rollback-gate: base schema.prisma is invalid: error: bad line",
    );
  });

  it("reports git errors as they are", () => {
    expect(failureMessage(new GitError("REF_NOT_FOUND", '"nope" is not a branch'))).toBe(
      'rollback-gate: "nope" is not a branch',
    );
  });

  it("labels anything else an internal error", () => {
    expect(failureMessage(new TypeError("x is undefined"))).toBe(
      "rollback-gate: internal error: x is undefined",
    );
    expect(failureMessage("thrown string")).toBe("rollback-gate: internal error: thrown string");
  });
});
