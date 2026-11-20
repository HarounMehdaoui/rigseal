import { describe, expect, it } from "vitest";
import { fingerprint } from "./fingerprint.ts";

const INIT = 'CREATE TABLE "User" (\n    "id" SERIAL NOT NULL,\n    "name" TEXT NOT NULL\n);\n';

describe("fingerprint", () => {
  it("hashes the same content with LF and with CRLF identically", () => {
    const crlf = INIT.replaceAll("\n", "\r\n");
    expect(crlf).not.toBe(INIT);
    expect(fingerprint(crlf)).toBe(fingerprint(INIT));
  });

  it("is the SHA-256 of the LF content, as Prisma's own checksum is", () => {
    expect(fingerprint("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(fingerprint("a\r\nb")).toBe(fingerprint("a\nb"));
    expect(fingerprint(INIT)).not.toBe(fingerprint("SELECT 1;"));
  });
});
