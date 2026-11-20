// `UsageError`: the one error type for bad command-line arguments (exit 2, D14).

export class UsageError extends Error {
  override readonly name = "UsageError";
}
