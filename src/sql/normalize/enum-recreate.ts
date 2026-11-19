// Recognizes Prisma's exact enum-recreate sequence and turns it into one RemoveEnumValue per removed value (RG-DB-016).
import type { UsedSet } from "../../schema/types.ts";
import type { AlterColumnType, Change, CreateEnum, RemoveEnumValue } from "../../types.ts";

const NEW_SUFFIX = "_new";
const OLD_SUFFIX = "_old";

/**
 * The sequence (RULES §4, §6 row 8), all consecutive: CREATE TYPE "X_new"; per column an optional
 * DROP DEFAULT then ALTER … TYPE "X_new" USING …; RENAME "X" → "X_old"; RENAME "X_new" → "X";
 * DROP TYPE "X_old"; SET DEFAULT for each dropped default, in the same order. Every column base has
 * with the enum must be retyped. Anything else, or an enum base doesn't use, is left as it is: the
 * separate changes then fail closed (RG-DB-008/017). Base's used set says which values it removes.
 */
export function recognizeEnumRecreate(changes: readonly Change[], used: UsedSet): Change[] {
  const out: Change[] = [];
  let i = 0;
  while (i < changes.length) {
    const match = matchAt(changes, i, used);
    if (match === undefined) {
      out.push(changes[i] as Change);
      i += 1;
    } else {
      out.push(...match.removed);
      i = match.end;
    }
  }
  return out;
}

interface Match {
  readonly removed: RemoveEnumValue[];
  /** Index just after the sequence. */
  readonly end: number;
}

function matchAt(changes: readonly Change[], start: number, used: UsedSet): Match | undefined {
  const create = changes[start];
  if (create?.kind !== "CreateEnum" || !create.enum.endsWith(NEW_SUFFIX)) return undefined;
  const name = create.enum.slice(0, -NEW_SUFFIX.length);
  const base = used.enums.get(name)?.values;
  if (name === "" || base === undefined) return undefined;

  // Per column: an optional DROP DEFAULT, then the type change to "X_new" with its USING cast.
  let i = start + 1;
  const defaulted: { table: string; column: string }[] = [];
  const retyped = new Set<string>();
  for (;;) {
    const current = changes[i];
    const next = changes[i + 1];
    if (current?.kind === "DropDefault" && isRetype(next, create, current)) {
      defaulted.push({ table: current.table, column: current.column });
      retyped.add(key(current.table, current.column));
      i += 2;
    } else if (isRetype(current, create)) {
      retyped.add(key(current.table, current.column));
      i += 1;
    } else {
      break;
    }
  }
  // Every column base has with this enum must move to the new type, or the sequence is partial.
  for (const table of used.tables.values()) {
    for (const column of table.columns.values()) {
      if (column.enum === name && !retyped.has(key(table.name, column.name))) return undefined;
    }
  }

  const renameOld = changes[i];
  const renameNew = changes[i + 1];
  const dropOld = changes[i + 2];
  if (renameOld?.kind !== "RenameEnum" || renameOld.enum !== name) return undefined;
  if (renameOld.newName !== name + OLD_SUFFIX) return undefined;
  if (renameNew?.kind !== "RenameEnum" || renameNew.enum !== create.enum) return undefined;
  if (renameNew.newName !== name) return undefined;
  if (dropOld?.kind !== "DropEnum" || dropOld.enum !== name + OLD_SUFFIX) return undefined;
  i += 3;

  // Every dropped default is restored, in the same order.
  for (const { table, column } of defaulted) {
    const restore = changes[i];
    if (restore?.kind !== "SetDefault" || restore.table !== table || restore.column !== column) {
      return undefined;
    }
    i += 1;
  }

  const kept = new Set(create.values);
  const removed = base
    .filter((value) => !kept.has(value))
    .map(
      (value): RemoveEnumValue => ({
        kind: "RemoveEnumValue",
        enum: name,
        value,
        source: create.source,
      }),
    );
  // A recreate that removes nothing isn't the pattern RG-DB-016 knows: leave it to fail closed.
  return removed.length === 0 ? undefined : { removed, end: i };
}

function key(table: string, column: string): string {
  return `${table}.${column}`;
}

/** `ALTER COLUMN … TYPE "X_new"` (or `"X_new"[]`) with Prisma's USING cast, on the same column if given. */
function isRetype(
  change: Change | undefined,
  create: CreateEnum,
  same?: { table: string; column: string },
): change is AlterColumnType {
  if (change?.kind !== "AlterColumnType" || change.type.name !== create.enum || !change.using) {
    return false;
  }
  return same === undefined || (change.table === same.table && change.column === same.column);
}
