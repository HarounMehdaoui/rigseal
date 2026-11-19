// How an entry names what it judges, in database names: `User`, `User.fullName`, or an index/enum's name.

export function tableTarget(table: string): string {
  return table;
}

export function columnTarget(table: string, column: string): string {
  return `${table}.${column}`;
}

/** An index, constraint or enum: its own name; an unnamed one is named by its table. */
export function objectTarget(name: string | null, table?: string): string {
  return name ?? table ?? "(unnamed)";
}
