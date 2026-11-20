// `Refusal`: the one error type for "this deploy must not go ahead" (exit 1), as opposed to a tool failure (exit 2).

export class Refusal extends Error {
  override readonly name = "Refusal";
}
