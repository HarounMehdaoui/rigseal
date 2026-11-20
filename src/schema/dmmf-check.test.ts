// Does getDMMF (Prisma 7.10.1) give us everything the rules read? One test per criterion.
// If any of these ever fails after a Prisma upgrade, switch the schema reader to prisma-ast.
import { getDMMF } from "@prisma/get-dmmf";
import { describe, expect, it } from "vitest";

const FIXTURE = `
datasource db {
  provider = "postgresql"
}

enum Role {
  ADMIN @map("admin")
  USER

  @@map("user_role")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @db.VarChar(255) @map("email_address")
  name      String   @default("anon")
  role      Role     @default(USER)
  legacy    String?  @ignore
  slug      String   @default(dbgenerated("gen_random_uuid()::text"))
  posts     Post[]

  @@map("users")
}

model Post {
  id       Int  @id @default(autoincrement())
  authorId Int  @map("author_id")
  author   User @relation(fields: [authorId], references: [id])
}

model AuditLog {
  id Int @id

  @@ignore
}
`;

function datamodel() {
  const result = getDMMF({ datamodel: FIXTURE });
  if ("reason" in result) throw new Error(`fixture schema rejected: ${result.reason}`);
  return result.datamodel;
}

function model(name: string) {
  const found = datamodel().models.find((m) => m.name === name);
  if (found === undefined) throw new Error(`model ${name} missing from DMMF`);
  return found;
}

function field(modelName: string, fieldName: string) {
  const found = model(modelName).fields.find((f) => f.name === fieldName);
  if (found === undefined) throw new Error(`field ${modelName}.${fieldName} missing from DMMF`);
  return found;
}

describe("getDMMF meets the schema reader's five criteria", () => {
  it("1. gives database names from @map and @@map (null when unmapped)", () => {
    expect(model("User").dbName).toBe("users");
    expect(model("Post").dbName).toBeNull();
    expect(field("User", "email").dbName).toBe("email_address");
    expect(field("Post", "authorId").dbName).toBe("author_id");
    expect(field("User", "name").dbName ?? null).toBeNull();
  });

  it("2. gives native types from @db.* (null without one)", () => {
    expect(field("User", "email").nativeType).toEqual(["VarChar", ["255"]]);
    expect(field("User", "name").nativeType ?? null).toBeNull();
  });

  it("3. leaves out @ignore fields and @@ignore models entirely", () => {
    expect(model("User").fields.map((f) => f.name)).not.toContain("legacy");
    expect(datamodel().models.map((m) => m.name)).not.toContain("AuditLog");
  });

  it("4. tells default kinds apart: autoincrement(), dbgenerated(), literal", () => {
    expect(field("User", "id").default).toEqual({ name: "autoincrement", args: [] });
    expect(field("User", "slug").default).toEqual({
      name: "dbgenerated",
      args: ["gen_random_uuid()::text"],
    });
    expect(field("User", "name").default).toBe("anon");
  });

  it("5. gives enum database names, for the type and for each value", () => {
    expect(datamodel().enums).toEqual([
      {
        name: "Role",
        dbName: "user_role",
        values: [
          { name: "ADMIN", dbName: "admin" },
          { name: "USER", dbName: null },
        ],
      },
    ]);
  });
});

describe("getDMMF behaviours the schema reader must guard against", () => {
  it("returns an invalid schema as an error object instead of throwing", () => {
    const result = getDMMF({
      datamodel: 'datasource db {\n  provider = "postgresql"\n  url = "postgres://x"\n}\n',
    });
    expect(result).toMatchObject({ type: "wasm-error" });
  });

  it("accepts an empty schema as valid, with no models", () => {
    const result = getDMMF({ datamodel: "" });
    expect("reason" in result).toBe(false);
    expect("datamodel" in result && result.datamodel.models).toEqual([]);
  });
});
