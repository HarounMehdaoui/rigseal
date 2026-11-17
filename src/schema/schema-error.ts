// The one error type for "base's schema can't be read": a real tool failure (exit 2), not a finding.

export class SchemaError extends Error {
  override readonly name = "SchemaError";
}

/** For states getDMMF 7.10.1 never produces: a Prisma upgrade broke our assumptions. */
export function unexpected(message: string): never {
  throw new SchemaError(`${message} (unexpected from Prisma 7.10.1)`);
}
