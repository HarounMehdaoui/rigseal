import { describe, expect, it } from "vitest";
import { UsageError } from "../cli/usage-error.ts";
import { GITHUB_OIDC_ISSUER, signerOf } from "./signer.ts";

const OK = {
  repository: "acme/shop",
  workflow: ".github/workflows/rigseal.yml",
  ref: "refs/heads/main",
};

describe("signerOf", () => {
  it("builds the exact certificate identity from its parts", () => {
    expect(signerOf(OK)).toEqual({
      identity: "https://github.com/acme/shop/.github/workflows/rigseal.yml@refs/heads/main",
      repository: "acme/shop",
      ref: "refs/heads/main",
    });
  });

  it("uses GitHub Actions' OIDC issuer, which no flag can change", () => {
    expect(GITHUB_OIDC_ISSUER).toBe("https://token.actions.githubusercontent.com");
  });

  it("accepts tags, .yaml files and the characters GitHub allows in names", () => {
    expect(
      signerOf({
        repository: "Acme-Corp/shop.api_v2",
        workflow: ".github/workflows/release.yaml",
        ref: "refs/tags/v1.2.0",
      }).identity,
    ).toBe(
      "https://github.com/Acme-Corp/shop.api_v2/.github/workflows/release.yaml@refs/tags/v1.2.0",
    );
  });

  it.each([
    [{ repository: "acme" }, /--repository/],
    [{ repository: "acme/shop/extra" }, /--repository/],
    [{ repository: "acme/.*" }, /--repository/],
    [{ repository: "https://github.com/acme/shop" }, /--repository/],
    [{ workflow: "rigseal.yml" }, /--workflow/],
    [{ workflow: ".github/workflows/sub/x.yml" }, /--workflow/],
    [{ workflow: ".github/workflows/x.json" }, /--workflow/],
    [{ workflow: ".github/workflows/.*" }, /--workflow/],
    [{ ref: "main" }, /--ref/],
    [{ ref: "refs/pull/1/merge" }, /--ref/],
    [{ ref: "refs/heads/ma in" }, /--ref/],
    [{ ref: "refs/heads/a..b" }, /--ref/],
    [{ ref: "refs/heads/.*" }, /--ref/],
  ])("rejects %j instead of matching something else", (part, message) => {
    expect(() => signerOf({ ...OK, ...part })).toThrow(UsageError);
    expect(() => signerOf({ ...OK, ...part })).toThrow(message);
  });
});
