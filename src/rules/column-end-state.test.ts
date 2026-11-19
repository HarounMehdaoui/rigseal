import { describe, expect, it } from "vitest";
import type { AddColumn, Change } from "../types.ts";
import { columnEndState } from "./column-end-state.ts";
import { at, contextFor } from "./rule-test-support.ts";

const text = { name: "text", args: [], array: false };

function add(column: string, notNull: boolean, hasDefault: boolean): AddColumn {
  return {
    kind: "AddColumn",
    table: "User",
    column,
    type: text,
    notNull,
    hasDefault,
    source: at(2),
  };
}

function endOf(added: AddColumn, before: Change[], after: Change[]) {
  return columnEndState(added, contextFor("", [...before, added, ...after]));
}

describe("columnEndState (D33)", () => {
  it("is the column as added when nothing later touches it", () => {
    expect(endOf(add("phone", true, false), [], [])).toEqual({
      exists: true,
      notNull: true,
      hasDefault: false,
    });
  });

  it("applies later DROP DEFAULT and SET NOT NULL on the same column", () => {
    const added = add("phone", false, true);
    const end = endOf(
      added,
      [],
      [
        { kind: "DropDefault", table: "User", column: "phone", source: at(5) },
        { kind: "SetNotNull", table: "User", column: "phone", source: at(6) },
      ],
    );
    expect(end).toEqual({ exists: true, notNull: true, hasDefault: false });
  });

  it("follows the column through a later rename of it and of its table", () => {
    const end = endOf(
      add("tel", true, true),
      [],
      [
        { kind: "RenameColumn", table: "User", column: "tel", newName: "phone", source: at(5) },
        { kind: "RenameTable", table: "User", newName: "Person", source: at(6) },
        { kind: "DropDefault", table: "Person", column: "phone", source: at(7) },
      ],
    );
    expect(end.hasDefault).toBe(false);
  });

  it("ignores changes before the add and changes to other columns", () => {
    const end = endOf(
      add("phone", true, true),
      [{ kind: "DropDefault", table: "User", column: "phone", source: at(1) }],
      [{ kind: "DropDefault", table: "User", column: "email", source: at(5) }],
    );
    expect(end.hasDefault).toBe(true);
  });

  it("knows a column dropped again later doesn't exist at the end", () => {
    const end = endOf(
      add("phone", true, false),
      [],
      [{ kind: "DropColumn", table: "User", column: "phone", source: at(5) }],
    );
    expect(end.exists).toBe(false);
  });
});
