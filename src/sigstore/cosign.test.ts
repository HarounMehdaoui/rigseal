import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cosignVerifyBlob } from "./cosign.ts";
import { type FakeCosign, makeFakeCosign } from "./fake-cosign.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const REQUEST = {
  blob: "/tmp/report.json",
  bundle: "/tmp/report.sigstore.json",
  signer: {
    identity: "https://github.com/acme/shop/.github/workflows/rigseal.yml@refs/heads/main",
    repository: "acme/shop",
    ref: "refs/heads/main",
  },
  sha: SHA,
};

let cosign: FakeCosign;
beforeEach(async () => {
  cosign = await makeFakeCosign();
});
afterEach(async () => {
  await cosign.remove();
});

describe("cosignVerifyBlob", () => {
  it("pins the exact identity, the issuer and every workflow claim, never a regexp", async () => {
    expect(await cosignVerifyBlob(cosign.path, REQUEST)).toEqual({ ok: true });
    expect(await cosign.lastArgs()).toEqual([
      "verify-blob",
      "--bundle",
      "/tmp/report.sigstore.json",
      "--certificate-identity",
      "https://github.com/acme/shop/.github/workflows/rigseal.yml@refs/heads/main",
      "--certificate-oidc-issuer",
      "https://token.actions.githubusercontent.com",
      "--certificate-github-workflow-repository",
      "acme/shop",
      "--certificate-github-workflow-ref",
      "refs/heads/main",
      "--certificate-github-workflow-sha",
      SHA,
      "--certificate-github-workflow-trigger",
      "push",
      "--",
      "/tmp/report.json",
    ]);
  });

  it("reports a failed verification with cosign's first error line", async () => {
    await cosign.behave(1, "Error: none of the expected identities matched\nmore detail");
    expect(await cosignVerifyBlob(cosign.path, REQUEST)).toEqual({
      ok: false,
      message: "Error: none of the expected identities matched",
    });
  });

  it("throws a CosignError when cosign can't run at all", async () => {
    await expect(cosignVerifyBlob("/nonexistent/cosign", REQUEST)).rejects.toMatchObject({
      name: "CosignError",
      message: expect.stringMatching(/could not run cosign/),
    });
  });
});
