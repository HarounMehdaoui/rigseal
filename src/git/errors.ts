// The one error type for every git problem; the CLI maps it to exit 2.

export type GitErrorCode =
  | "REF_NOT_FOUND"
  | "PATH_NOT_FOUND"
  | "NOT_A_FILE"
  | "NOT_A_DIRECTORY"
  | "GIT_FAILED";

export class GitError extends Error {
  readonly code: GitErrorCode;

  constructor(code: GitErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GitError";
    this.code = code;
  }
}
