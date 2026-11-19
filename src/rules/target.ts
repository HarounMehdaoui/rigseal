// How an entry names what it judges, in database names: a table `User`, a column `User.fullName`.

export function tableTarget(table: string): string {
  return table;
}

export function columnTarget(table: string, column: string): string {
  return `${table}.${column}`;
}
