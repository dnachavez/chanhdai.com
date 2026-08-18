const realFunctionConstructor = globalThis.Function

/**
 * Makes the Function constructor throw the way a `script-src` without
 * `'unsafe-eval'` does, and records who tried.
 *
 * A proxy rather than a plain replacement so that everything else about
 * `Function` — `instanceof`, prototype identity, the properties libraries read
 * off it — keeps working, and only construction and invocation fail. Both traps
 * are needed: `Function(...)` and `new Function(...)` are equivalent in
 * JavaScript and blocked alike, but they are separate proxy hooks.
 */
export function denyFunctionConstructor() {
  const attempts: unknown[][] = []

  globalThis.Function = new Proxy(realFunctionConstructor, {
    construct(_target, args) {
      attempts.push(args)
      throw new EvalError("call to Function() blocked by CSP")
    },
    apply(_target, _thisArg, args) {
      attempts.push(args)
      throw new EvalError("call to Function() blocked by CSP")
    },
  }) as FunctionConstructor

  return attempts
}

export function restoreFunctionConstructor() {
  globalThis.Function = realFunctionConstructor
}
