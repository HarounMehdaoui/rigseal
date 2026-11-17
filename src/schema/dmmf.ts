// The only source file that calls getDMMF: schema text → Prisma's datamodel, or a thrown SchemaError.
import { stripVTControlCharacters } from "node:util";
import { getDMMF } from "@prisma/get-dmmf";
import { SchemaError } from "./schema-error.ts";

// getDMMF's own types, derived from its signature so we don't import @prisma/dmmf directly.
export type Datamodel = Extract<ReturnType<typeof getDMMF>, { datamodel: unknown }>["datamodel"];
export type Field = Datamodel["models"][number]["fields"][number];

/**
 * Pure: getDMMF runs in WebAssembly, with no I/O. It returns errors instead of throwing (T2.2),
 * so they become a thrown SchemaError here. `@ignore`, `@@ignore` and `Unsupported(...)` are
 * already left out of what it returns.
 */
export function readDatamodel(schemaText: string): Datamodel {
  const result = getDMMF({ datamodel: schemaText });
  if ("reason" in result) {
    throw new SchemaError(`base schema.prisma is invalid: ${prismaMessage(result.error)}`);
  }
  return result.datamodel;
}

/** Prisma wraps its message in JSON (`{"error_code":"P1012","message":…}`) with colour codes. */
function prismaMessage(error: Error): string {
  let text = error.message;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && "message" in parsed) {
      if (typeof parsed.message === "string") text = parsed.message;
    }
  } catch {
    // Not JSON: keep the message as it is.
  }
  return stripVTControlCharacters(text).trim();
}
