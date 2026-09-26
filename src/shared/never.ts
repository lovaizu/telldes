/** Put in a switch's `default` so that adding a case without handling it fails the type check. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}
