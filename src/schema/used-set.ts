// Builds the used set from base's schema.prisma (RULES §2, D8): which tables, columns and enums base's
// client uses. Rules check head's migrations against this set only; head's schema is never consulted.
import { readDatamodel } from "./dmmf.ts";
import { columnDefault, nativeType } from "./prisma-defaults.ts";
import { unexpected } from "./schema-error.ts";
import type { UsedColumn, UsedEnum, UsedSet, UsedTable } from "./types.ts";

/** A schema with no models gives an empty set; the report warns about it (D37). */
export function buildUsedSet(schemaText: string): UsedSet {
  const datamodel = readDatamodel(schemaText);
  const enumNames = new Map(datamodel.enums.map((e) => [e.name, e.dbName ?? e.name]));
  const usedEnums = new Set<string>();
  const tables = new Map<string, UsedTable>();

  for (const model of datamodel.models) {
    // v0.1 is public-only (RULES §2): statements on other schemas are RG-DB-022 anyway.
    if ((model.schema ?? "public") !== "public") continue;

    const columns = new Map<string, UsedColumn>();
    for (const field of model.fields) {
      // Relation fields (`object`) have no column; their foreign-key scalars are separate fields.
      if (field.kind !== "scalar" && field.kind !== "enum") continue;

      const where = `${model.name}.${field.name}`;
      let enumName: string | null = null;
      if (field.kind === "enum") {
        enumName =
          enumNames.get(field.type) ?? unexpected(`${where}: enum ${field.type} not found`);
        usedEnums.add(field.type);
      }
      const name = field.dbName ?? field.name;
      columns.set(name, {
        name,
        field: field.name,
        prismaType: field.type,
        nativeType: enumName === null ? nativeType(field, where) : null,
        optional: !field.isRequired,
        list: field.isList,
        default: columnDefault(field, where),
        enum: enumName,
      });
    }

    const name = model.dbName ?? model.name;
    tables.set(name, { name, model: model.name, columns });
  }

  const enums = new Map<string, UsedEnum>();
  for (const e of datamodel.enums) {
    if (!usedEnums.has(e.name)) continue;
    const name = e.dbName ?? e.name;
    enums.set(name, { name, enumName: e.name, values: e.values.map((v) => v.dbName ?? v.name) });
  }

  return { tables, enums };
}
