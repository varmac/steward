type Verify = (request: Request, body: Uint8Array) => unknown | Promise<unknown>;

/**
 * Inbound webhook check for the Linq channel. Returns `true` only for a
 * verified identity (an object with a string `principalId`) and `false` for
 * anything else, including a throw, so the route fails closed.
 *
 * The adapter has already read the request body when it calls the verifier.
 * A verifier used here must check headers, or the `body` bytes it is given.
 */
export function rejectUnverified(verify: Verify) {
  return async (request: Request, body: Uint8Array): Promise<boolean> => {
    try {
      const identity = await verify(request, body);
      return (
        typeof identity === "object" &&
        identity !== null &&
        !(identity instanceof Response) &&
        typeof (identity as { principalId?: unknown }).principalId === "string"
      );
    } catch {
      return false;
    }
  };
}
