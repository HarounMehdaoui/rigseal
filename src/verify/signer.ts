// Who must have signed a report: validates the repository, workflow file and ref, and builds the exact certificate identity.
import { UsageError } from "../cli/usage-error.ts";

/** GitHub Actions' OIDC issuer. Fixed: a report signed by any other issuer is never accepted. */
export const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";

export interface SignerParts {
  readonly repository: string;
  readonly workflow: string;
  readonly ref: string;
}

/** The exact identity, never a pattern, plus the claims pinned alongside it. */
export interface Signer {
  readonly identity: string;
  readonly repository: string;
  readonly ref: string;
}

// GitHub's own rules: owner = letters, digits, hyphens; repo = also "." and "_".
const REPOSITORY = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
// Workflows live directly in .github/workflows/ (no subfolders) as .yml or .yaml.
const WORKFLOW = /^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/;
// A branch or tag ref, in the subset of git's ref rules that names can't escape.
const REF = /^refs\/(heads|tags)\/[A-Za-z0-9._/-]+$/;

/**
 * Each part is checked on its own, so a typo or a pasted pattern fails here instead of making the
 * identity match some other workflow. The characters allowed can't form a regexp wildcard.
 */
export function signerOf({ repository, workflow, ref }: SignerParts): Signer {
  if (!REPOSITORY.test(repository) || repository.includes("..")) {
    throw new UsageError(`--repository must be "owner/repo", not "${repository}"`);
  }
  if (!WORKFLOW.test(workflow)) {
    throw new UsageError(
      `--workflow must be a file in .github/workflows/ ending .yml or .yaml, not "${workflow}"`,
    );
  }
  if (!REF.test(ref) || ref.includes("..") || ref.endsWith("/") || ref.includes("//")) {
    throw new UsageError(
      `--ref must be a full branch or tag ref like refs/heads/main, not "${ref}"`,
    );
  }
  return { identity: `https://github.com/${repository}/${workflow}@${ref}`, repository, ref };
}
