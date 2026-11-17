import { describe, expect, it } from "vitest";
import { readDatamodel } from "./dmmf.ts";
import { SchemaError } from "./schema-error.ts";

describe("readDatamodel", () => {
  it("throws SchemaError for an invalid schema, with Prisma's message and no colour codes", () => {
    const invalid = 'datasource db {\n  provider = "postgresql"\n  url = "postgres://x"\n}\n';
    let thrown: unknown;
    try {
      readDatamodel(invalid);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SchemaError);
    const message = thrown instanceof Error ? thrown.message : "";
    expect(message).toContain("`url` is no longer supported");
    expect(message).not.toContain("\u001b");
  });

  it("returns Prisma's datamodel for a valid schema", () => {
    const datamodel = readDatamodel(
      'datasource db {\n  provider = "postgresql"\n}\nmodel User {\n  id Int @id\n}\n',
    );
    expect(datamodel.models.map((m) => m.name)).toEqual(["User"]);
  });
});
