// RG-DB-006/007/008 · Type changes: narrowing → RISKY, scalar-changing widening → RISKY, unknown → UNSAFE.
import type { AlterColumnType, Entry, PgType, Severity } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { scalarCovers } from "./scalar-coverage.ts";
import { columnTarget } from "./target.ts";
import { typeRelation } from "./type-compat.ts";

const NARROWING = "RG-DB-006";
const WIDENING = "RG-DB-007";
const UNKNOWN = "RG-DB-008";

const UNKNOWN_FIX =
  "Add a new column with the new type and migrate with expand/contract (or, if you know it is safe, document it).";

export function alterColumnType(change: AlterColumnType, { used }: RuleContext): Entry {
  const name = `"${change.table}"."${change.column}"`;
  const to = formatType(change.type);
  const entry = (ruleId: string, severity: Severity, reason: string, fix?: string): Entry => ({
    ruleId,
    severity,
    target: columnTarget(change.table, change.column),
    reason,
    ...(fix === undefined ? {} : { fix }),
    source: change.source,
  });

  const column = used.tables.get(change.table)?.columns.get(change.column);
  if (column === undefined) {
    return entry(
      UNKNOWN,
      "SAFE",
      `Base doesn't use column ${name}, so changing its type can't break base.`,
    );
  }
  if (column.nativeType === null) {
    const base = column.enum === null ? "its base type" : `its base type, enum "${column.enum}",`;
    return entry(
      UNKNOWN,
      "UNSAFE",
      `Rigseal can't prove that base can still read and write ${name}: ${base} isn't on the widening list.`,
      UNKNOWN_FIX,
    );
  }
  if (change.using) {
    return entry(
      UNKNOWN,
      "UNSAFE",
      `Rigseal can't prove that base can still read and write ${name}: the change to ${to} rewrites every value with a USING cast.`,
      UNKNOWN_FIX,
    );
  }

  const from = formatType(column.nativeType);
  switch (typeRelation(column.nativeType, change.type)) {
    case "same":
      return entry(
        WIDENING,
        "SAFE",
        `Column ${name} keeps its type ${to}, so base reads and writes it as before.`,
      );
    case "widening":
      if (scalarCovers(column.prismaType, change.type)) {
        return entry(
          WIDENING,
          "SAFE",
          `Column ${name} widens from ${from} to ${to}, and base's ${column.prismaType} still holds every value.`,
        );
      }
      return entry(
        WIDENING,
        "RISKY",
        `Column ${name} widens from ${from} to ${to}, which base's ${column.prismaType} can't fully represent: Prisma reads larger values without an error, so values head writes beyond ${column.prismaType}'s range come back silently wrong.`,
        `Widen base's schema type first (for example Int → BigInt), then widen the column.`,
      );
    case "narrowing":
      return entry(
        NARROWING,
        "RISKY",
        `Column ${name} narrows from ${from} to ${to}: base writes that don't fit the new type fail (value too long, out of range).`,
        "Keep the wider type, or first change base's schema (@db.*) so base never writes values that don't fit, then narrow one release later.",
      );
    case "unknown":
      return entry(
        UNKNOWN,
        "UNSAFE",
        `Rigseal can't prove that base can still read and write ${name}: ${from} → ${to} isn't on the widening list.`,
        UNKNOWN_FIX,
      );
  }
}

function formatType(type: PgType): string {
  const args = type.args.length > 0 ? `(${type.args.join(",")})` : "";
  return `${type.name}${args}${type.array ? "[]" : ""}`;
}
