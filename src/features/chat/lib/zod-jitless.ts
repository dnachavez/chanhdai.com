import { config } from "zod/v4/core"

/**
 * Stops zod from probing for the Function constructor, which the site's CSP
 * blocks.
 *
 * Zod v4 decides once, on the first schema it builds, whether to JIT-compile
 * object validators — and it decides by *trying* it: `new Function("")` inside
 * a try/catch. Under `script-src` without `'unsafe-eval'` that throws, zod
 * catches it and quietly uses the interpreted path, so nothing breaks. The
 * browser reports the violation anyway, which is the actual cost: one report
 * per session arriving at `/api/csp-report`, for a policy working exactly as
 * intended, burying the reports that endpoint exists to surface.
 *
 * `jitless` short-circuits ahead of the probe rather than suppressing the
 * report, so the Function constructor is never reached in the first place.
 *
 * We do not call zod v4 ourselves — this site's own schemas are v3, which has
 * no JIT — but `@ai-sdk/react` bundles v4 and builds its schemas at module
 * scope. Importing this module before it is therefore the only window in which
 * the setting can still be read, which is why it is a bare side-effect import
 * at the top of `chat-provider.tsx` and why the import order there matters.
 * `zod-jitless.test.ts` fails if that window ever closes.
 */
config({ jitless: true })
