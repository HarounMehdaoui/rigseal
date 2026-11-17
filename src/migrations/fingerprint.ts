// A migration's identity: SHA-256 (hex) of its SQL after CRLF → LF (D19).
// That's Prisma's own checksum (verified against `_prisma_migrations.checksum`), so a Windows checkout
// that only changed line endings isn't an edit (RULES §6 row 12).
import { createHash } from "node:crypto";

export function fingerprint(sql: string): string {
  return createHash("sha256").update(sql.replaceAll("\r\n", "\n"), "utf8").digest("hex");
}
