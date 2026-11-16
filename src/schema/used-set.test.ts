// One fixture per rule in RULES §2, plus the getDMMF guards T2.2 found.
import { describe, expect, it } from "vitest";
import { buildUsedSet, SchemaError, type UsedSet } from "./used-set.ts";

const DATASOURCE = 'datasource db {\n  provider = "postgresql"\n}\n';

function used(models: string): UsedSet {
  return buildUsedSet(DATASOURCE + models);
}

function table(set: UsedSet, name: string) {
  const found = set.tables.get(name);
  if (found === undefined) throw new Error(`table ${name} missing from the used set`);
  return found;
}

function column(set: UsedSet, tableName: string, name: string) {
  const found = table(set, tableName).columns.get(name);
  if (found === undefined) throw new Error(`column ${tableName}.${name} missing from the used set`);
  return found;
}

describe("buildUsedSet: RULES §2", () => {
  it("uses a table when a model maps to it and the model is not @@ignore", () => {
    const set = used(`
      model User {
        id Int @id
        @@map("users")
      }
      model Post {
        id Int @id
      }
      model AuditLog {
        id Int @id
        @@ignore
      }
    `);
    expect([...set.tables.keys()]).toEqual(["users", "Post"]);
    expect(table(set, "users").model).toBe("User");
  });

  it("uses a column for each scalar field that is not @ignore, under its @map name", () => {
    const set = used(`
      model User {
        id     Int     @id
        email  String  @map("email_address")
        legacy String? @ignore
      }
    `);
    expect([...table(set, "User").columns.keys()]).toEqual(["id", "email_address"]);
    expect(column(set, "User", "email_address").field).toBe("email");
  });

  it("gives relation fields no column, but keeps their foreign-key scalar fields", () => {
    const set = used(`
      model User {
        id    Int    @id
        posts Post[]
      }
      model Post {
        id       Int  @id
        authorId Int  @map("author_id")
        author   User @relation(fields: [authorId], references: [id])
      }
    `);
    expect([...table(set, "User").columns.keys()]).toEqual(["id"]);
    expect([...table(set, "Post").columns.keys()]).toEqual(["id", "author_id"]);
  });

  it("uses an enum only when a used column has that enum type", () => {
    const set = used(`
      enum Role {
        ADMIN @map("admin")
        USER
        @@map("user_role")
      }
      enum Tag {
        A
      }
      enum OnlyIgnoredField {
        X
      }
      enum OnlyIgnoredModel {
        Y
      }
      enum NoColumn {
        Z
      }
      model User {
        id     Int               @id
        role   Role
        tags   Tag[]
        status OnlyIgnoredField? @ignore
      }
      model AuditLog {
        id   Int              @id
        tier OnlyIgnoredModel
        @@ignore
      }
    `);
    expect([...set.enums.values()]).toEqual([
      { name: "user_role", enumName: "Role", values: ["admin", "USER"] },
      { name: "Tag", enumName: "Tag", values: ["A"] },
    ]);
    expect(column(set, "User", "role").enum).toBe("user_role");
  });

  it("records type, native type, optional, list, default and enum for each column", () => {
    const set = used(`
      enum Role {
        USER
        @@map("user_role")
      }
      model User {
        id    Int     @id @default(autoincrement())
        email String? @db.VarChar(255)
        tags  String[]
        role  Role    @default(USER)
      }
    `);
    expect(column(set, "User", "id")).toEqual({
      name: "id",
      field: "id",
      prismaType: "Int",
      nativeType: { name: "Integer", args: [] },
      optional: false,
      list: false,
      default: { kind: "autoincrement", appliedBy: "database" },
      enum: null,
    });
    expect(column(set, "User", "email")).toMatchObject({
      nativeType: { name: "VarChar", args: ["255"] },
      optional: true,
      default: null,
    });
    expect(column(set, "User", "tags")).toMatchObject({ list: true, optional: false });
    expect(column(set, "User", "role")).toMatchObject({
      prismaType: "Role",
      nativeType: null,
      default: { kind: "literal", appliedBy: "prisma" },
      enum: "user_role",
    });
  });

  it("falls back to Prisma's default native type for each scalar without @db.*", () => {
    const set = used(`
      model T {
        s  String   @id
        i  Int
        bi BigInt
        f  Float
        d  Decimal
        dt DateTime
        b  Boolean
        j  Json
        by Bytes
      }
    `);
    const native = [...table(set, "T").columns.values()].map((c) => c.nativeType);
    expect(native).toEqual([
      { name: "Text", args: [] },
      { name: "Integer", args: [] },
      { name: "BigInt", args: [] },
      { name: "DoublePrecision", args: [] },
      { name: "Decimal", args: ["65", "30"] },
      { name: "Timestamp", args: ["3"] },
      { name: "Boolean", args: [] },
      { name: "JsonB", args: [] },
      { name: "ByteA", args: [] },
    ]);
  });

  it("marks only autoincrement() and dbgenerated() as applied by the database", () => {
    const set = used(`
      model T {
        id      Int      @id @default(autoincrement())
        slug    String   @default(dbgenerated("gen_random_uuid()::text"))
        created DateTime @default(now())
        updated DateTime @updatedAt
        u4      String   @default(uuid())
        u7      String   @default(uuid(7))
        c       String   @default(cuid())
        ul      String   @default(ulid())
        n       String   @default(nanoid())
        label   String   @default("anon")
        scores  Int[]    @default([1, 2])
        plain   String
      }
    `);
    const defaults = Object.fromEntries(
      [...table(set, "T").columns.values()].map((c) => [c.name, c.default]),
    );
    expect(defaults).toEqual({
      id: { kind: "autoincrement", appliedBy: "database" },
      slug: { kind: "dbgenerated", appliedBy: "database" },
      created: { kind: "now", appliedBy: "prisma" },
      updated: null,
      u4: { kind: "uuid", appliedBy: "prisma" },
      u7: { kind: "uuid", appliedBy: "prisma" },
      c: { kind: "cuid", appliedBy: "prisma" },
      ul: { kind: "ulid", appliedBy: "prisma" },
      n: { kind: "nanoid", appliedBy: "prisma" },
      label: { kind: "literal", appliedBy: "prisma" },
      scores: { kind: "literal", appliedBy: "prisma" },
      plain: null,
    });
  });

  it("leaves out Unsupported(...) fields: base's client never reads them", () => {
    const set = used(`
      model Doc {
        id     Int                       @id
        search Unsupported("tsvector")?
      }
    `);
    expect([...table(set, "Doc").columns.keys()]).toEqual(["id"]);
  });

  it("leaves out models outside the public schema (v0.1 is public-only)", () => {
    const set = buildUsedSet(`
      datasource db {
        provider = "postgresql"
        schemas  = ["public", "audit"]
      }
      model User {
        id Int @id
        @@schema("public")
      }
      model Event {
        id Int @id
        @@schema("audit")
      }
    `);
    expect([...set.tables.keys()]).toEqual(["User"]);
  });
});

describe("buildUsedSet: guards", () => {
  it("throws SchemaError for an invalid schema, with Prisma's message and no colour codes", () => {
    const invalid = 'datasource db {\n  provider = "postgresql"\n  url = "postgres://x"\n}\n';
    let thrown: unknown;
    try {
      buildUsedSet(invalid);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SchemaError);
    const message = thrown instanceof Error ? thrown.message : "";
    expect(message).toContain("`url` is no longer supported");
    expect(message).not.toContain("\u001b");
  });

  it("accepts a schema with no models as an empty used set (D37: the report warns)", () => {
    const set = buildUsedSet(DATASOURCE);
    expect(set.tables.size).toBe(0);
    expect(set.enums.size).toBe(0);
  });
});
