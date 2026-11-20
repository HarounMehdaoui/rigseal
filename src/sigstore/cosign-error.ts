// `CosignError`: the one error type for "cosign itself couldn't run" (a tool failure, exit 2).

export class CosignError extends Error {
  override readonly name = "CosignError";
}
