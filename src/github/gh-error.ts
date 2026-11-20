// `GhError`: the one error type for "the gh CLI couldn't answer" (not installed, not logged in, API failure): a tool failure, exit 2.

export class GhError extends Error {
  override readonly name = "GhError";
  /** True when gh ran and exited non-zero; false when it never ran. */
  readonly ran: boolean;
  /** gh's own first error line, without our prefix. */
  readonly detail: string;

  constructor(message: string, ran: boolean, detail: string, options?: ErrorOptions) {
    super(message, options);
    this.ran = ran;
    this.detail = detail;
  }
}
