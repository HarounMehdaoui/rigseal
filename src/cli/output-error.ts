// `OutputError`: the one error type for a report file that can't be written (exit 2, D14).

export class OutputError extends Error {
  override readonly name = "OutputError";
}
